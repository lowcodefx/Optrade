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
    const { candles } = get()
    if (candles.length > 0 && quote) {
      const closes = candles.map(c => c.close)
      const ema9arr = calculateEMA(closes, 9)
      const ema20arr = calculateEMA(closes, 20)
      const ema50arr = calculateEMA(closes, 50)
      const ema9 = ema9arr[ema9arr.length - 1]
      const ema20 = ema20arr[ema20arr.length - 1]
      const ema50 = ema50arr[ema50arr.length - 1]
      const rsi = calculateRSI(closes)
      const adx = calculateADX(candles)
      const aboveVWAP = quote.spot > quote.vwap
      const emaAligned = ema9 > ema20 && ema20 > ema50
      const trend = emaAligned && aboveVWAP ? 'bullish' : (!emaAligned && !aboveVWAP ? 'bearish' : 'neutral')

      const trendAnalysis: TrendAnalysis = { ema9, ema20, ema50, rsi, adx, vwap: quote.vwap, trend, aboveVWAP, emaAligned }

      const tradeStrength = calculateTradeStrength({
        spot: quote.spot, vwap: quote.vwap, ema9, ema20, ema50,
        rsi, adx, pcr: quote.pcr, breadth: quote.breadth,
        volumeAboveAvg: candles[candles.length - 1]?.volume > 70000,
        putWritingDetected: quote.pcr > 1.2,
      })

      const lastCandle = candles[candles.length - 1]
      const n50 = get().nifty50Breadth
      // Use live NIFTY 50 breadth if available, else fall back to quote.breadth
      const breadth = n50 ? n50.breadthPct : quote.breadth
      const ms = calculateMarketScore({
        spot: quote.spot, vwap: quote.vwap,
        ema9, ema20, ema50, rsi, adx,
        pcr: quote.pcr, breadth, vix: quote.vix,
        lastCandleGreen: lastCandle ? lastCandle.close >= lastCandle.open : true,
        volumeAboveAvg: lastCandle ? lastCandle.volume > 70000 : false,
        nifty50Bullish: n50?.bullishCount,
        nifty50Bearish: n50?.bearishCount,
        strongBullCount: n50?.strongBullCount,
        strongBearCount: n50?.strongBearCount,
      })

      set({
        trendAnalysis, tradeStrength,
        ceScore: ms.ceScore, peScore: ms.peScore,
        prediction1h: ms.prediction1h, predictionDetail: ms.predictionDetail,
        scoreBreakdown: ms.breakdown,
      })
    }
  },

  setOptionChain: (optionChain) => set({ optionChain }),

  setCandles: (candles) => {
    set({ candles })
    const { quote, paEnabled } = get()
    if (paEnabled && candles.length >= 2) {
      const patterns = detectPatterns(candles)
      const spot = quote?.spot ?? candles[candles.length - 1].close
      const paSetup = buildPriceActionSetup(candles, patterns, spot)
      set({ paSetup })
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
  setCenterTab: (centerTab) => set({ centerTab }),
  setChartFullscreen: (chartFullscreen) => set({ chartFullscreen }),
  setActiveTimeframe: (activeTimeframe) => set({ activeTimeframe }),
  setUserName: (userName) => set({ userName }),
  setMargins: (availableMargin, usedMargin, netMargin) => set({ availableMargin, usedMargin, netMargin }),
  setPivotPoints: (pivotPoints) => set({ pivotPoints }),
  setShowPivots: (showPivots) => set({ showPivots }),
  setOrders: (orders) => set({ orders }),
  setGlobalMarkets: (globalMarkets) => set({ globalMarkets }),
  setFiiDii: (fiiDii) => set({ fiiDii }),
}))
