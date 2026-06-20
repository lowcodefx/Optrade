import { create } from 'zustand'
import type { NiftyQuote, OptionChain, Candle, TrendAnalysis, TradeStrengthResult, PriceActionSetup } from '@/core/types'
import { calculateEMA, calculateRSI, calculateADX } from '@/core/utils/indicators'
import { calculateTradeStrength } from '@/core/utils/tradeStrength'
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

  setQuote: (q: NiftyQuote) => void
  setOptionChain: (c: OptionChain) => void
  setCandles: (c: Candle[]) => void
  setPAEnabled: (v: boolean) => void
  setCenterTab: (t: 'chart' | 'chain') => void
  setChartFullscreen: (v: boolean) => void
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

  setQuote: (quote) => {
    set({ quote })
    // Recompute derived state when quote updates
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

      set({ trendAnalysis, tradeStrength })
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

  setCenterTab: (centerTab) => set({ centerTab }),
  setChartFullscreen: (chartFullscreen) => set({ chartFullscreen }),
}))
