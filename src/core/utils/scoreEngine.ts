export interface ScoreBreakdown {
  factor: string
  cePoints: number
  pePoints: number
  maxPoints: number
}

export interface MarketScore {
  ceScore: number   // 0–1000
  peScore: number   // 0–1000
  prediction1h: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' | 'NEUTRAL'
  predictionDetail: string
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
}

export function calculateMarketScore(p: ScoreParams): MarketScore {
  const bd: ScoreBreakdown[] = []
  let ce = 0, pe = 0

  const emaBull = p.ema9 > p.ema20 && p.ema20 > p.ema50
  const emaBear = p.ema9 < p.ema20 && p.ema20 < p.ema50
  const partialEma = (!emaBull && !emaBear) ? (p.ema9 > p.ema20 ? 0.4 : 0) : 0

  // 1. EMA Stack — 220 pts
  const cEMA = emaBull ? 220 : partialEma * 220
  const pEMA = emaBear ? 220 : ((!emaBull && !emaBear) && p.ema9 < p.ema20 ? 0.4 * 220 : 0)
  bd.push({ factor: 'EMA Stack', cePoints: Math.round(cEMA), pePoints: Math.round(pEMA), maxPoints: 220 })
  ce += cEMA; pe += pEMA

  // 2. VWAP Position — 180 pts
  const vwapDist = Math.min(Math.abs(p.spot - p.vwap) / p.vwap * 100 / 0.5, 1)
  const cVWAP = p.spot > p.vwap ? 180 * (0.6 + 0.4 * vwapDist) : 0
  const pVWAP = p.spot < p.vwap ? 180 * (0.6 + 0.4 * vwapDist) : 0
  bd.push({ factor: 'VWAP', cePoints: Math.round(cVWAP), pePoints: Math.round(pVWAP), maxPoints: 180 })
  ce += cVWAP; pe += pVWAP

  // 3. RSI Momentum — 150 pts
  const cRSI = p.rsi >= 50 ? Math.min((p.rsi - 50) / 20, 1) * 150 * (p.rsi < 75 ? 1 : 0.5) : 0
  const pRSI = p.rsi <= 50 ? Math.min((50 - p.rsi) / 20, 1) * 150 * (p.rsi > 25 ? 1 : 0.5) : 0
  bd.push({ factor: 'RSI', cePoints: Math.round(cRSI), pePoints: Math.round(pRSI), maxPoints: 150 })
  ce += cRSI; pe += pRSI

  // 4. ADX Trend Strength — 100 pts (directional)
  const adxStr = Math.min(Math.max(p.adx - 20, 0) / 30, 1)
  const cADX = emaBull ? adxStr * 100 : (emaBear ? 0 : adxStr * 30)
  const pADX = emaBear ? adxStr * 100 : (emaBull ? 0 : adxStr * 30)
  bd.push({ factor: 'ADX', cePoints: Math.round(cADX), pePoints: Math.round(pADX), maxPoints: 100 })
  ce += cADX; pe += pADX

  // 5. PCR — 120 pts
  const cPCR = p.pcr >= 1.0 ? Math.min((p.pcr - 1.0) / 0.5, 1) * 84 + 36 : 0
  const pPCR = p.pcr <= 1.0 ? Math.min((1.0 - p.pcr) / 0.5, 1) * 120 : 0
  bd.push({ factor: 'PCR', cePoints: Math.round(cPCR), pePoints: Math.round(pPCR), maxPoints: 120 })
  ce += cPCR; pe += pPCR

  // 6. VIX — 80 pts
  const cVIX = p.vix < 15 ? 80 : p.vix < 20 ? 80 * (20 - p.vix) / 5 : 0
  const pVIX = p.vix > 20 ? Math.min((p.vix - 20) / 5, 1) * 80 : p.vix > 15 ? 80 * (p.vix - 15) / 5 : 0
  bd.push({ factor: 'VIX', cePoints: Math.round(cVIX), pePoints: Math.round(pVIX), maxPoints: 80 })
  ce += cVIX; pe += pVIX

  // 7. Market Breadth — 80 pts
  const cBreadth = p.breadth > 50 ? Math.min((p.breadth - 50) / 20, 1) * 80 : 0
  const pBreadth = p.breadth < 50 ? Math.min((50 - p.breadth) / 20, 1) * 80 : 0
  bd.push({ factor: 'Breadth', cePoints: Math.round(cBreadth), pePoints: Math.round(pBreadth), maxPoints: 80 })
  ce += cBreadth; pe += pBreadth

  // 8. Volume — 50 pts
  const cVol = p.volumeAboveAvg && emaBull ? 50 : p.volumeAboveAvg ? 25 : 0
  const pVol = p.volumeAboveAvg && emaBear ? 50 : p.volumeAboveAvg ? 25 : 0
  bd.push({ factor: 'Volume', cePoints: Math.round(cVol), pePoints: Math.round(pVol), maxPoints: 50 })
  ce += cVol; pe += pVol

  // 9. Last Candle Direction — 20 pts (small weight — single candle)
  bd.push({ factor: 'Candle', cePoints: p.lastCandleGreen ? 20 : 0, pePoints: !p.lastCandleGreen ? 20 : 0, maxPoints: 20 })
  ce += p.lastCandleGreen ? 20 : 0
  pe += !p.lastCandleGreen ? 20 : 0

  const ceScore = Math.round(Math.min(ce, 1000))
  const peScore = Math.round(Math.min(pe, 1000))

  let prediction1h: MarketScore['prediction1h']
  let predictionDetail: string

  if (ceScore >= 700 && ceScore > peScore + 100) {
    prediction1h = 'BULLISH'
    predictionDetail = `Strong bull — +100 to +200pt rise likely`
  } else if (peScore >= 700 && peScore > ceScore + 100) {
    prediction1h = 'BEARISH'
    predictionDetail = `Strong bear — 100 to 200pt fall likely`
  } else if (ceScore >= 600 && ceScore > peScore) {
    prediction1h = 'BULLISH'
    predictionDetail = `Mild bull bias — cautious CE entry`
  } else if (peScore >= 600 && peScore > ceScore) {
    prediction1h = 'BEARISH'
    predictionDetail = `Mild bear bias — cautious PE entry`
  } else if (Math.abs(ceScore - peScore) < 80) {
    prediction1h = 'SIDEWAYS'
    predictionDetail = `Mixed signals — range-bound ±50pt`
  } else {
    prediction1h = 'NEUTRAL'
    predictionDetail = `No clear signal — wait for confirmation`
  }

  return { ceScore, peScore, prediction1h, predictionDetail, breakdown: bd }
}
