export function calculateEMA(data: number[], period: number): number[] {
  if (data.length === 0) return []
  const k = 2 / (period + 1)
  const result: number[] = [data[0]]
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k))
  }
  return result
}

export function calculateRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50
  const changes = closes.slice(1).map((c, i) => c - closes[i])
  const gains = changes.map(c => Math.max(c, 0))
  const losses = changes.map(c => Math.max(-c, 0))

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period
  }

  if (avgLoss === 0) return 100
  return 100 - 100 / (1 + avgGain / avgLoss)
}

export function calculateVWAP(candles: { high: number; low: number; close: number; volume: number }[]): number[] {
  let cumTPV = 0
  let cumVol = 0
  return candles.map(c => {
    const tp = (c.high + c.low + c.close) / 3
    cumTPV += tp * c.volume
    cumVol += c.volume
    return cumVol === 0 ? tp : cumTPV / cumVol
  })
}

export function calculateADX(candles: { high: number; low: number; close: number }[], period = 14): number {
  if (candles.length < period * 2) return 20
  const trs: number[] = []
  const plusDMs: number[] = []
  const minusDMs: number[] = []

  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i]
    const prev = candles[i - 1]
    const upMove = curr.high - prev.high
    const downMove = prev.low - curr.low
    trs.push(Math.max(curr.high - curr.low, Math.abs(curr.high - prev.close), Math.abs(curr.low - prev.close)))
    plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0)
    minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0)
  }

  const smoothTR = trs.slice(0, period).reduce((a, b) => a + b, 0)
  const smoothPDM = plusDMs.slice(0, period).reduce((a, b) => a + b, 0)
  const smoothMDM = minusDMs.slice(0, period).reduce((a, b) => a + b, 0)

  const plusDI = (smoothPDM / smoothTR) * 100
  const minusDI = (smoothMDM / smoothTR) * 100
  const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100

  return isNaN(dx) ? 20 : Math.min(dx, 100)
}
