import type { TradeStrengthResult, TradeSignal, StrengthLabel } from '@/core/types'

interface TradeStrengthParams {
  spot: number
  vwap: number
  ema9: number
  ema20: number
  ema50: number
  rsi: number
  adx: number
  pcr: number
  breadth: number
  volumeAboveAvg: boolean
  putWritingDetected: boolean
}

export function calculateTradeStrength(p: TradeStrengthParams): TradeStrengthResult {
  const signals: TradeSignal[] = [
    { name: 'Above VWAP', value: p.spot > p.vwap ? 'Yes' : 'No', passed: p.spot > p.vwap, weight: 15 },
    { name: 'EMA Aligned', value: p.ema9 > p.ema20 && p.ema20 > p.ema50 ? 'Bullish Stack' : 'Not Aligned', passed: p.ema9 > p.ema20 && p.ema20 > p.ema50, weight: 20 },
    { name: 'RSI', value: p.rsi.toFixed(1), passed: p.rsi >= 50 && p.rsi <= 75, weight: 15 },
    { name: 'ADX', value: p.adx.toFixed(1), passed: p.adx > 25, weight: 10 },
    { name: 'PCR', value: p.pcr.toFixed(2), passed: p.pcr > 1.0, weight: 15 },
    { name: 'Put Writing', value: p.putWritingDetected ? 'Active' : 'Absent', passed: p.putWritingDetected, weight: 10 },
    { name: 'Breadth', value: `${p.breadth}%`, passed: p.breadth > 55, weight: 10 },
    { name: 'Volume', value: p.volumeAboveAvg ? 'Above Avg' : 'Below Avg', passed: p.volumeAboveAvg, weight: 5 },
  ]

  const score = signals.reduce((acc, s) => acc + (s.passed ? s.weight : 0), 0)
  const confidence = Math.round(score * 0.9 + Math.random() * 5)

  let label: StrengthLabel = 'weak'
  if (score > 80) label = 'high-conviction'
  else if (score > 60) label = 'strong'
  else if (score > 30) label = 'moderate'

  return { score, label, confidence: Math.min(confidence, 100), signals }
}

export function getStrengthColor(label: StrengthLabel): string {
  const map: Record<StrengthLabel, string> = {
    'weak': '#ef4444',
    'moderate': '#f59e0b',
    'strong': '#22c55e',
    'high-conviction': '#38bdf8',
  }
  return map[label]
}
