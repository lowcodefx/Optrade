import type { NiftyQuote, OptionChain, Candle, Position, PivotPoints } from '@/core/types'
import type { OrderRequest, OrderResponse, KiteOrder } from '@/core/types'
import type { ITradingService } from './tradingService'
import { useSettingsStore } from '@/core/store'
import { calculateEMA, calculateVWAP } from '@/core/utils/indicators'
import { getNiftyOptions } from './instrumentsCache'
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
  net_change: number      // Zerodha's actual field name (not 'change')
  volume: number
  oi?: number
  oi_day_change?: number  // optional; not all instruments include it
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
    // Use dedicated /api/nifty-quote which hardcodes the exact Kite URL with
    // %20-encoded spaces — the generic proxy's URLSearchParams converts spaces
    // to + which Zerodha does not decode correctly.
    const res = await fetch('/api/nifty-quote', {
      headers: { 'X-Kite-Auth': authHeader() },
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`nifty-quote ${res.status}: ${text.slice(0, 200)}`)

    const json = JSON.parse(text) as { data: Record<string, KiteQuote> }
    const data = json.data ?? {}
    const nifty = data['NSE:NIFTY 50']
    if (!nifty) throw new Error('NIFTY 50 not found in quote response')

    const vix = data['NSE:INDIA VIX']
    this.spotCache = nifty.last_price

    return {
      spot: nifty.last_price,
      change: nifty.net_change ?? 0,
      changePct: nifty.ohlc.close > 0 ? ((nifty.net_change ?? 0) / nifty.ohlc.close) * 100 : 0,
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
    // Single server-side endpoint: fetches instruments + quotes in one shot,
    // with module-level instrument cache so only the first call is slow.
    const res = await fetch(`/api/option-chain?spot=${spot}`, {
      headers: { 'X-Kite-Auth': authHeader(), 'X-Kite-Version': '3' },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error ?? `option-chain ${res.status}`)
    }
    const chain = await res.json() as OptionChain

    const pcr = chain.totalCEOI > 0 ? chain.totalPEOI / chain.totalCEOI : 1
    try {
      const { useMarketStore } = await import('@/core/store')
      const q = useMarketStore.getState().quote
      if (q) useMarketStore.getState().setQuote({ ...q, pcr })
    } catch (_) { /* ignore */ }

    return chain
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
    // Look up exact tradingsymbol from instruments cache (avoids manual date formatting)
    const instruments = await getNiftyOptions()
    const expiry = order.expiry // YYYY-MM-DD from chain
    const inst = instruments.find(
      i => i.expiry === expiry && i.strike === order.strike && i.instrument_type === order.optionType
    ) ?? instruments.find(
      i => i.strike === order.strike && i.instrument_type === order.optionType
    )
    const tradingsymbol = inst?.tradingsymbol ?? `NIFTY${expiry}${order.strike}${order.optionType}`

    // order.quantity is already in shares (OrderEntry sends quantity * 75)
    const data = await kitePost('/orders/regular', {
      tradingsymbol,
      exchange: 'NFO',
      transaction_type: 'BUY',
      order_type: order.orderType,
      product: order.productType,
      quantity: String(order.quantity),
      ...(order.price ? { price: String(order.price) } : {}),
      ...(order.stopLoss ? { trigger_price: String(order.stopLoss) } : {}),
      validity: 'DAY',
    }) as { order_id: string }

    const lots = order.quantity / LOT_SIZE
    return {
      orderId: data.order_id,
      status: 'COMPLETE',
      message: `Order placed: BUY ${lots} lot${lots !== 1 ? 's' : ''} NIFTY ${order.strike} ${order.optionType}`,
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

  async getPivotPoints(): Promise<PivotPoints> {
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - 7) // go back 7 days to skip weekends/holidays

    const data = await kiteGet<{ candles: Array<[string, number, number, number, number, number]> }>(
      `/instruments/historical/${NIFTY_TOKEN}/day`,
      { from: formatKiteDate(from), to: formatKiteDate(to), continuous: '0', oi: '0' }
    )

    const candles = data.candles
    if (candles.length < 2) throw new Error('Insufficient daily candles for pivot')

    // Use the last completed day (skip the ongoing today row)
    const prev = candles[candles.length - 2]
    const [, , prevHigh, prevLow, prevClose] = prev

    const pp = (prevHigh + prevLow + prevClose) / 3
    const r1 = 2 * pp - prevLow
    const r2 = pp + (prevHigh - prevLow)
    const s1 = 2 * pp - prevHigh
    const s2 = pp - (prevHigh - prevLow)

    return { pp, r1, r2, s1, s2, prevHigh, prevLow, prevClose }
  }

  async getOrders(): Promise<KiteOrder[]> {
    const data = await kiteGet<KiteRawOrder[]>('/orders')
    return data
      .filter(o => o.tradingsymbol?.startsWith('NIFTY'))
      .map(o => ({
        orderId: o.order_id,
        tradingsymbol: o.tradingsymbol,
        exchange: o.exchange,
        transactionType: o.transaction_type as 'BUY' | 'SELL',
        orderType: o.order_type as 'MARKET' | 'LIMIT',
        product: o.product as 'MIS' | 'NRML',
        quantity: o.quantity,
        price: o.price,
        averagePrice: o.average_price,
        status: o.status,
        orderTimestamp: o.order_timestamp,
        statusMessage: o.status_message,
      }))
      .reverse() // newest first
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

interface KiteRawOrder {
  order_id: string
  tradingsymbol: string
  exchange: string
  transaction_type: string
  order_type: string
  product: string
  quantity: number
  price: number
  average_price: number
  status: string
  order_timestamp: string
  status_message?: string
}

interface KitePosition {
  tradingsymbol: string
  quantity: number
  average_price: number
  last_price: number
  pnl: number
  product: string
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
