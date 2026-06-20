export type TradeResult = 'WIN' | 'LOSS' | 'BREAKEVEN'
export type DisciplineGrade = 'A+' | 'A' | 'B' | 'C' | 'D'
export type MarketRegime = 'Trending Up' | 'Trending Down' | 'Range Bound' | 'Volatile' | 'Expiry Mode'

export interface TradeEntry {
  id: string
  date: string // YYYY-MM-DD
  time: string // HH:MM
  strike: number
  optionType: 'CE' | 'PE'
  lots: number
  entryPrice: number
  exitPrice: number
  sl: number
  target: number
  pnl: number
  result: TradeResult
  tradeScore: number
  regime: string
  notes: string
}

export interface ValidationResult {
  allowed: boolean
  reason?: string   // red — blocked
  warning?: string  // amber — allowed with warning
}

export interface DisciplineViolation {
  time: number
  rule: string
  action: 'BLOCKED' | 'WARNING'
}
