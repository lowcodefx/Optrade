import type { NiftyQuote, OptionChain, OptionStrike, OptionData, Candle, Position } from '@/core/types'
import type { OrderRequest, OrderResponse } from '@/core/types'
import type { ITradingService } from './tradingService'
import { useSettingsStore } from '@/core/store'
import { calculateEMA, calculateVWAP } from '@/core/utils/indicators'
import { getNearestExpiry, getStrikesAroundATM } from './instrumentsCache'
import { NIFTY50_KITE_INSTRUMENTS, type Nifty50BreadthResult } from '@/core/utils/nifty50Symbols'

const NIFTY_TOKEN = 256265
const LOT_SIZE = 75

function authHeader() {
  const { apiKey, accessToken } = useSettingsStore.getState()
  return `token ${apiKey}:${accessToken}`
}

// All Kite API calls go through /api/kite Azure Function proxy to avoid CORS.
// kite_path is built manually (not via URLSearchParams) so slashes in paths
// like /instruments/historical/256265/5minute stay unencoded.
function buildKiteUrl(path: string, params?: Record<string, string | string[]>): string {
  // path = '/quote' → kite_path=quote (no leading slash, no %2F encoding)
  let qs = `kite_path=${path.replace(/^\//, '')}`
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (Array.isArray(v)) v.forEach(val => { qs += `&${encodeURIComponent(k)}=${encodeURIComponent(val)}` })
      else qs += `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`
    })
  }
  return `/api/kite?${qs}`
}

async function kiteGet<T>(path: string, params?: Record<string, string | string[]>): Promise<T> {
  const res = await fetch(buildKiteUrl(path, params), {
    headers: { 'X-Kite-Auth': authHeader(), 'X-Kite-Version': '3' },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? `Kite API error ${res.status}`)
  }
  const json = await res.json()
  return (json as { data: T }).data
}

async function kitePost(path: string, body: Record<string, string>): Promise<unknown> {
  const res = await fetch(buildKiteUrl(path), {
    method: 'POST',
    headers: {
      'X-Kite-Auth': authHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? `Kite POST error ${res.status}`)
  }
  const json = await res.json()
  return (json as { data: unknown }).data
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
  private breadthCache = 50 // updated by getNifty50Breadth

  async getNifty50Breadth(): Promise<Nifty50BreadthResult> {
    const data = await kiteGet<Record<string, KiteQuote>>('/quote', {
      i: NIFTY50_KITE_INSTRUMENTS as unknown as string[],
    })

    const stocks = NIFTY50_KITE_INSTRUMENTS.map(sym => {
      const q = data[sym]
      if (!q) return null
      const prevClose = q.ohlc.close
      const bullish = q.last_price > prevClose
      const greenCandle = q.last_price > q.ohlc.open
      const changePct = prevClose > 0 ? ((q.last_price - prevClose) / prevClose) * 100 : 0
      return { symbol: sym.replace('NSE:', ''), bullish, greenCandle, changePct }
    }).filter(Boolean) as Nifty50BreadthResult['stocks']

    const bullishCount = stocks.filter(s => s.bullish).length
    const bearishCount = stocks.filter(s => !s.bullish).length
    const strongBullCount = stocks.filter(s => s.bullish && s.greenCandle).length
    const strongBearCount = stocks.filter(s => !s.bullish && !s.greenCandle).length
    const breadthPct = stocks.length > 0 ? (bullishCount / stocks.length) * 100 : 50

    this.breadthCache = breadthPct

    const result: Nifty50BreadthResult = { bullishCount, bearishCount, strongBullCount, strongBearCount, breadthPct, stocks }

    // push into store so score engine and UI can use it
    try {
      const { useMarketStore } = await import('@/core/store')
      useMarketStore.getState().setNifty50Breadth(result)
    } catch (_) { /* ignore */ }

    return result
  }

  async getNiftyQuote(): Promise<NiftyQuote> {
    const data = await kiteGet<Record<string, KiteQuote>>('/quote', {
      i: ['NSE:NIFTY 50', 'NSE:INDIA VIX'],
    })

    const nifty = data['NSE:NIFTY 50']
    const vix = data['NSE:INDIA VIX']

    this.spotCache = nifty.last_price

    return {
      spot: nifty.last_price,
      change: nifty.change,
      changePct: nifty.ohlc.close > 0 ? (nifty.change / nifty.ohlc.close) * 100 : 0,
      open: nifty.ohlc.open,
      high: nifty.ohlc.high,
      low: nifty.ohlc.low,
      prevClose: nifty.ohlc.close,
      vix: vix?.last_price ?? 14,
      pcr: 1.05,
      breadth: this.breadthCache, // updated by getNifty50Breadth
      vwap: (nifty.ohlc.high + nifty.ohlc.low + nifty.last_price) / 3,
      timestamp: new Date(),
    }
  }

  async getOptionChain(): Promise<OptionChain> {
    const spot = this.spotCache || 24500
    const expiry = await getNearestExpiry()
    const instruments = await getStrikesAroundATM(spot, expiry, 5)

    if (instruments.length === 0) throw new Error('No option instruments found')

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
        iv: 0,
        ltp: q.last_price,
        delta: inst.instrument_type === 'CE' ? 0.5 : -0.5,
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

    const pcr = totalCEOI > 0 ? totalPEOI / totalCEOI : 1
    try {
      const { useMarketStore } = await import('@/core/store')
      const q = useMarketStore.getState().quote
      if (q) useMarketStore.getState().setQuote({ ...q, pcr })
    } catch (_) { /* ignore */ }

    return { expiry, atmStrike: atm, strikes, totalCEOI, totalPEOI, maxPainStrike }
  }

  async getCandles(timeframe = '5minute', count = 30): Promise<Candle[]> {
    const interval = mapTimeframe(timeframe)
    const now = new Date()
    const from = new Date(now.getTime() - count * intervalMs(timeframe) * 2)

    const data = await kiteGet<{ candles: Array<[string, number, number, number, number, number]> }>(
      `/instruments/historical/${NIFTY_TOKEN}/${interval}`,
      { from: formatKiteDate(from), to: formatKiteDate(now), continuous: '0', oi: '0' }
    )

    const candles = data.candles.slice(-count).map(([time, open, high, low, close, volume]) => ({
      time: new Date(time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      open, high, low, close, volume,
    }))

    const closes = candles.map(c => c.close)
    const ema9 = calculateEMA(closes, 9)
    const ema20 = calculateEMA(closes, 20)
    const ema50 = calculateEMA(closes, 50)
    const vwap = calculateVWAP(candles as Candle[])

    return candles.map((c, i) => ({ ...c, ema9: ema9[i], ema20: ema20[i], ema50: ema50[i], vwap: vwap[i] }))
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
    const data = await kitePost('/orders/regular', {
      tradingsymbol: `NIFTY${order.expiry}${order.strike}${order.optionType}`,
      exchange: 'NFO',
      transaction_type: 'BUY',
      order_type: order.orderType,
      product: order.productType,
      quantity: String(order.quantity * LOT_SIZE),
      ...(order.price ? { price: String(order.price) } : {}),
      ...(order.stopLoss ? { trigger_price: String(order.stopLoss) } : {}),
      validity: 'DAY',
    }) as { order_id: string }

    return {
      orderId: data.order_id,
      status: 'COMPLETE',
      message: `Order placed: BUY ${order.quantity} lots NIFTY ${order.strike} ${order.optionType}`,
      timestamp: new Date(),
    }
  }

  async exitPosition(positionId: string): Promise<void> {
    const positions = await this.getPositions()
    const pos = positions.find(p => p.positionId === positionId)
    if (!pos) return

    await kitePost('/orders/regular', {
      tradingsymbol: positionId,
      exchange: 'NFO',
      transaction_type: 'SELL',
      order_type: 'MARKET',
      product: pos.productType,
      quantity: String(pos.quantity),
      validity: 'DAY',
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
