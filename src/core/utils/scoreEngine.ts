export interface ScoreBreakdown {
  factor: string
  cePoints: number
  pePoints: number
  maxPoints: number
}

export interface MarketScore {
  ceScore: number
  peScore: number
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
  breadth: number
  vix: number
  lastCandleGreen: boolean
  volumeAboveAvg: boolean

  // NIFTY 50 constituent breadth
  nifty50Bullish?: number
  nifty50Bearish?: number
  strongBullCount?: number
  strongBearCount?: number

  // Market Structure: key price levels
  yesterdayHigh?: number
  yesterdayLow?: number
  openingRangeHigh?: number
  openingRangeLow?: number
  isHigherHigh?: boolean
  isHigherLow?: boolean
  isLowerHigh?: boolean
  isLowerLow?: boolean

  // Market Structure: pivot points for S/R sub-factor
  pivotPP?: number
  pivotR1?: number
  pivotR2?: number
  pivotS1?: number
  pivotS2?: number

  // OI: strikes with maximum call and put open interest
  maxCEOIStrike?: number
  maxPEOIStrike?: number

  // Multi-Timeframe
  trend15m?: 'bull' | 'bear' | 'neutral'
  trend1h?: 'bull' | 'bear' | 'neutral'

  // OI Change totals across all strikes in chain
  ceOIChangeTotal?: number
  peOIChangeTotal?: number

  // Time of day (IST) for multiplier
  hour?: number
  minute?: number
}

function getTimeMultiplier(hour?: number, minute?: number): number {
  if (hour === undefined || minute === undefined) return 1.0
  const t = hour * 60 + minute
  if (t < 9 * 60 + 25)  return 0.80   // 9:15–9:25  opening noise
  if (t < 9 * 60 + 45)  return 0.90   // 9:25–9:45  settling
  if (t < 11 * 60)      return 1.00   // 9:45–11:00 prime trend window
  if (t < 12 * 60)      return 0.90   // 11:00–12:00
  if (t < 13 * 60 + 30) return 0.75   // 12:00–1:30  lunch lull
  if (t < 14 * 60)      return 0.85   // 1:30–2:00   recovering
  if (t < 15 * 60 + 15) return 1.00   // 2:00–3:15   afternoon breakout
  return 0.85                          // 3:15+       closing
}

export function calculateMarketScore(p: ScoreParams): MarketScore {
  const bd: ScoreBreakdown[] = []
  let ce = 0, pe = 0

  const emaBull = p.ema9 > p.ema20 && p.ema20 > p.ema50
  const emaBear = p.ema9 < p.ema20 && p.ema20 < p.ema50
  const partialBull = !emaBull && !emaBear && p.ema9 > p.ema20
  const partialBear = !emaBull && !emaBear && p.ema9 < p.ema20

  // ── 1. EMA Stack — 175 pts ────────────────────────────────────────────────
  const cEMA = emaBull ? 175 : partialBull ? 0.4 * 175 : 0
  const pEMA = emaBear ? 175 : partialBear ? 0.4 * 175 : 0
  bd.push({ factor: 'EMA Stack', cePoints: Math.round(cEMA), pePoints: Math.round(pEMA), maxPoints: 175 })
  ce += cEMA; pe += pEMA

  // ── 2. VWAP Position — 140 pts ────────────────────────────────────────────
  const vwapDist = Math.min(Math.abs(p.spot - p.vwap) / p.vwap * 100 / 0.5, 1)
  const cVWAP = p.spot > p.vwap ? 140 * (0.6 + 0.4 * vwapDist) : 0
  const pVWAP = p.spot < p.vwap ? 140 * (0.6 + 0.4 * vwapDist) : 0
  bd.push({ factor: 'VWAP', cePoints: Math.round(cVWAP), pePoints: Math.round(pVWAP), maxPoints: 140 })
  ce += cVWAP; pe += pVWAP

  // ── 3. RSI Momentum — 110 pts ─────────────────────────────────────────────
  const cRSI = p.rsi >= 50 ? Math.min((p.rsi - 50) / 20, 1) * 110 * (p.rsi < 75 ? 1 : 0.5) : 0
  const pRSI = p.rsi <= 50 ? Math.min((50 - p.rsi) / 20, 1) * 110 * (p.rsi > 25 ? 1 : 0.5) : 0
  bd.push({ factor: 'RSI', cePoints: Math.round(cRSI), pePoints: Math.round(pRSI), maxPoints: 110 })
  ce += cRSI; pe += pRSI

  // ── 4. ADX Trend Strength — 75 pts ───────────────────────────────────────
  const adxStr = Math.min(Math.max(p.adx - 20, 0) / 30, 1)
  const cADX = emaBull ? adxStr * 75 : (emaBear ? 0 : adxStr * 22)
  const pADX = emaBear ? adxStr * 75 : (emaBull ? 0 : adxStr * 22)
  bd.push({ factor: 'ADX', cePoints: Math.round(cADX), pePoints: Math.round(pADX), maxPoints: 75 })
  ce += cADX; pe += pADX

  // ── 5–8. OI Change Analysis — 100 pts total (4 sub-factors × 25) ─────────
  const hasOI = p.ceOIChangeTotal !== undefined && p.peOIChangeTotal !== undefined
  const ceC   = hasOI ? p.ceOIChangeTotal! : 0
  const peC   = hasOI ? p.peOIChangeTotal! : 0
  const scale = 500_000   // 5L contracts = meaningful OI move

  // 5. Call OI Change (25pts) — call writing (CE↑) = bearish; covering (CE↓) = bullish
  let cCallOI = 0, pCallOI = 0
  if (hasOI) {
    if (ceC > 0) pCallOI = Math.min(Math.round(ceC / scale * 25), 25)   // call writing → PE
    else         cCallOI = Math.min(Math.round(-ceC / scale * 15), 15)   // call covering → CE
  } else {
    cCallOI = p.pcr >= 1.0 ? Math.round(Math.min((p.pcr - 1.0) / 0.5, 1) * 15) : 0
    pCallOI = p.pcr <= 1.0 ? Math.round(Math.min((1.0 - p.pcr) / 0.5, 1) * 25) : 0
  }
  bd.push({ factor: 'OI: Call Change', cePoints: cCallOI, pePoints: pCallOI, maxPoints: 25 })
  ce += cCallOI; pe += pCallOI

  // 6. Put OI Change (25pts) — put writing (PE↑) = bullish; covering (PE↓) = bearish
  let cPutOI = 0, pPutOI = 0
  if (hasOI) {
    if (peC > 0) cPutOI = Math.min(Math.round(peC / scale * 25), 25)    // put writing → CE
    else         pPutOI = Math.min(Math.round(-peC / scale * 15), 15)    // put covering → PE
  } else {
    cPutOI = p.pcr >= 1.0 ? Math.round(Math.min((p.pcr - 1.0) / 0.5, 1) * 25) : 0
    pPutOI = p.pcr <= 1.0 ? Math.round(Math.min((1.0 - p.pcr) / 0.5, 1) * 15) : 0
  }
  bd.push({ factor: 'OI: Put Change', cePoints: cPutOI, pePoints: pPutOI, maxPoints: 25 })
  ce += cPutOI; pe += pPutOI

  // 7. Build-up Pattern (25pts) — net flow: puts outweigh calls = bullish
  let cBuild = 0, pBuild = 0
  if (hasOI) {
    const netBull = peC - ceC   // positive = more puts written than calls
    if (netBull > 0) cBuild = Math.min(Math.round(netBull / (scale * 2) * 25), 25)
    else             pBuild = Math.min(Math.round(-netBull / (scale * 2) * 25), 25)
  }
  bd.push({ factor: 'OI: Build-up', cePoints: cBuild, pePoints: pBuild, maxPoints: 25 })
  ce += cBuild; pe += pBuild

  // 8. OI S/R Shift (25pts) — max OI strike positions + PCR
  let cOISR = 0, pOISR = 0
  if (p.maxPEOIStrike !== undefined && p.maxCEOIStrike !== undefined) {
    if (p.maxPEOIStrike < p.spot)  cOISR += 12   // put wall below spot = support → bullish
    if (p.maxPEOIStrike > p.spot)  pOISR += 12   // put wall above spot = hedge → bearish
    if (p.maxCEOIStrike < p.spot)  cOISR += 8    // blown past call wall = bullish
    if (p.maxCEOIStrike > p.spot)  pOISR += 5    // call wall overhead = resistance
  }
  // PCR as supplement
  cOISR += p.pcr >= 1.0 ? Math.round(Math.min((p.pcr - 1.0) / 0.5, 1) * 5) : 0
  pOISR += p.pcr <= 1.0 ? Math.round(Math.min((1.0 - p.pcr) / 0.5, 1) * 5) : 0
  cOISR = Math.min(cOISR, 25)
  pOISR = Math.min(pOISR, 25)
  bd.push({ factor: 'OI: S/R Shift', cePoints: cOISR, pePoints: pOISR, maxPoints: 25 })
  ce += cOISR; pe += pOISR

  // ── 9. VIX — 60 pts ──────────────────────────────────────────────────────
  const cVIX = p.vix < 15 ? 60 : p.vix < 20 ? 60 * (20 - p.vix) / 5 : 0
  const pVIX = p.vix > 20 ? Math.min((p.vix - 20) / 5, 1) * 60 : p.vix > 15 ? 60 * (p.vix - 15) / 5 : 0
  bd.push({ factor: 'VIX', cePoints: Math.round(cVIX), pePoints: Math.round(pVIX), maxPoints: 60 })
  ce += cVIX; pe += pVIX

  // ── 10. Market Breadth — 60 pts ───────────────────────────────────────────
  let cBreadth: number, pBreadth: number
  if (p.nifty50Bullish !== undefined && p.nifty50Bearish !== undefined) {
    const total = (p.nifty50Bullish + p.nifty50Bearish) || 50
    const bullPct = (p.nifty50Bullish / total) * 100
    const bearPct = (p.nifty50Bearish / total) * 100
    const sBullBonus = p.strongBullCount ? (p.strongBullCount / total) * 15 : 0
    const sBearBonus = p.strongBearCount ? (p.strongBearCount / total) * 15 : 0
    cBreadth = bullPct > 50 ? Math.min((bullPct - 50) / 20, 1) * 45 + sBullBonus : 0
    pBreadth = bearPct > 50 ? Math.min((bearPct - 50) / 20, 1) * 45 + sBearBonus : 0
  } else {
    cBreadth = p.breadth > 50 ? Math.min((p.breadth - 50) / 20, 1) * 60 : 0
    pBreadth = p.breadth < 50 ? Math.min((50 - p.breadth) / 20, 1) * 60 : 0
  }
  bd.push({ factor: 'N50 Breadth', cePoints: Math.round(cBreadth), pePoints: Math.round(pBreadth), maxPoints: 60 })
  ce += cBreadth; pe += pBreadth

  // ── 11. Volume — 35 pts ───────────────────────────────────────────────────
  const cVol = p.volumeAboveAvg && emaBull ? 35 : p.volumeAboveAvg ? 17 : 0
  const pVol = p.volumeAboveAvg && emaBear ? 35 : p.volumeAboveAvg ? 17 : 0
  bd.push({ factor: 'Volume', cePoints: Math.round(cVol), pePoints: Math.round(pVol), maxPoints: 35 })
  ce += cVol; pe += pVol

  // ── 12. Last Candle — 10 pts ──────────────────────────────────────────────
  bd.push({ factor: 'Candle', cePoints: p.lastCandleGreen ? 10 : 0, pePoints: !p.lastCandleGreen ? 10 : 0, maxPoints: 10 })
  ce += p.lastCandleGreen ? 10 : 0
  pe += !p.lastCandleGreen ? 10 : 0

  // ── 13–16. Market Structure — 135 pts total (4 sub-factors) ──────────────

  // 13. Previous Day High/Low — 35 pts
  let cPDH = 0, pPDL = 0
  if (p.yesterdayHigh !== undefined && p.yesterdayLow !== undefined) {
    if (p.spot > p.yesterdayHigh) cPDH = 35
    else if (p.spot < p.yesterdayLow) pPDL = 35
    // Near yesterday high/low but not through — slight signal
    else if (p.spot >= p.yesterdayHigh * 0.998) cPDH = 10   // testing PDH
    else if (p.spot <= p.yesterdayLow * 1.002) pPDL = 10    // testing PDL
  }
  bd.push({ factor: 'Structure: PDH/PDL', cePoints: cPDH, pePoints: pPDL, maxPoints: 35 })
  ce += cPDH; pe += pPDL

  // 14. Opening Range Breakout — 30 pts
  let cORB = 0, pORB = 0
  if (p.openingRangeHigh !== undefined && p.openingRangeLow !== undefined) {
    if (p.spot > p.openingRangeHigh)      cORB = 30
    else if (p.spot < p.openingRangeLow)  pORB = 30
    // Inside opening range: no pts (indecision)
  }
  bd.push({ factor: 'Structure: ORB', cePoints: cORB, pePoints: pORB, maxPoints: 30 })
  ce += cORB; pe += pORB

  // 15. Support / Resistance Position — 35 pts (pivot levels)
  let cSR = 0, pSR = 0
  if (p.pivotPP !== undefined && p.pivotR1 !== undefined && p.pivotS1 !== undefined) {
    if (p.spot > p.pivotR1) cSR = 35                         // above R1 = bull breakout
    else if (p.spot > p.pivotPP) cSR = 20                   // above PP but below R1 = mild bull
    else if (p.spot < p.pivotS1) pSR = 35                   // below S1 = bear breakdown
    else pSR = 20                                             // below PP but above S1 = mild bear

    // Approaching resistance: deduct for CE (buying near resistance is risky)
    if (p.pivotR1 > 0 && Math.abs(p.spot - p.pivotR1) / p.pivotR1 < 0.002) {
      cSR = Math.max(cSR - 15, 0); pSR = Math.min(pSR + 10, 35)
    }
    // Approaching support: deduct for PE
    if (p.pivotS1 > 0 && Math.abs(p.spot - p.pivotS1) / p.pivotS1 < 0.002) {
      pSR = Math.max(pSR - 15, 0); cSR = Math.min(cSR + 10, 35)
    }
  }
  bd.push({ factor: 'Structure: S/R', cePoints: Math.round(cSR), pePoints: Math.round(pSR), maxPoints: 35 })
  ce += cSR; pe += pSR

  // 16. HH/HL — LH/LL Trend Structure — 35 pts
  let cHHHL = 0, pLHLL = 0
  if (p.isHigherHigh && p.isHigherLow)     cHHHL = 35
  else if (p.isLowerHigh && p.isLowerLow)  pLHLL = 35
  else if (p.isHigherHigh)                 cHHHL = 20
  else if (p.isLowerLow)                   pLHLL = 20
  bd.push({ factor: 'Structure: HH/HL', cePoints: cHHHL, pePoints: pLHLL, maxPoints: 35 })
  ce += cHHHL; pe += pLHLL

  // ── 17–19. Multi-Timeframe — 100 pts total (3 sub-factors) ───────────────

  // 17. 5m vs 15m Alignment — 40 pts
  let cMTF5 = 0, pMTF5 = 0
  if (p.trend15m) {
    const bull15m = p.trend15m === 'bull', bear15m = p.trend15m === 'bear'
    if (emaBull && bull15m)  cMTF5 = 40
    else if (emaBear && bear15m) pMTF5 = 40
    // 5m and 15m disagree — small counter-trend pts
    else if (emaBull && bear15m) pMTF5 = 10
    else if (emaBear && bull15m) cMTF5 = 10
  }
  bd.push({ factor: 'MTF: 5m vs 15m', cePoints: cMTF5, pePoints: pMTF5, maxPoints: 40 })
  ce += cMTF5; pe += pMTF5

  // 18. 15m Trend — 35 pts
  let cMTF15 = 0, pMTF15 = 0
  if (p.trend15m === 'bull')  cMTF15 = 35
  else if (p.trend15m === 'bear') pMTF15 = 35
  bd.push({ factor: 'MTF: 15m Trend', cePoints: cMTF15, pePoints: pMTF15, maxPoints: 35 })
  ce += cMTF15; pe += pMTF15

  // 19. 1h Trend — 25 pts
  let cMTF1h = 0, pMTF1h = 0
  if (p.trend1h === 'bull')  cMTF1h = 25
  else if (p.trend1h === 'bear') pMTF1h = 25
  bd.push({ factor: 'MTF: 1h Trend', cePoints: cMTF1h, pePoints: pMTF1h, maxPoints: 25 })
  ce += cMTF1h; pe += pMTF1h

  // ── Time-of-day multiplier ────────────────────────────────────────────────
  const timeMultiplier = getTimeMultiplier(p.hour, p.minute)
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
    noTradeReason = `Mixed signals — CE ${ceScore} vs PE ${peScore} (gap ${gap}). Wait for a clear edge.`
  } else if (p.vix !== undefined && p.vix > 25) {
    noTradeReason = `VIX ${p.vix.toFixed(1)} is elevated. Option premiums are inflated — risk/reward unfavourable.`
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
    predictionDetail = 'Strong bull — +100 to +200pt rise likely'
  } else if (peScore >= 700 && peScore > ceScore + 100) {
    prediction1h = 'BEARISH'
    predictionDetail = 'Strong bear — 100 to 200pt fall likely'
  } else if (ceScore >= 550 && ceScore > peScore) {
    prediction1h = 'BULLISH'
    predictionDetail = 'Mild bull bias — cautious CE entry, confirm with structure'
  } else if (peScore >= 550 && peScore > ceScore) {
    prediction1h = 'BEARISH'
    predictionDetail = 'Mild bear bias — cautious PE entry, confirm with structure'
  } else if (gap < 100) {
    prediction1h = 'SIDEWAYS'
    predictionDetail = 'Mixed signals — range-bound ±50pt expected'
  } else {
    prediction1h = 'NEUTRAL'
    predictionDetail = 'No clear signal — wait for confirmation'
  }

  return { ceScore, peScore, prediction1h, predictionDetail, noTradeReason, timeMultiplier, breakdown: bd }
}
