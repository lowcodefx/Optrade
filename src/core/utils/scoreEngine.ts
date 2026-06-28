export interface ScoreBreakdown {
  factor: string
  cePoints: number
  pePoints: number
  maxPoints: number
}

export interface MarketScore {
  ceScore: number   // 0–1000 (after time multiplier)
  peScore: number   // 0–1000
  prediction1h: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' | 'NEUTRAL' | 'NO_TRADE'
  predictionDetail: string
  noTradeReason?: string
  timeMultiplier: number
  breakdown: ScoreBreakdown[]
}

interface ScoreParams {
  spot: number
  vwap: number
  ema9: number
  ema20: number
  ema50: number
  rsi: number
  adx: number
  pcr: number
  breadth: number   // 0–100 pct
  vix: number
  lastCandleGreen: boolean
  volumeAboveAvg: boolean

  // NIFTY 50 constituent breadth
  nifty50Bullish?: number
  nifty50Bearish?: number
  strongBullCount?: number
  strongBearCount?: number

  // Market Structure (Factor 10)
  yesterdayHigh?: number
  yesterdayLow?: number
  openingRangeHigh?: number   // high of 9:15–9:25 candles
  openingRangeLow?: number    // low of 9:15–9:25 candles
  isHigherHigh?: boolean      // recent candles making higher highs
  isHigherLow?: boolean
  isLowerHigh?: boolean
  isLowerLow?: boolean

  // Multi-Timeframe (Factor 11) — optional; 0 pts contributed if absent
  trend15m?: 'bull' | 'bear' | 'neutral'
  trend1h?: 'bull' | 'bear' | 'neutral'

  // OI Change Analysis (Factor 5) — enhances PCR scoring
  ceOIChangeTotal?: number    // sum of CE oiChange across all strikes
  peOIChangeTotal?: number    // sum of PE oiChange across all strikes

  // Time of day (IST) — used for multiplier, not a scored factor
  hour?: number
  minute?: number
}

// ─── Time-of-day multiplier ───────────────────────────────────────────────
// Applied to final raw scores; does not add or subtract points directly.
// Markets have distinct personality at different times of day.
function getTimeMultiplier(hour?: number, minute?: number): number {
  if (hour === undefined || minute === undefined) return 1.0
  const t = hour * 60 + minute
  if (t < 9 * 60 + 25) return 0.80         // 9:15–9:25  opening noise
  if (t < 9 * 60 + 45) return 0.90         // 9:25–9:45  settling
  if (t < 11 * 60)     return 1.00         // 9:45–11:00 prime trend window
  if (t < 12 * 60)     return 0.90         // 11:00–12:00 momentum fading
  if (t < 13 * 60 + 30) return 0.75        // 12:00–1:30  lunch lull
  if (t < 14 * 60)     return 0.85         // 1:30–2:00   recovery
  if (t < 15 * 60 + 15) return 1.00        // 2:00–3:15   afternoon breakout window
  return 0.85                               // 3:15+       closing / expiry
}

export function calculateMarketScore(p: ScoreParams): MarketScore {
  const bd: ScoreBreakdown[] = []
  let ce = 0, pe = 0

  const emaBull = p.ema9 > p.ema20 && p.ema20 > p.ema50
  const emaBear = p.ema9 < p.ema20 && p.ema20 < p.ema50
  const partialBull = !emaBull && !emaBear && p.ema9 > p.ema20
  const partialBear = !emaBull && !emaBear && p.ema9 < p.ema20

  // ── 1. EMA Stack — 175 pts ───────────────────────────────────────────────
  // Full stack (3 EMAs aligned) = full pts. Partial (EMA9/20 aligned) = 40%.
  const cEMA = emaBull ? 175 : partialBull ? 0.4 * 175 : 0
  const pEMA = emaBear ? 175 : partialBear ? 0.4 * 175 : 0
  bd.push({ factor: 'EMA Stack', cePoints: Math.round(cEMA), pePoints: Math.round(pEMA), maxPoints: 175 })
  ce += cEMA; pe += pEMA

  // ── 2. VWAP Position — 140 pts ───────────────────────────────────────────
  // Base 60% for being on the right side; extra 40% scales with distance.
  const vwapDist = Math.min(Math.abs(p.spot - p.vwap) / p.vwap * 100 / 0.5, 1)
  const cVWAP = p.spot > p.vwap ? 140 * (0.6 + 0.4 * vwapDist) : 0
  const pVWAP = p.spot < p.vwap ? 140 * (0.6 + 0.4 * vwapDist) : 0
  bd.push({ factor: 'VWAP', cePoints: Math.round(cVWAP), pePoints: Math.round(pVWAP), maxPoints: 140 })
  ce += cVWAP; pe += pVWAP

  // ── 3. RSI Momentum — 110 pts ────────────────────────────────────────────
  // Linear scale from 50 → 70 (CE) or 50 → 30 (PE). Halved in extreme zones.
  const cRSI = p.rsi >= 50 ? Math.min((p.rsi - 50) / 20, 1) * 110 * (p.rsi < 75 ? 1 : 0.5) : 0
  const pRSI = p.rsi <= 50 ? Math.min((50 - p.rsi) / 20, 1) * 110 * (p.rsi > 25 ? 1 : 0.5) : 0
  bd.push({ factor: 'RSI', cePoints: Math.round(cRSI), pePoints: Math.round(pRSI), maxPoints: 110 })
  ce += cRSI; pe += pRSI

  // ── 4. ADX Trend Strength — 75 pts ───────────────────────────────────────
  // ADX measures trend intensity (not direction). Direction comes from EMA stack.
  const adxStr = Math.min(Math.max(p.adx - 20, 0) / 30, 1)
  const cADX = emaBull ? adxStr * 75 : (emaBear ? 0 : adxStr * 22)
  const pADX = emaBear ? adxStr * 75 : (emaBull ? 0 : adxStr * 22)
  bd.push({ factor: 'ADX', cePoints: Math.round(cADX), pePoints: Math.round(pADX), maxPoints: 75 })
  ce += cADX; pe += pADX

  // ── 5. OI Change Analysis — 100 pts ──────────────────────────────────────
  // When live OI change data is available: weight buildup/covering patterns.
  // Fallback: pure PCR scoring.
  let cOI = 0, pOI = 0
  const hasOI = p.ceOIChangeTotal !== undefined && p.peOIChangeTotal !== undefined
  if (hasOI) {
    const ceC = p.ceOIChangeTotal!
    const peC = p.peOIChangeTotal!
    const scale = 1_000_000   // 10L contracts = full magnitude score
    const putBuildup    = Math.min(Math.max(peC, 0) / scale, 1)   // PE OI up = bullish hedge
    const callBuildup   = Math.min(Math.max(ceC, 0) / scale, 1)   // CE OI up = resistance building
    const callCovering  = Math.min(Math.max(-ceC, 0) / scale, 1)  // CE OI down + price up = shorts exiting
    const putCovering   = Math.min(Math.max(-peC, 0) / scale, 1)  // PE OI down + price down = longs exiting

    cOI = putBuildup * 60 + callCovering * 20
        + (p.pcr >= 1.0 ? Math.min((p.pcr - 1.0) / 0.5, 1) * 20 : 0)
    pOI = callBuildup * 60 + putCovering * 20
        + (p.pcr <= 1.0 ? Math.min((1.0 - p.pcr) / 0.5, 1) * 20 : 0)
  } else {
    // No OI change data — fall back to PCR only
    cOI = p.pcr >= 1.0 ? Math.min((p.pcr - 1.0) / 0.5, 1) * 80 + 20 : 0
    pOI = p.pcr <= 1.0 ? Math.min((1.0 - p.pcr) / 0.5, 1) * 100 : 0
  }
  cOI = Math.min(Math.round(cOI), 100)
  pOI = Math.min(Math.round(pOI), 100)
  bd.push({ factor: 'OI Analysis', cePoints: cOI, pePoints: pOI, maxPoints: 100 })
  ce += cOI; pe += pOI

  // ── 6. VIX — 60 pts ──────────────────────────────────────────────────────
  const cVIX = p.vix < 15 ? 60 : p.vix < 20 ? 60 * (20 - p.vix) / 5 : 0
  const pVIX = p.vix > 20 ? Math.min((p.vix - 20) / 5, 1) * 60 : p.vix > 15 ? 60 * (p.vix - 15) / 5 : 0
  bd.push({ factor: 'VIX', cePoints: Math.round(cVIX), pePoints: Math.round(pVIX), maxPoints: 60 })
  ce += cVIX; pe += pVIX

  // ── 7. Market Breadth (NIFTY 50) — 60 pts ───────────────────────────────
  let cBreadth: number, pBreadth: number
  if (p.nifty50Bullish !== undefined && p.nifty50Bearish !== undefined) {
    const total = (p.nifty50Bullish + p.nifty50Bearish) || 50
    const bullPct = (p.nifty50Bullish / total) * 100
    const bearPct = (p.nifty50Bearish / total) * 100
    const strongBullBonus = p.strongBullCount ? (p.strongBullCount / total) * 15 : 0
    const strongBearBonus = p.strongBearCount ? (p.strongBearCount / total) * 15 : 0
    cBreadth = bullPct > 50 ? Math.min((bullPct - 50) / 20, 1) * 45 + strongBullBonus : 0
    pBreadth = bearPct > 50 ? Math.min((bearPct - 50) / 20, 1) * 45 + strongBearBonus : 0
  } else {
    cBreadth = p.breadth > 50 ? Math.min((p.breadth - 50) / 20, 1) * 60 : 0
    pBreadth = p.breadth < 50 ? Math.min((50 - p.breadth) / 20, 1) * 60 : 0
  }
  bd.push({ factor: 'N50 Breadth', cePoints: Math.round(cBreadth), pePoints: Math.round(pBreadth), maxPoints: 60 })
  ce += cBreadth; pe += pBreadth

  // ── 8. Volume — 35 pts ───────────────────────────────────────────────────
  const cVol = p.volumeAboveAvg && emaBull ? 35 : p.volumeAboveAvg ? 17 : 0
  const pVol = p.volumeAboveAvg && emaBear ? 35 : p.volumeAboveAvg ? 17 : 0
  bd.push({ factor: 'Volume', cePoints: Math.round(cVol), pePoints: Math.round(pVol), maxPoints: 35 })
  ce += cVol; pe += pVol

  // ── 9. Last Candle Direction — 10 pts ────────────────────────────────────
  bd.push({ factor: 'Candle', cePoints: p.lastCandleGreen ? 10 : 0, pePoints: !p.lastCandleGreen ? 10 : 0, maxPoints: 10 })
  ce += p.lastCandleGreen ? 10 : 0
  pe += !p.lastCandleGreen ? 10 : 0

  // ── 10. Market Structure — 135 pts ───────────────────────────────────────
  // Where is price relative to key structural levels?
  // This answers: are we at resistance (bad CE entry) or at support (bad PE entry)?
  let cStr = 0, pStr = 0

  // Yesterday's high/low (55 pts each side)
  if (p.yesterdayHigh !== undefined && p.yesterdayLow !== undefined) {
    if (p.spot > p.yesterdayHigh) cStr += 55       // breakout above prev high = strong bull structure
    else if (p.spot < p.yesterdayLow) pStr += 55   // breakdown below prev low = strong bear structure
    // Approaching levels — softer signal
    else if (p.spot > p.yesterdayHigh * 0.997) pStr += 15   // near resistance, risky for CE
    else if (p.spot < p.yesterdayLow * 1.003) cStr += 15    // near support, risky for PE
  }

  // Opening range breakout/breakdown (40 pts)
  if (p.openingRangeHigh !== undefined && p.openingRangeLow !== undefined) {
    if (p.spot > p.openingRangeHigh) cStr += 40    // above opening range = bullish breakout
    else if (p.spot < p.openingRangeLow) pStr += 40 // below opening range = bearish breakdown
    // Inside opening range — slight dampening (handled by not awarding pts)
  }

  // Swing structure: Higher Highs + Higher Lows = bull trend intact (40 pts)
  if (p.isHigherHigh && p.isHigherLow) cStr += 40
  else if (p.isLowerHigh && p.isLowerLow) pStr += 40
  else if (p.isHigherHigh) cStr += 20
  else if (p.isLowerLow) pStr += 20

  cStr = Math.min(Math.round(cStr), 135)
  pStr = Math.min(Math.round(pStr), 135)
  bd.push({ factor: 'Market Structure', cePoints: cStr, pePoints: pStr, maxPoints: 135 })
  ce += cStr; pe += pStr

  // ── 11. Multi-Timeframe Confirmation — 100 pts ───────────────────────────
  // Higher timeframes override lower timeframes. 5-min bull against 1h bear = no trade.
  // If data unavailable, factor contributes 0 pts (max possible drops to 900).
  let cMTF = 0, pMTF = 0
  const has15m = p.trend15m !== undefined
  const has1h  = p.trend1h  !== undefined

  if (has15m) {
    if (p.trend15m === 'bull') cMTF += 50
    else if (p.trend15m === 'bear') pMTF += 50
    // neutral contributes 0 — no higher-TF confirmation
  }
  if (has1h) {
    if (p.trend1h === 'bull') cMTF += 50
    else if (p.trend1h === 'bear') pMTF += 50
  }

  // Penalty: lower TF fighting higher TFs (e.g. 5m bull but 1h bear)
  if (emaBull && p.trend1h === 'bear') { cMTF -= 20; pMTF += 10 }
  if (emaBear && p.trend1h === 'bull') { pMTF -= 20; cMTF += 10 }

  cMTF = Math.min(Math.max(Math.round(cMTF), 0), 100)
  pMTF = Math.min(Math.max(Math.round(pMTF), 0), 100)
  bd.push({ factor: 'Multi-TF', cePoints: cMTF, pePoints: pMTF, maxPoints: 100 })
  ce += cMTF; pe += pMTF

  // ── Time-of-day multiplier ────────────────────────────────────────────────
  const timeMultiplier = getTimeMultiplier(p.hour, p.minute)
  const rawCE = ce
  const rawPE = pe
  ce = ce * timeMultiplier
  pe = pe * timeMultiplier

  const ceScore = Math.round(Math.min(ce, 1000))
  const peScore = Math.round(Math.min(pe, 1000))

  // ── NO TRADE detection ────────────────────────────────────────────────────
  const gap = Math.abs(ceScore - peScore)
  let noTradeReason: string | undefined

  if (ceScore < 350 && peScore < 350) {
    noTradeReason = 'Both CE and PE scores below 350 — no directional conviction in either direction.'
  } else if (gap < 80 && ceScore < 550 && peScore < 550) {
    noTradeReason = `Mixed signals — CE ${ceScore} vs PE ${peScore} gap only ${gap}. Wait for a clear edge.`
  } else if (p.vix !== undefined && p.vix > 25) {
    noTradeReason = `VIX ${p.vix.toFixed(1)} is elevated. Option premiums are inflated — risk/reward is unfavourable.`
  } else if (timeMultiplier < 0.80) {
    noTradeReason = 'Low-probability time window (9:15–9:25 opening noise). Wait for the market to settle.'
  }

  // ── Prediction label ──────────────────────────────────────────────────────
  let prediction1h: MarketScore['prediction1h']
  let predictionDetail: string

  if (noTradeReason) {
    prediction1h = 'NO_TRADE'
    predictionDetail = noTradeReason
  } else if (ceScore >= 700 && ceScore > peScore + 100) {
    prediction1h = 'BULLISH'
    predictionDetail = `Strong bull — +100 to +200pt rise likely`
  } else if (peScore >= 700 && peScore > ceScore + 100) {
    prediction1h = 'BEARISH'
    predictionDetail = `Strong bear — 100 to 200pt fall likely`
  } else if (ceScore >= 550 && ceScore > peScore) {
    prediction1h = 'BULLISH'
    predictionDetail = `Mild bull bias — cautious CE entry, confirm with structure`
  } else if (peScore >= 550 && peScore > ceScore) {
    prediction1h = 'BEARISH'
    predictionDetail = `Mild bear bias — cautious PE entry, confirm with structure`
  } else if (gap < 100) {
    prediction1h = 'SIDEWAYS'
    predictionDetail = `Mixed signals — range-bound ±50pt expected`
  } else {
    prediction1h = 'NEUTRAL'
    predictionDetail = `No clear signal — wait for confirmation`
  }

  return { ceScore, peScore, prediction1h, predictionDetail, noTradeReason, timeMultiplier, breakdown: bd }
}
