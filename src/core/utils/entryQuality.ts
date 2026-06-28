import type { Candle } from '@/core/types'

export interface EntryQualitySignal {
  name: string
  points: number
  maxPoints: number
  passed: boolean
  detail: string
}

export interface EntryQualityResult {
  score: number   // 0–100
  label: 'poor' | 'fair' | 'good' | 'excellent'
  signals: EntryQualitySignal[]
}

interface EntryQualityParams {
  candles: Candle[]
  emaBull: boolean
  emaBear: boolean
  volumeAboveAvg: boolean
}

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0
}

function computeATR(candles: Candle[], period = 10): number {
  const trs: number[] = []
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high, low = candles[i].low, prevClose = candles[i - 1].close
    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)))
  }
  const slice = trs.slice(-period)
  return slice.length ? avg(slice) : 0
}

export function calculateEntryQuality(p: EntryQualityParams): EntryQualityResult {
  const signals: EntryQualitySignal[] = []
  const { candles, emaBull, emaBear } = p

  if (candles.length < 3) {
    return { score: 0, label: 'poor', signals: [] }
  }

  const last  = candles[candles.length - 1]
  const prev  = candles[candles.length - 2]
  const prev2 = candles[candles.length - 3]

  const candleRange = last.high - last.low
  const body        = Math.abs(last.close - last.open)
  const upperWick   = last.high - Math.max(last.close, last.open)
  const lowerWick   = Math.min(last.close, last.open) - last.low
  const bodyRatio   = candleRange > 0 ? body / candleRange : 0
  const closePos    = candleRange > 0 ? (last.close - last.low) / candleRange : 0.5

  // 1. Breakout candle (20pts) — strong directional candle body > 60% of range
  const breakoutPassed = bodyRatio > 0.60 && (emaBull ? last.close > last.open : last.close < last.open)
  const breakoutPts    = breakoutPassed ? 20 : bodyRatio > 0.40 ? 10 : 0
  signals.push({
    name: 'Breakout Candle',
    points: breakoutPts, maxPoints: 20, passed: breakoutPassed,
    detail: `Body ${Math.round(bodyRatio * 100)}% of range`,
  })

  // 2. Momentum continuation (20pts) — last 2 candles in trend direction
  const bullCont = emaBull  && prev.close > prev.open  && prev2.close > prev2.open
  const bearCont = emaBear  && prev.close < prev.open  && prev2.close < prev2.open
  const contPts  = (bullCont || bearCont) ? 20 : 10
  signals.push({
    name: 'Momentum Continuity',
    points: contPts, maxPoints: 20, passed: bullCont || bearCont,
    detail: bullCont ? 'Consecutive green candles' : bearCont ? 'Consecutive red candles' : 'Mixed candles',
  })

  // 3. Candle close quality (15pts) — CE: closes in upper 35%; PE: closes in lower 35%
  const closeOk  = emaBull ? closePos >= 0.65 : emaBear ? closePos <= 0.35 : false
  const closePts = closeOk ? 15 : emaBull && closePos >= 0.50 ? 7 : emaBear && closePos <= 0.50 ? 7 : 0
  signals.push({
    name: 'Close Position',
    points: closePts, maxPoints: 15, passed: closeOk,
    detail: `Close at ${Math.round(closePos * 100)}% of candle range`,
  })

  // 4. No reversal wick (15pts) — CE: upper wick < 30% of range; PE: lower wick < 30%
  const wickRatio = candleRange > 0 ? (emaBull ? upperWick / candleRange : lowerWick / candleRange) : 0
  const wickOk    = wickRatio < 0.30
  const wickPts   = wickOk ? 15 : wickRatio < 0.50 ? 7 : 0
  signals.push({
    name: 'Wick Check',
    points: wickPts, maxPoints: 15, passed: wickOk,
    detail: `${emaBull ? 'Upper' : 'Lower'} wick ${Math.round(wickRatio * 100)}% of range`,
  })

  // 5. ATR expansion (15pts) — last candle range > avg ATR (momentum expanding)
  const atr       = computeATR(candles)
  const atrOk     = atr > 0 && candleRange > atr * 1.2
  const atrPts    = atrOk ? 15 : atr > 0 && candleRange > atr * 0.8 ? 7 : 0
  signals.push({
    name: 'ATR Expansion',
    points: atrPts, maxPoints: 15, passed: atrOk,
    detail: `Range ${candleRange.toFixed(0)} vs ATR ${atr.toFixed(0)}`,
  })

  // 6. Volume confirmation (15pts) — current candle volume > 1.3× recent average
  const recentVols = candles.slice(-6, -1).map(c => c.volume)
  const avgVol     = avg(recentVols)
  const volRatio   = avgVol > 0 ? last.volume / avgVol : 1
  const volOk      = volRatio >= 1.3
  const volPts     = volOk ? 15 : volRatio >= 1.0 ? 7 : 0
  signals.push({
    name: 'Volume Spike',
    points: volPts, maxPoints: 15, passed: volOk,
    detail: `${volRatio.toFixed(1)}× average volume`,
  })

  const score = signals.reduce((s, sig) => s + sig.points, 0)
  const label: EntryQualityResult['label'] =
    score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 35 ? 'fair' : 'poor'

  return { score, label, signals }
}
