import type { NiftyQuote, OptionChain, OptionStrike, OptionData, Candle, Position } from '@/core/types'
import type { OrderRequest, OrderResponse } from '@/core/types'
import type { ITradingService } from './tradingService'
import { useSettingsStore } from '@/core/store'
import { calculateEMA, calculateVWAP } from '@/core/utils/indicators'
import { getNearestExpiry, getStrikesAroundATM } from './instrumentsCache'

const BASE = 'https://api.kite.trade'
const NIFTY_TOKEN = 256265 // NSE:NIFTY 50 instrument token
const LOT_SIZE = 75

function headers() {
  const { apiKey, accessToken } = useSettingsStore.getState()
  return {
    'X-Kite-Version': '3',
    'Authorization': `token ${apiKey}:${accessToken}`,
  }
}

async function kiteGet<T>(path: string, params?: Record<string, string | string[]>): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (Array.isArray(v)) v.forEach(val => url.searchParams.append(k, val))
      else url.searchParams.set(k, v)
    })
  }
  const res = await fetch(url.toString(), { headers: headers() })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? `Kite API error ${res.status}`)
  }
  const json = await res.json()
  return json.data as T
}

interface KiteQuote {
  last_price: number
  ohlc: { open: number; high: number; low: number; close: number }
  change: number
  volume: number
  oi?: number
  oi_day_change?: number
}

export class ZerodhaService implements ITradingService {
  private spotCache = 0

  async getNiftyQuote(): Promise<NiftyQuote> {
    const data = await kiteGet<Record<string, KiteQuote>>('/quote', {
      i: ['NSE:NIFTY 50', 'NSE:INDIA VIX'],
    })

    const nifty = data['NSE:NIFTY 50']
    const vix = data['NSE:INDIA VIX']

    this.spotCache = nifty.last_price

    // PCR requires option chain data — use cached or default
    const pcr = 1.05 // updated when getOptionChain is called

    return {
      spot: nifty.last_price,
      change: nifty.change,
      changePct: nifty.ohlc.close > 0 ? (nifty.change / nifty.ohlc.close) * 100 : 0,
      open: nifty.ohlc.open,
      high: nifty.ohlc.high,
      low: nifty.ohlc.low,
      prevClose: nifty.ohlc.close,
      vix: vix?.last_price ?? 14,
      pcr,
      breadth: 55, // Requires individual stock data — kept as neutral
      vwap: (nifty.ohlc.high + nifty.ohlc.low + nifty.last_price) / 3,
      timestamp: new Date(),
    }
  }

  async getOptionChain(): Promise<OptionChain> {
    const spot = this.spotCache || 24500
    const expiry = await getNearestExpiry()
    const instruments = await getStrikesAroundATM(spot, expiry, 5)

    if (instruments.length === 0) throw new Error('No option instruments found')

    // Build instrument symbols for quote call
    const symbols = instruments.map(i => `NFO:${i.tradingsymbol}`)
    const data = await kiteGet<Record<string, KiteQuote>>('/quote', { i: symbols })

    const atm = Math.round(spot / 50) * 50
    const strikeMap = new Map<number, { ce?: OptionData; pe?: OptionData }>()

    for (const inst of instruments) {
      const key = `NFO:${inst.tradingsymbol}`
      const q = data[key]
      if (!q) continue

      if (!strikeMap.has(inst.strike)) strikeMap.set(inst.strike, {})
      const entry = strikeMap.get(inst.strike)!

      const optData: OptionData = {
        oi: q.oi ?? 0,
        oiChange: q.oi_day_change ?? 0,
        volume: q.volume,
        iv: 0, // Black-Scholes not computed — needs Phase 3 backend
        ltp: q.last_price,
        delta: inst.instrument_type === 'CE' ? 0.5 : -0.5, // approximation near ATM
        gamma: 0.002,
        theta: -2.5,
        vega: 8,
      }

      if (inst.instrument_type === 'CE') entry.ce = optData
      else entry.pe = optData
    }

    const strikes: OptionStrike[] = Array.from(strikeMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([strike, { ce, pe }]) => ({
        strike,
        ce: ce ?? emptyOption(),
        pe: pe ?? emptyOption(),
      }))

    const totalCEOI = strikes.reduce((s, r) => s + r.ce.oi, 0)
    const totalPEOI = strikes.reduce((s, r) => s + r.pe.oi, 0)
    const maxPainStrike = calcMaxPain(strikes)

    // Update PCR on the NiftyQuote
    const pcr = totalCEOI > 0 ? totalPEOI / totalCEOI : 1

    // Patch last quote's PCR (best-effort)
    try {
      const { useMarketStore } = await import('@/core/store')
      const q = useMarketStore.getState().quote
      if (q) useMarketStore.getState().setQuote({ ...q, pcr })
    } catch (_) { /* ignore */ }

    return {
      expiry,
      atmStrike: atm,
      strikes,
      totalCEOI,
      totalPEOI,
      maxPainStrike,
    }
  }

  async getCandles(timeframe = '5minute', count = 30): Promise<Candle[]> {
    const interval = mapTimeframe(timeframe)
    const now = new Date()
    const from = new Date(now.getTime() - count * intervalMs(timeframe) * 2)

    const fromStr = formatKiteDate(from)
    const toStr = formatKiteDate(now)

    const data = await kiteGet<{ candles: Array<[string, number, number, number, number, number]> }>(
      `/instruments/historical/${NIFTY_TOKEN}/${interval}`,
      { from: fromStr, to: toStr, continuous: '0', oi: '0' }
    )

    const candles = data.candles.slice(-count).map(([time, open, high, low, close, volume]) => ({
      time: new Date(time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      open, high, low, close, volume,
    }))

    // Compute EMAs + VWAP
    const closes = candles.map(c => c.close)
    const ema9 = calculateEMA(closes, 9)
    const ema20 = calculateEMA(closes, 20)
    const ema50 = calculateEMA(closes, 50)
    const vwap = calculateVWAP(candles as Candle[])

    return candles.map((c, i) => ({
      ...c,
      ema9: ema9[i],
      ema20: ema20[i],
      ema50: ema50[i],
      vwap: vwap[i],
    }))
  }

  async getPositions(): Promise<Position[]> {
    const data = await kiteGet<{ net: KitePosition[]; day: KitePosition[] }>('/portfolio/positions')
    return data.day
      .filter(p => p.tradingsymbol.startsWith('NIFTY') && p.quantity !== 0)
      .map(p => ({
        positionId: p.tradingsymbol,
        symbol: 'NIFTY',
        strike: parseStrike(p.tradingsymbol),
        optionType: (p.tradingsymbol.endsWith('CE') ? 'CE' : 'PE') as 'CE' | 'PE',
        expiry: parseExpiry(p.tradingsymbol),
        quantity: Math.abs(p.quantity),
        entryPrice: p.average_price,
        ltp: p.last_price,
        pnl: p.pnl,
        pnlPct: p.average_price > 0 ? ((p.last_price - p.average_price) / p.average_price) * 100 : 0,
        productType: p.product as 'MIS' | 'NRML',
        entryTime: new Date(),
      } satisfies Position))
  }

  async placeOrder(order: OrderRequest): Promise<OrderResponse> {
    const variety = 'regular'
    const body = new URLSearchParams({
      tradingsymbol: `NIFTY${order.expiry}${order.strike}${order.optionType}`,
      exchange: 'NFO',
      transaction_type: 'BUY',
      order_type: order.orderType,
      product: order.productType,
      quantity: String(order.quantity * LOT_SIZE),
      ...(order.price ? { price: String(order.price) } : {}),
      ...(order.stopLoss ? { trigger_price: String(order.stopLoss) } : {}),
      validity: 'DAY',
    })

    const res = await fetch(`${BASE}/orders/${variety}`, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message ?? 'Order placement failed')
    }

    const json = await res.json()
    return {
      orderId: json.data.order_id,
      status: 'COMPLETE',
      message: `Order placed: BUY ${order.quantity} lots NIFTY ${order.strike} ${order.optionType}`,
      timestamp: new Date(),
    }
  }

  async exitPosition(positionId: string): Promise<void> {
    const positions = await this.getPositions()
    const pos = positions.find(p => p.positionId === positionId)
    if (!pos) return

    const body = new URLSearchParams({
      tradingsymbol: positionId,
      exchange: 'NFO',
      transaction_type: 'SELL',
      order_type: 'MARKET',
      product: pos.productType,
      quantity: String(pos.quantity),
      validity: 'DAY',
    })

    await fetch(`${BASE}/orders/regular`, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
  }

  async exitAllPositions(): Promise<void> {
    const positions = await this.getPositions()
    await Promise.all(positions.map(p => this.exitPosition(p.positionId)))
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

interface KitePosition {
  tradingsymbol: string
  quantity: number
  average_price: number
  last_price: number
  pnl: number
  product: string
}

function emptyOption(): OptionData {
  return { oi: 0, oiChange: 0, volume: 0, iv: 0, ltp: 0, delta: 0, gamma: 0, theta: 0, vega: 0 }
}

function calcMaxPain(strikes: OptionStrike[]): number {
  let minLoss = Infinity, maxPain = strikes[0]?.strike ?? 0
  for (const { strike } of strikes) {
    const loss = strikes.reduce((s, r) => {
      return s + r.ce.oi * Math.max(0, r.strike - strike) + r.pe.oi * Math.max(0, strike - r.strike)
    }, 0)
    if (loss < minLoss) { minLoss = loss; maxPain = strike }
  }
  return maxPain
}

function mapTimeframe(tf: string): string {
  const map: Record<string, string> = {
    '1m': 'minute', '3m': '3minute', '5m': '5minute',
    '10m': '10minute', '15m': '15minute', '30m': '30minute',
    '1h': '60minute', '1d': 'day',
  }
  return map[tf] ?? '5minute'
}

function intervalMs(tf: string): number {
  const map: Record<string, number> = {
    '1m': 60000, '3m': 180000, '5m': 300000, '10m': 600000,
    '15m': 900000, '30m': 1800000, '1h': 3600000, '1d': 86400000,
  }
  return map[tf] ?? 300000
}

function formatKiteDate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function parseStrike(tradingsymbol: string): number {
  const match = tradingsymbol.match(/(\d+)(CE|PE)$/)
  return match ? parseInt(match[1]) : 0
}

function parseExpiry(tradingsymbol: string): string {
  // e.g. NIFTY26JUN24750CE → extract 26JUN = Jun 2026
  const match = tradingsymbol.match(/NIFTY(\d{2})([A-Z]{3})(\d+)(CE|PE)$/)
  if (match) return `20${match[1]}-${monthIndex(match[2])}-01`
  return new Date().toISOString().slice(0, 10)
}

function monthIndex(mon: string): string {
  const months: Record<string, string> = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
  }
  return months[mon] ?? '01'
}
