import { create } from 'zustand'
import type { NiftyQuote, OptionChain, Candle, TrendAnalysis, TradeStrengthResult, PriceActionSetup, PivotPoints, GlobalMarket, FiiDiiData } from '@/core/types'
import type { MarketScore, ScoreBreakdown } from '@/core/utils/scoreEngine'
import type { Nifty50BreadthResult } from '@/core/utils/nifty50Symbols'
import type { KiteOrder } from '@/core/types'
import { calculateEMA, calculateRSI, calculateADX } from '@/core/utils/indicators'
import { calculateTradeStrength } from '@/core/utils/tradeStrength'
import { calculateMarketScore } from '@/core/utils/scoreEngine'
import { detectPatterns, buildPriceActionSetup } from '@/core/utils/patternDetector'

interface MarketState {
  quote: NiftyQuote | null
  optionChain: OptionChain | null
  candles: Candle[]
  trendAnalysis: TrendAnalysis | null
  tradeStrength: TradeStrengthResult | null
  paSetup: PriceActionSetup | null
  paEnabled: boolean
  centerTab: 'chart' | 'chain'
  chartFullscreen: boolean
  activeTimeframe: string

  // 1000-pt scoring
  ceScore: number
  peScore: number
  prediction1h: MarketScore['prediction1h']
  predictionDetail: string
  noTradeReason: string | undefined
  timeMultiplier: number
  scoreBreakdown: ScoreBreakdown[]

  // NIFTY 50 constituent breadth
  nifty50Breadth: Nifty50BreadthResult | null

  // Authenticated user
  userName: string
  availableMargin: number
  usedMargin: number
  netMargin: number

  // Pivot points (previous day S1/S2/R1/R2)
  pivotPoints: PivotPoints | null
  showPivots: boolean

  // Order history
  orders: KiteOrder[]

  // Global markets (Dow, Nasdaq, S&P)
  globalMarkets: GlobalMarket[]

  // FII/DII data
  fiiDii: FiiDiiData | null

  setQuote: (q: NiftyQuote) => void
  setOptionChain: (c: OptionChain) => void
  setCandles: (c: Candle[]) => void
  setPAEnabled: (v: boolean) => void
  setCenterTab: (t: 'chart' | 'chain') => void
  setChartFullscreen: (v: boolean) => void
  setActiveTimeframe: (tf: string) => void
  setNifty50Breadth: (b: Nifty50BreadthResult) => void
  setUserName: (name: string) => void
  setMargins: (available: number, used: number, net: number) => void
  setPivotPoints: (p: PivotPoints) => void
  setShowPivots: (v: boolean) => void
  setOrders: (o: KiteOrder[]) => void
  setGlobalMarkets: (m: GlobalMarket[]) => void
  setFiiDii: (d: FiiDiiData) => void
}

// ─── Helpers for derived score params ────────────────────────────────────────

// Detect Higher High / Higher Low / Lower High / Lower Low from recent candles
function detectSwingStructure(candles: Candle[]) {
  if (candles.length < 4) return { isHigherHigh: false, isHigherLow: false, isLowerHigh: false, isLowerLow: false }
  const n = candles.length
  const h = [candles[n - 4].high, candles[n - 3].high, candles[n - 2].high, candles[n - 1].high]
  const l = [candles[n - 4].low,  candles[n - 3].low,  candles[n - 2].low,  candles[n - 1].low]
  return {
    isHigherHigh: h[3] > h[2] && h[2] > h[1],
    isHigherLow:  l[3] > l[2] && l[2] > l[1],
    isLowerHigh:  h[3] < h[2] && h[2] < h[1],
    isLowerLow:   l[3] < l[2] && l[2] < l[1],
  }
}

// Derive approximate 15m trend by grouping 5m candles into 15m blocks
function derive15mTrend(candles: Candle[]): 'bull' | 'bear' | 'neutral' {
  if (candles.length < 6) return 'neutral'
  // Most recent 15m close = avg of last 3 candles; previous = avg of candles [-6:-3]
  const recent = candles.slice(-3).reduce((s, c) => s + c.close, 0) / 3
  const prev   = candles.slice(-6, -3).reduce((s, c) => s + c.close, 0) / 3
  if (recent > prev * 1.0003) return 'bull'
  if (recent < prev * 0.9997) return 'bear'
  return 'neutral'
}

// Derive approximate 1h trend by comparing first half vs second half of candle history
function derive1hTrend(candles: Candle[]): 'bull' | 'bear' | 'neutral' {
  if (candles.length < 12) return 'neutral'
  const mid = Math.floor(candles.length / 2)
  const firstHalf  = candles.slice(0, mid).reduce((s, c) => s + c.close, 0) / mid
  const secondHalf = candles.slice(mid).reduce((s, c) => s + c.close, 0) / (candles.length - mid)
  if (secondHalf > firstHalf * 1.0005) return 'bull'
  if (secondHalf < firstHalf * 0.9995) return 'bear'
  return 'neutral'
}

// Get IST hour and minute from current UTC time
function getISTTime(): { hour: number; minute: number } {
  const now = new Date()
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000
  const ist = new Date(istMs)
  return { hour: ist.getUTCHours(), minute: ist.getUTCMinutes() }
}

// ─────────────────────────────────────────────────────────────────────────────

function recomputeScores(quote: NiftyQuote, candles: Candle[], optionChain: OptionChain | null, pivotPoints: PivotPoints | null, nifty50Breadth: Nifty50BreadthResult | null) {
  if (candles.length === 0 || !quote) return null

  const closes = candles.map(c => c.close)
  const ema9arr  = calculateEMA(closes, 9)
  const ema20arr = calculateEMA(closes, 20)
  const ema50arr = calculateEMA(closes, 50)
  const ema9  = ema9arr[ema9arr.length - 1]
  const ema20 = ema20arr[ema20arr.length - 1]
  const ema50 = ema50arr[ema50arr.length - 1]
  const rsi = calculateRSI(closes)
  const adx = calculateADX(candles)

  const lastCandle = candles[candles.length - 1]
  const volumeAboveAvg = lastCandle ? lastCandle.volume > 70000 : false
  const aboveVWAP  = quote.spot > quote.vwap
  const emaAligned = ema9 > ema20 && ema20 > ema50
  const trend = emaAligned && aboveVWAP ? 'bullish' : (!emaAligned && !aboveVWAP ? 'bearish' : 'neutral')

  const trendAnalysis: TrendAnalysis = { ema9, ema20, ema50, rsi, adx, vwap: quote.vwap, trend, aboveVWAP, emaAligned }

  const tradeStrength = calculateTradeStrength({
    spot: quote.spot, vwap: quote.vwap, ema9, ema20, ema50,
    rsi, adx, pcr: quote.pcr, breadth: quote.breadth,
    volumeAboveAvg,
    putWritingDetected: quote.pcr > 1.2,
  })

  // ── Derived structure params ──────────────────────────────────────────────

  // Opening range: first 2 candles of the session (9:15 and 9:20)
  const openingRangeHigh = candles.length >= 2 ? Math.max(candles[0].high, candles[1].high) : undefined
  const openingRangeLow  = candles.length >= 2 ? Math.min(candles[0].low,  candles[1].low)  : undefined

  // Swing structure from recent candles
  const { isHigherHigh, isHigherLow, isLowerHigh, isLowerLow } = detectSwingStructure(candles)

  // Multi-timeframe trends derived from 5m candles
  const trend15m = derive15mTrend(candles)
  const trend1h  = derive1hTrend(candles)

  // OI Change totals from the option chain (sum across all strikes in the chain)
  const ceOIChangeTotal = optionChain ? optionChain.strikes.reduce((s, r) => s + r.ce.oiChange, 0) : undefined
  const peOIChangeTotal = optionChain ? optionChain.strikes.reduce((s, r) => s + r.pe.oiChange, 0) : undefined

  // Yesterday's high/low from pivot points
  const yesterdayHigh = pivotPoints?.prevHigh
  const yesterdayLow  = pivotPoints?.prevLow

  // Current IST time for time-of-day multiplier
  const { hour, minute } = getISTTime()

  // N50 breadth — use live if available, else fall back to quote.breadth
  const n50 = nifty50Breadth
  const breadth = n50 ? n50.breadthPct : quote.breadth

  const ms = calculateMarketScore({
    spot: quote.spot, vwap: quote.vwap,
    ema9, ema20, ema50, rsi, adx,
    pcr: quote.pcr, breadth, vix: quote.vix,
    lastCandleGreen: lastCandle ? lastCandle.close >= lastCandle.open : true,
    volumeAboveAvg,
    nifty50Bullish: n50?.bullishCount,
    nifty50Bearish: n50?.bearishCount,
    strongBullCount: n50?.strongBullCount,
    strongBearCount: n50?.strongBearCount,
    // Market Structure
    yesterdayHigh, yesterdayLow,
    openingRangeHigh, openingRangeLow,
    isHigherHigh, isHigherLow, isLowerHigh, isLowerLow,
    // Multi-TF
    trend15m, trend1h,
    // OI Change
    ceOIChangeTotal, peOIChangeTotal,
    // Time of day
    hour, minute,
  })

  return { trendAnalysis, tradeStrength, ms }
}

export const useMarketStore = create<MarketState>((set, get) => ({
  quote: null,
  optionChain: null,
  candles: [],
  trendAnalysis: null,
  tradeStrength: null,
  paSetup: null,
  paEnabled: false,
  centerTab: 'chart',
  chartFullscreen: false,
  activeTimeframe: '5m',
  ceScore: 0,
  peScore: 0,
  prediction1h: 'NEUTRAL',
  predictionDetail: 'Waiting for data…',
  noTradeReason: undefined,
  timeMultiplier: 1.0,
  scoreBreakdown: [],
  nifty50Breadth: null,
  userName: '',
  availableMargin: 0,
  usedMargin: 0,
  netMargin: 0,
  pivotPoints: null,
  showPivots: true,
  orders: [],
  globalMarkets: [],
  fiiDii: null,

  setQuote: (quote) => {
    set({ quote })
    const { candles, optionChain, pivotPoints, nifty50Breadth } = get()
    if (candles.length > 0) {
      const result = recomputeScores(quote, candles, optionChain, pivotPoints, nifty50Breadth)
      if (result) {
        const { trendAnalysis, tradeStrength, ms } = result
        set({
          trendAnalysis, tradeStrength,
          ceScore: ms.ceScore, peScore: ms.peScore,
          prediction1h: ms.prediction1h, predictionDetail: ms.predictionDetail,
          noTradeReason: ms.noTradeReason,
          timeMultiplier: ms.timeMultiplier,
          scoreBreakdown: ms.breakdown,
        })
      }
    }
  },

  setOptionChain: (optionChain) => {
    set({ optionChain })
    // Re-run scores when option chain updates — OI change data may have changed
    const { quote, candles, pivotPoints, nifty50Breadth } = get()
    if (quote && candles.length > 0) {
      const result = recomputeScores(quote, candles, optionChain, pivotPoints, nifty50Breadth)
      if (result) {
        const { trendAnalysis, tradeStrength, ms } = result
        set({
          trendAnalysis, tradeStrength,
          ceScore: ms.ceScore, peScore: ms.peScore,
          prediction1h: ms.prediction1h, predictionDetail: ms.predictionDetail,
          noTradeReason: ms.noTradeReason,
          timeMultiplier: ms.timeMultiplier,
          scoreBreakdown: ms.breakdown,
        })
      }
    }
  },

  setCandles: (candles) => {
    set({ candles })
    const { quote, paEnabled, optionChain, pivotPoints, nifty50Breadth } = get()
    if (paEnabled && candles.length >= 2) {
      const patterns = detectPatterns(candles)
      const spot = quote?.spot ?? candles[candles.length - 1].close
      const paSetup = buildPriceActionSetup(candles, patterns, spot)
      set({ paSetup })
    }
    // Re-run scores when candles update (structure, trend, opening range all change)
    if (quote && candles.length > 0) {
      const result = recomputeScores(quote, candles, optionChain, pivotPoints, nifty50Breadth)
      if (result) {
        const { trendAnalysis, tradeStrength, ms } = result
        set({
          trendAnalysis, tradeStrength,
          ceScore: ms.ceScore, peScore: ms.peScore,
          prediction1h: ms.prediction1h, predictionDetail: ms.predictionDetail,
          noTradeReason: ms.noTradeReason,
          timeMultiplier: ms.timeMultiplier,
          scoreBreakdown: ms.breakdown,
        })
      }
    }
  },

  setPAEnabled: (paEnabled) => {
    set({ paEnabled })
    if (paEnabled) {
      const { candles, quote } = get()
      if (candles.length >= 2) {
        const patterns = detectPatterns(candles)
        const spot = quote?.spot ?? candles[candles.length - 1].close
        const paSetup = buildPriceActionSetup(candles, patterns, spot)
        set({ paSetup })
      }
    } else {
      set({ paSetup: null })
    }
  },

  setNifty50Breadth: (nifty50Breadth) => set({ nifty50Breadth }),
  setCenterTab:      (centerTab)      => set({ centerTab }),
  setChartFullscreen:(chartFullscreen)=> set({ chartFullscreen }),
  setActiveTimeframe:(activeTimeframe)=> set({ activeTimeframe }),
  setUserName:       (userName)       => set({ userName }),
  setMargins: (availableMargin, usedMargin, netMargin) => set({ availableMargin, usedMargin, netMargin }),
  setPivotPoints:    (pivotPoints)    => set({ pivotPoints }),
  setShowPivots:     (showPivots)     => set({ showPivots }),
  setOrders:         (orders)         => set({ orders }),
  setGlobalMarkets:  (globalMarkets)  => set({ globalMarkets }),
  setFiiDii:         (fiiDii)         => set({ fiiDii }),
}))
