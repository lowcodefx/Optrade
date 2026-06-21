import { create } from 'zustand'
import type { OptionType, OrderType, ProductType } from '@/core/types'

interface OrderFormState {
  symbol: string
  strike: number
  optionType: OptionType
  expiry: string
  quantity: number
  orderType: OrderType
  productType: ProductType
  limitPrice: number
  stopLoss: number
  target: number
  showSL: boolean
  showTarget: boolean
  isSubmitting: boolean
  lastOrderMessage: string | null

  setStrike: (strike: number, optionType: OptionType, premium?: number) => void
  setQuantity: (q: number) => void
  setOrderType: (t: OrderType) => void
  setProductType: (t: ProductType) => void
  setOptionType: (t: OptionType) => void
  setStopLoss: (v: number) => void
  setTarget: (v: number) => void
  setLimitPrice: (v: number) => void
  setShowSL: (v: boolean) => void
  setShowTarget: (v: boolean) => void
  setIsSubmitting: (v: boolean) => void
  setLastOrderMessage: (m: string | null) => void
  applySetup: (strike: number, optionType: OptionType, sl: number, target: number, premium: number) => void
}

export const useOrderStore = create<OrderFormState>((set) => ({
  symbol: 'NIFTY',
  strike: 24650,
  optionType: 'CE',
  expiry: '26 Jun 2025',
  quantity: 1,
  orderType: 'LIMIT',
  productType: 'MIS',
  limitPrice: 0,
  stopLoss: 0,
  target: 0,
  showSL: true,
  showTarget: false,
  isSubmitting: false,
  lastOrderMessage: null,

  setStrike: (strike, optionType, premium) => set({
    strike, optionType,
    limitPrice: premium ?? 0,
    stopLoss: premium ? Math.max(0, +(premium - 20).toFixed(2)) : 0,
    showSL: true,
  }),
  setQuantity: (quantity) => set({ quantity }),
  setOrderType: (orderType) => set({ orderType }),
  setProductType: (productType) => set({ productType }),
  setOptionType: (optionType) => set({ optionType }),
  setStopLoss: (stopLoss) => set({ stopLoss }),
  setTarget: (target) => set({ target }),
  setLimitPrice: (limitPrice) => set({ limitPrice }),
  setShowSL: (showSL) => set({ showSL }),
  setShowTarget: (showTarget) => set({ showTarget }),
  setIsSubmitting: (isSubmitting) => set({ isSubmitting }),
  setLastOrderMessage: (lastOrderMessage) => set({ lastOrderMessage }),
  applySetup: (strike, optionType, sl, target, premium) =>
    set({ strike, optionType, stopLoss: sl, target, limitPrice: premium, showSL: true, showTarget: true }),
}))
