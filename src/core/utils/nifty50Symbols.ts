// NSE trading symbols for all 50 NIFTY 50 constituents (as of 2026)
export const NIFTY50_SYMBOLS = [
  'ADANIENT', 'ADANIPORTS', 'APOLLOHOSP', 'ASIANPAINT', 'AXISBANK',
  'BAJAJ-AUTO', 'BAJFINANCE', 'BAJAJFINSV', 'BEL', 'BPCL',
  'BHARTIARTL', 'BRITANNIA', 'CIPLA', 'COALINDIA', 'DRREDDY',
  'EICHERMOT', 'ETERNAL', 'GRASIM', 'HCLTECH', 'HDFCBANK',
  'HDFCLIFE', 'HEROMOTOCO', 'HINDALCO', 'HINDUNILVR', 'ICICIBANK',
  'ITC', 'INDUSINDBK', 'INFY', 'JSWSTEEL', 'KOTAKBANK',
  'LT', 'LTIM', 'M&M', 'MARUTI', 'NESTLEIND',
  'NTPC', 'ONGC', 'POWERGRID', 'RELIANCE', 'SBILIFE',
  'SHRIRAMFIN', 'SBIN', 'SUNPHARMA', 'TCS', 'TATACONSUM',
  'TATAMOTORS', 'TATASTEEL', 'TECHM', 'TITAN', 'ULTRACEMCO',
] as const

// Build the i= param list for Kite /quote API
export const NIFTY50_KITE_INSTRUMENTS = NIFTY50_SYMBOLS.map(s => `NSE:${s}`)

export interface StockBreadth {
  symbol: string
  bullish: boolean        // last_price > prev_close
  greenCandle: boolean    // last_price > open
  changePct: number
}

export interface Nifty50BreadthResult {
  bullishCount: number    // above prev close
  bearishCount: number    // below prev close
  strongBullCount: number // above prev close AND green candle
  strongBearCount: number // below prev close AND red candle
  breadthPct: number      // 0-100  (bullishCount / 50 * 100)
  stocks: StockBreadth[]
}
