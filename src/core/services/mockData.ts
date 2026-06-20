import type { NiftyQuote, OptionChain, Candle, Position } from '@/core/types'
import { calculateEMA, calculateVWAP } from '@/core/utils/indicators'

const BASE_SPOT = 24650
let currentSpot = BASE_SPOT

function randomWalk(base: number, maxMove = 15): number {
  return base + (Math.random() - 0.48) * maxMove
}

export function getMockNiftyQuote(): NiftyQuote {
  currentSpot = randomWalk(currentSpot, 8)
  const change = currentSpot - 24505
  return {
    spot: Math.round(currentSpot * 100) / 100,
    change: Math.round(change * 100) / 100,
    changePct: Math.round((change / 24505) * 10000) / 100,
    open: 24508,
    high: Math.max(24672, currentSpot),
    low: Math.min(24480, currentSpot),
    prevClose: 24505,
    vix: 14.25 + (Math.random() - 0.5) * 0.5,
    pcr: 1.28 + (Math.random() - 0.5) * 0.2,
    breadth: 65 + (Math.random() - 0.5) * 10,
    vwap: 24580 + (Math.random() - 0.5) * 20,
    timestamp: new Date(),
  }
}

export function getMockOptionChain(spot: number): OptionChain {
  const atmStrike = Math.round(spot / 50) * 50
  const strikes = [-3, -2, -1, 0, 1, 2, 3].map(offset => {
    const strike = atmStrike + offset * 50
    const distFromATM = Math.abs(offset)
    const ceIV = 12 + distFromATM * 0.8 + (Math.random() - 0.5) * 0.4
    const peIV = 12.5 + distFromATM * 0.9 + (Math.random() - 0.5) * 0.4
    const ceLTP = Math.max(5, (atmStrike - strike + 200) * 0.9 + (Math.random() - 0.5) * 10)
    const peLTP = Math.max(5, (strike - atmStrike + 180) * 0.9 + (Math.random() - 0.5) * 10)
    const baseOI = (5 - distFromATM) * 200000
    return {
      strike,
      ce: {
        oi: Math.round(baseOI * (0.9 + Math.random() * 0.3) * (offset < 0 ? 1.5 : 1)),
        oiChange: Math.round((Math.random() - 0.4) * 30000),
        volume: Math.round(baseOI * 0.08 * (1 + Math.random())),
        iv: Math.round(ceIV * 10) / 10,
        ltp: Math.round(ceLTP * 100) / 100,
        delta: Math.max(0.05, Math.min(0.95, 0.5 - offset * 0.12)),
        gamma: Math.round((0.04 - distFromATM * 0.005) * 1000) / 1000,
        theta: Math.round(-(8 + distFromATM * 2) * 10) / 10,
        vega: Math.round((8 - distFromATM * 0.8) * 10) / 10,
      },
      pe: {
        oi: Math.round(baseOI * (0.9 + Math.random() * 0.3) * (offset > 0 ? 1.5 : 1)),
        oiChange: Math.round((Math.random() - 0.4) * 30000),
        volume: Math.round(baseOI * 0.07 * (1 + Math.random())),
        iv: Math.round(peIV * 10) / 10,
        ltp: Math.round(peLTP * 100) / 100,
        delta: Math.max(-0.95, Math.min(-0.05, -0.5 + offset * 0.12)),
        gamma: Math.round((0.04 - distFromATM * 0.005) * 1000) / 1000,
        theta: Math.round(-(7.5 + distFromATM * 2) * 10) / 10,
        vega: Math.round((7.8 - distFromATM * 0.8) * 10) / 10,
      },
    }
  })

  return {
    expiry: '26 Jun 2025',
    atmStrike,
    strikes,
    totalCEOI: strikes.reduce((a, s) => a + s.ce.oi, 0),
    totalPEOI: strikes.reduce((a, s) => a + s.pe.oi, 0),
    maxPainStrike: atmStrike - 50,
  }
}

export function getMockCandles(count = 30): Candle[] {
  const candles: Candle[] = []
  let price = 24508
  for (let i = 0; i < count; i++) {
    const open = price
    const change = (Math.random() - 0.48) * 30
    const close = open + change
    const high = Math.max(open, close) + Math.random() * 15
    const low = Math.min(open, close) - Math.random() * 15
    const volume = Math.round(50000 + Math.random() * 100000)
    const minutesAgo = (count - i) * 5
    const t = new Date(Date.now() - minutesAgo * 60000)
    candles.push({
      time: t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume,
    })
    price = close
  }

  const closes = candles.map(c => c.close)
  const ema9 = calculateEMA(closes, 9)
  const ema20 = calculateEMA(closes, 20)
  const ema50 = calculateEMA(closes, 50)
  const vwaps = calculateVWAP(candles)

  return candles.map((c, i) => ({
    ...c,
    ema9: Math.round(ema9[i] * 100) / 100,
    ema20: Math.round(ema20[i] * 100) / 100,
    ema50: Math.round(ema50[i] * 100) / 100,
    vwap: Math.round(vwaps[i] * 100) / 100,
  }))
}

export function getMockPositions(): Position[] {
  return [
    {
      positionId: 'pos-001',
      symbol: 'NIFTY',
      strike: 24650,
      optionType: 'CE',
      expiry: '26 Jun 2025',
      quantity: 50,
      entryPrice: 165.0,
      ltp: currentSpot > 24650 ? 185.5 + (currentSpot - 24650) * 0.5 : 160,
      pnl: (185.5 - 165) * 50,
      pnlPct: ((185.5 - 165) / 165) * 100,
      productType: 'MIS',
      entryTime: new Date(Date.now() - 45 * 60000),
      stopLoss: 140,
      target: 235,
    },
  ]
}
