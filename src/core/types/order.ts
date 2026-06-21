export type OptionType = 'CE' | 'PE'
export type OrderType = 'MARKET' | 'LIMIT'
export type ProductType = 'MIS' | 'NRML'
export type OrderStatus = 'PENDING' | 'OPEN' | 'COMPLETE' | 'CANCELLED' | 'REJECTED'

export interface OrderRequest {
  symbol: string
  strike: number
  optionType: OptionType
  expiry: string
  quantity: number
  orderType: OrderType
  productType: ProductType
  price?: number
  stopLoss?: number
  target?: number
}

export interface OrderResponse {
  orderId: string
  status: OrderStatus
  message: string
  timestamp: Date
}

export interface Position {
  positionId: string
  symbol: string
  strike: number
  optionType: OptionType
  expiry: string
  quantity: number
  entryPrice: number
  ltp: number
  pnl: number
  pnlPct: number
  productType: ProductType
  entryTime: Date
  stopLoss?: number
  target?: number
}

export interface KiteOrder {
  orderId: string
  tradingsymbol: string
  exchange: string
  transactionType: 'BUY' | 'SELL'
  orderType: 'MARKET' | 'LIMIT'
  product: 'MIS' | 'NRML'
  quantity: number
  price: number
  averagePrice: number
  status: 'COMPLETE' | 'OPEN' | 'CANCELLED' | 'REJECTED' | 'TRIGGER PENDING' | string
  orderTimestamp: string
  statusMessage?: string
}
