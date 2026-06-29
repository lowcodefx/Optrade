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

    // Shooting Star (bearish)
    if (currBody > 0 && upperWick > currBody * 2 && lowerWick < currBody * 0.5) {
      results.push({ pattern: 'ShootingStar', direction: 'bearish', candleIndex: i, label: '⭐ Shooting Star' })
    }

    // Inside Bar
    if (curr.high < prev.high && curr.low > prev.low) {
      results.push({ pattern: 'InsideBar', direction: 'neutral', candleIndex: i, label: '⚡ Inside Bar' })
    }
  }

  // EMA Crossover
  const last = candles[candles.length - 1]
  const secondLast = candles[candles.length - 2]
  if (last.ema9 && last.ema20 && secondLast.ema9 && secondLast.ema20) {
    if (secondLast.ema9 <= secondLast.ema20 && last.ema9 > last.ema20) {
      results.push({ pattern: 'EMACrossover', direction: 'bullish', candleIndex: candles.length - 1, label: '★ EMA Crossover ↑' })
    }
    if (secondLast.ema9 >= secondLast.ema20 && last.ema9 < last.ema20) {
      results.push({ pattern: 'EMACrossover', direction: 'bearish', candleIndex: candles.length - 1, label: '★ EMA Crossover ↓' })
    }
  }

  return results
}

export function buildPriceActionSetup(
  candles: Candle[],
  patterns: PatternResult[],
  spot: number,
  // Market prediction bias — when set, counter-trend candle signals are suppressed
  marketBias?: 'bullish' | 'bearish',
) {
  const bullishPatterns = patterns.filter(p => p.direction === 'bullish')
  const bearishPatterns = patterns.filter(p => p.direction === 'bearish')

  // Determine raw direction from pattern count (majority wins)
  const rawDirection: 'bullish' | 'bearish' | 'neutral' =
    bullishPatterns.length > bearishPatterns.length ? 'bullish'
    : bearishPatterns.length > bullishPatterns.length ? 'bearish'
    : bullishPatterns.length > 0 ? 'bullish' // tie — default to whichever exists
    : 'neutral'

  // If market bias contradicts pattern direction → counter-trend, suppress setup
  // A counter-trend candle pattern in a strong trend is noise, not signal
  let direction: 'bullish' | 'bearish' | 'neutral' = rawDirection
  let isCounterTrend = false

  if (marketBias && rawDirection !== 'neutral' && rawDirection !== marketBias) {
    // Pattern says one thing, market says another — treat as neutral (no setup)
    direction = 'neutral'
    isCounterTrend = true
  } else if (marketBias && rawDirection === 'neutral') {
    // No clear pattern but market has a bias — don't generate a setup
    direction = 'neutral'
  }

  // Filter to patterns that match the resolved direction
  const relevantPatterns = direction === 'neutral'
    ? patterns
    : patterns.filter(p => p.direction === direction || p.direction === 'neutral')

  const confirmingCount = direction === 'bullish' ? bullishPatterns.length
    : direction === 'bearish' ? bearishPatterns.length
    : 0

  // Confidence: base 50 + confirming patterns. Capped at 95.
  // Counter-trend or no-setup situations get 0.
  const confidence = direction === 'neutral' ? 0 : Math.min(50 + confirmingCount * 15, 95)

  const swingLow  = Math.min(...candles.slice(-10).map(c => c.low))
  const swingHigh = Math.max(...candles.slice(-10).map(c => c.high))
  const sl        = direction === 'bullish' ? Math.round(swingLow / 50) * 50 : Math.round(swingHigh / 50) * 50
  const slDist    = Math.abs(spot - sl)
  const target    = direction === 'bullish' ? spot + slDist * 2 : spot - slDist * 2
  const entry     = spot
  const optionEntry  = direction === 'bullish' ? 185 : 185
  const optionSL     = Math.round(optionEntry * 0.84)
  const optionTarget = Math.round(optionEntry * 1.27)

  return {
    patterns: relevantPatterns,
    direction,
    isCounterTrend,
    confidence,
    entry,
    sl,
    target: Math.round(target / 50) * 50,
    rr: 2.0,
    optionEntry,
    optionSL,
    optionTarget,
    supportLevel: swingLow,
    resistanceLevel: swingHigh,
  }
}
