export interface NiftyQuote {
  spot: number
  change: number
  changePct: number
  open: number
  high: number
  low: number
  prevClose: number
  vix: number
  pcr: number
  breadth: number
  vwap: number
  timestamp: Date
}

export interface OptionStrike {
  strike: number
  ce: OptionData
  pe: OptionData
}

export interface OptionData {
  oi: number
  oiChange: number
  volume: number
  iv: number
  ltp: number
  delta: number
  gamma: number
  theta: number
  vega: number
}

export interface OptionChain {
  expiry: string
  atmStrike: number
  strikes: OptionStrike[]
  totalCEOI: number
  totalPEOI: number
  maxPainStrike: number
}

export interface Candle {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  ema9?: number
  ema20?: number
  ema50?: number
  vwap?: number
}

export type TrendDirection = 'bullish' | 'bearish' | 'neutral'
export type MarketRegime = 'trending-up' | 'trending-down' | 'range-bound' | 'volatile' | 'expiry'
export type StrengthLabel = 'weak' | 'moderate' | 'strong' | 'high-conviction'

export interface TradeStrengthResult {
  score: number
  label: StrengthLabel
  confidence: number
  signals: TradeSignal[]
}

export interface TradeSignal {
  name: string
  value: string | number
  passed: boolean
  weight: number
}

export interface TrendAnalysis {
  ema9: number
  ema20: number
  ema50: number
  rsi: number
  adx: number
  vwap: number
  trend: TrendDirection
  aboveVWAP: boolean
  emaAligned: boolean
}

export type CandlePattern =
  | 'BullishEngulfing'
  | 'BearishEngulfing'
  | 'Doji'
  | 'Hammer'
  | 'ShootingStaar'
  | 'InsideBar'
  | 'EMACrossover'

export interface PatternResult {
  pattern: CandlePattern
  direction: 'bullish' | 'bearish' | 'neutral'
  candleIndex: number
  label: string
}

export interface PriceActionSetup {
  patterns: PatternResult[]
  direction: 'bullish' | 'bearish' | 'neutral'
  confidence: number
  entry: number
  sl: number
  target: number
  rr: number
  optionEntry: number
  optionSL: number
  optionTarget: number
  supportLevel: number
  resistanceLevel: number
}
