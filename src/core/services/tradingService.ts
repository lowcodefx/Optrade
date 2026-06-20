import type { NiftyQuote, OptionChain, Candle, Position } from '@/core/types'
import type { OrderRequest, OrderResponse } from '@/core/types'
import { getMockNiftyQuote, getMockOptionChain, getMockCandles, getMockPositions } from './mockData'

export interface ITradingService {
  getNiftyQuote(): Promise<NiftyQuote>
  getOptionChain(expiry?: string): Promise<OptionChain>
  getCandles(timeframe?: string, count?: number): Promise<Candle[]>
  getPositions(): Promise<Position[]>
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
    // Append one updated candle to simulate live feed
    this.candles = getMockCandles(count)
    return this.candles
  }

  async getPositions(): Promise<Position[]> {
    await delay(100)
    return getMockPositions()
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

// Mutable service instance — swapped at runtime when user connects Zerodha
let _service: ITradingService = new MockTradingService()

export const tradingService: ITradingService = new Proxy({} as ITradingService, {
  get: (_t, prop) => (_service as unknown as Record<string | symbol, unknown>)[prop],
})

export function activateLiveService(): void {
  import('./zerodhaService').then(({ ZerodhaService }) => {
    _service = new ZerodhaService()
  })
}

export function activateMockService(): void {
  _service = new MockTradingService()
}

export function isLiveMode(): boolean {
  return _service.constructor.name === 'ZerodhaService'
}
