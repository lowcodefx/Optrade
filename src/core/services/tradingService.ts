import type { NiftyQuote, OptionChain, Candle, Position } from '@/core/types'
import type { OrderRequest, OrderResponse } from '@/core/types'
import type { Nifty50BreadthResult } from '@/core/utils/nifty50Symbols'
import { getMockNiftyQuote, getMockOptionChain, getMockCandles, getMockPositions } from './mockData'
import { ZerodhaService } from './zerodhaService'
import { useSettingsStore } from '@/core/store'
import { create } from 'zustand'

interface LiveModeStore {
  isLive: boolean
  setLive: (v: boolean) => void
}

export const useLiveModeStore = create<LiveModeStore>(set => ({
  isLive: false,
  setLive: (v) => set({ isLive: v }),
}))

export interface ITradingService {
  getNiftyQuote(): Promise<NiftyQuote>
  getOptionChain(expiry?: string): Promise<OptionChain>
  getCandles(timeframe?: string, count?: number): Promise<Candle[]>
  getPositions(): Promise<Position[]>
  getNifty50Breadth(): Promise<Nifty50BreadthResult>
  placeOrder(order: OrderRequest): Promise<OrderResponse>
  exitPosition(positionId: string): Promise<void>
  exitAllPositions(): Promise<void>
}

class MockTradingService implements ITradingService {
  private candles: Candle[] = getMockCandles(30)

  async getNiftyQuote(): Promise<NiftyQuote> {
    await delay(100)
    return getMockNiftyQuote()
  }

  async getOptionChain(): Promise<OptionChain> {
    await delay(150)
    const quote = await this.getNiftyQuote()
    return getMockOptionChain(quote.spot)
  }

  async getCandles(_timeframe = '5m', count = 30): Promise<Candle[]> {
    await delay(80)
    this.candles = getMockCandles(count)
    return this.candles
  }

  async getPositions(): Promise<Position[]> {
    await delay(100)
    return getMockPositions()
  }

  async getNifty50Breadth(): Promise<Nifty50BreadthResult> {
    await delay(80)
    // Mock: simulate 30-35 bullish out of 50
    const bullishCount = Math.round(25 + Math.random() * 20)
    const bearishCount = 50 - bullishCount
    return {
      bullishCount,
      bearishCount,
      strongBullCount: Math.round(bullishCount * 0.6),
      strongBearCount: Math.round(bearishCount * 0.6),
      breadthPct: (bullishCount / 50) * 100,
      stocks: [],
    }
  }

  async placeOrder(order: OrderRequest): Promise<OrderResponse> {
    await delay(300)
    console.log('Mock order placed:', order)
    return {
      orderId: `MOCK-${Date.now()}`,
      status: 'COMPLETE',
      message: `Mock order executed: BUY ${order.quantity} ${order.symbol} ${order.strike} ${order.optionType}`,
      timestamp: new Date(),
    }
  }

  async exitPosition(positionId: string): Promise<void> {
    await delay(200)
    console.log('Mock exit position:', positionId)
  }

  async exitAllPositions(): Promise<void> {
    await delay(300)
    console.log('Mock exit all positions')
  }
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Zustand persist hydrates synchronously from localStorage, so getState() here
// returns the stored credentials before any React component renders.
function hasStoredCredentials(): boolean {
  const { apiKey, accessToken } = useSettingsStore.getState()
  return !!(apiKey && accessToken && accessToken.length > 10)
}

let _service: ITradingService = hasStoredCredentials()
  ? new ZerodhaService()
  : new MockTradingService()

// Sync initial live state after stores are fully initialized
queueMicrotask(() => {
  useLiveModeStore.getState().setLive(_service instanceof ZerodhaService)
})

export const tradingService: ITradingService = new Proxy({} as ITradingService, {
  get: (_t, prop) => (_service as unknown as Record<string | symbol, unknown>)[prop],
})

export function activateLiveService(): void {
  _service = new ZerodhaService()
  useLiveModeStore.getState().setLive(true)
}

export function activateMockService(): void {
  _service = new MockTradingService()
  useLiveModeStore.getState().setLive(false)
}

export function isLiveMode(): boolean {
  return useLiveModeStore.getState().isLive
}
