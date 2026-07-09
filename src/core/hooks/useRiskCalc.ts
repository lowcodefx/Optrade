import { useSettingsStore } from '@/core/store'

const LOT_SIZE = 65

export function useRiskCalc(premium: number, stopLoss?: number) {
  const { capital, riskPerTrade } = useSettingsStore()
  const riskAmount = (capital * riskPerTrade) / 100
  const slDistance = stopLoss && premium > 0 ? premium - stopLoss : premium * 0.15
  const suggestedLots = slDistance > 0 ? Math.max(1, Math.floor(riskAmount / (slDistance * LOT_SIZE))) : 1
  const suggestedQty = suggestedLots * LOT_SIZE
  const maxLoss = suggestedQty * slDistance
  const rr = stopLoss ? (premium * 0.27) / (slDistance) : 1.7
  const potentialProfit = maxLoss * rr

  return {
    riskAmount: Math.round(riskAmount),
    suggestedLots,
    suggestedQty,
    maxLoss: Math.round(maxLoss),
    potentialProfit: Math.round(potentialProfit),
    rr: Math.round(rr * 10) / 10,
    lotSize: LOT_SIZE,
  }
}
