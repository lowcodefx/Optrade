import type { Candle, PatternResult } from '@/core/types'

export function detectPatterns(candles: Candle[]): PatternResult[] {
  const results: PatternResult[] = []
  if (candles.length < 2) return results

  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i]
    const prev = candles[i - 1]
    const currBody = Math.abs(curr.close - curr.open)
    const prevBody = Math.abs(prev.close - prev.open)
    const currRange = curr.high - curr.low
    const prevIsRed = prev.close < prev.open
    const currIsGreen = curr.close > curr.open

    // Bullish Engulfing
    if (prevIsRed && currIsGreen && curr.open <= prev.close && curr.close >= prev.open && currBody > prevBody) {
      results.push({ pattern: 'BullishEngulfing', direction: 'bullish', candleIndex: i, label: '▲ Bullish Engulfing' })
    }

    // Bearish Engulfing
    if (!prevIsRed && !currIsGreen && curr.open >= prev.close && curr.close <= prev.open && currBody > prevBody) {
      results.push({ pattern: 'BearishEngulfing', direction: 'bearish', candleIndex: i, label: '▼ Bearish Engulfing' })
    }

    // Doji
    if (currRange > 0 && currBody / currRange < 0.1) {
      results.push({ pattern: 'Doji', direction: 'neutral', candleIndex: i, label: '◆ Doji' })
    }

    // Hammer (bullish)
    const lowerWick = Math.min(curr.open, curr.close) - curr.low
    const upperWick = curr.high - Math.max(curr.open, curr.close)
    if (currBody > 0 && lowerWick > currBody * 2 && upperWick < currBody * 0.5) {
      results.push({ pattern: 'Hammer', direction: 'bullish', candleIndex: i, label: '🔨 Hammer' })
    }

    // Inside Bar
    if (curr.high < prev.high && curr.low > prev.low) {
      results.push({ pattern: 'InsideBar', direction: 'neutral', candleIndex: i, label: '⚡ Inside Bar' })
    }
  }

  // EMA Crossover — detect if last candle crosses EMA9 > EMA20
  const last = candles[candles.length - 1]
  const secondLast = candles[candles.length - 2]
  if (last.ema9 && last.ema20 && secondLast.ema9 && secondLast.ema20) {
    if (secondLast.ema9 <= secondLast.ema20 && last.ema9 > last.ema20) {
      results.push({ pattern: 'EMACrossover', direction: 'bullish', candleIndex: candles.length - 1, label: '★ EMA Crossover' })
    }
  }

  return results
}

export function buildPriceActionSetup(candles: Candle[], patterns: PatternResult[], spot: number) {
  const bullishPatterns = patterns.filter(p => p.direction === 'bullish')
  const direction: 'bullish' | 'bearish' | 'neutral' = bullishPatterns.length > 0 ? 'bullish' : patterns.some(p => p.direction === 'bearish') ? 'bearish' : 'neutral'
  const confidence = Math.min(50 + bullishPatterns.length * 15, 95)

  const swingLow = Math.min(...candles.slice(-10).map(c => c.low))
  const swingHigh = Math.max(...candles.slice(-10).map(c => c.high))
  const sl = direction === 'bullish' ? Math.round(swingLow / 50) * 50 : Math.round(swingHigh / 50) * 50
  const slDist = Math.abs(spot - sl)
  const target = direction === 'bullish' ? spot + slDist * 1.7 : spot - slDist * 1.7
  const entry = spot
  const optionEntry = direction === 'bullish' ? 185 : 142
  const optionSL = Math.round(optionEntry * 0.84)
  const optionTarget = Math.round(optionEntry * 1.27)

  return {
    patterns,
    direction,
    confidence,
    entry,
    sl,
    target: Math.round(target / 50) * 50,
    rr: 1.7,
    optionEntry,
    optionSL,
    optionTarget,
    supportLevel: swingLow,
    resistanceLevel: swingHigh,
  }
}
