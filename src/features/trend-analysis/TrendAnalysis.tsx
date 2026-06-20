import { useMarketStore } from '@/core/store'
import { SectionCard } from '@/components/SectionCard'
import { formatNumber } from '@/lib/utils'

const tooltip = {
  title: 'Trend Analysis',
  what: 'Key technical indicators: EMA 9/20/50 moving averages, RSI momentum, and ADX trend strength.',
  why: 'These indicators confirm whether the market is trending or ranging, and in which direction.',
  how: 'EMA stack (9>20>50) = bullish trend. RSI 50-70 = healthy bullish momentum. ADX >25 = trending market.',
  bullish: 'EMA9 > EMA20 > EMA50, RSI 55–70, ADX >25 → strong uptrend, buy CE.',
  bearish: 'EMA9 < EMA20 < EMA50, RSI 30–45, ADX >25 → strong downtrend, buy PE.',
}

interface RowProps {
  label: string
  value: string
  status: string
  color: string
}

function Row({ label, value, status, color }: RowProps) {
  return (
    <div className="flex items-center justify-between bg-[#060d1a] rounded px-2 py-1.5">
      <span className="text-[#94a3b8] text-[10px] w-12">{label}</span>
      <span className="text-white text-[10px] font-medium flex-1 text-center">{value}</span>
      <span className={`text-[9px] font-semibold ${color}`}>{status}</span>
    </div>
  )
}

export function TrendAnalysis() {
  const t = useMarketStore(s => s.trendAnalysis)
  if (!t) return null

  const emaAligned = t.ema9 > t.ema20 && t.ema20 > t.ema50
  const emaColor = emaAligned ? 'text-[#22c55e]' : 'text-[#ef4444]'
  const rsiColor = t.rsi >= 50 && t.rsi <= 70 ? 'text-[#22c55e]' : t.rsi > 70 ? 'text-[#f59e0b]' : 'text-[#ef4444]'
  const rsiStatus = t.rsi >= 70 ? 'Overbought' : t.rsi >= 55 ? 'Strong' : t.rsi >= 45 ? 'Neutral' : 'Weak'
  const adxColor = t.adx > 25 ? 'text-[#22c55e]' : 'text-[#f59e0b]'
  const adxStatus = t.adx > 35 ? 'Strong Trend' : t.adx > 25 ? 'Trending' : 'Weak'

  return (
    <SectionCard title="Trend Analysis" tooltip={tooltip}>
      <div className="space-y-1">
        <Row label="EMA 9" value={formatNumber(t.ema9, 0)} status={emaAligned ? 'Bull' : 'Bear'} color={emaColor} />
        <Row label="EMA 20" value={formatNumber(t.ema20, 0)} status={emaAligned ? 'Bull' : 'Bear'} color={emaColor} />
        <Row label="EMA 50" value={formatNumber(t.ema50, 0)} status={emaAligned ? 'Bull' : 'Bear'} color={emaColor} />
        <Row label="RSI" value={t.rsi.toFixed(1)} status={rsiStatus} color={rsiColor} />
        <Row label="ADX" value={t.adx.toFixed(1)} status={adxStatus} color={adxColor} />
        <Row label="VWAP" value={formatNumber(t.vwap, 0)} status={t.aboveVWAP ? 'Above' : 'Below'} color={t.aboveVWAP ? 'text-[#22c55e]' : 'text-[#ef4444]'} />
      </div>
    </SectionCard>
  )
}
