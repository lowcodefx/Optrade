import { useMarketStore } from '@/core/store'
import { SectionCard } from '@/components/SectionCard'

const tooltips = {
  title: 'Market Context',
  what: 'A snapshot of key market-wide conditions: VIX, PCR, Market Breadth, and Trend Direction.',
  why: 'Before trading any individual option, knowing the overall market environment prevents trading against the trend.',
  how: 'All four signals should align before entering a trade. Contradicting signals = wait.',
  bullish: 'VIX low (<15), PCR >1.2, Breadth >60%, Trend Bullish — ideal for CE buying.',
  bearish: 'VIX spiking (>18), PCR <0.8, Breadth <40%, Trend Bearish — ideal for PE buying.',
}

interface MiniCardProps {
  label: string
  value: string
  sub: string
  color: string
}

function MiniCard({ label, value, sub, color }: MiniCardProps) {
  return (
    <div className="bg-[#060d1a] rounded p-2">
      <div className="text-[#64748b] text-[9px] mb-1">{label}</div>
      <div className={`text-sm font-bold ${color}`}>{value}</div>
      <div className={`text-[9px] ${color}`}>{sub}</div>
    </div>
  )
}

export function MarketContext() {
  const quote = useMarketStore(s => s.quote)
  const trend = useMarketStore(s => s.trendAnalysis)

  if (!quote) return null

  const vixColor = quote.vix < 14 ? 'text-[#22c55e]' : quote.vix < 18 ? 'text-[#f59e0b]' : 'text-[#ef4444]'
  const vixLabel = quote.vix < 14 ? 'Low' : quote.vix < 18 ? 'Moderate' : 'High'
  const pcrColor = quote.pcr > 1.2 ? 'text-[#22c55e]' : quote.pcr > 0.8 ? 'text-[#f59e0b]' : 'text-[#ef4444]'
  const pcrLabel = quote.pcr > 1.2 ? 'Bullish' : quote.pcr > 0.8 ? 'Neutral' : 'Bearish'
  const breadthColor = quote.breadth > 60 ? 'text-[#22c55e]' : quote.breadth > 40 ? 'text-[#f59e0b]' : 'text-[#ef4444]'
  const breadthLabel = quote.breadth > 60 ? 'Positive' : quote.breadth > 40 ? 'Mixed' : 'Negative'
  const trendColor = trend?.trend === 'bullish' ? 'text-[#22c55e]' : trend?.trend === 'bearish' ? 'text-[#ef4444]' : 'text-[#f59e0b]'
  const trendLabel = trend?.trend === 'bullish' ? '↑ Bull' : trend?.trend === 'bearish' ? '↓ Bear' : '→ Neutral'
  const trendValue = trend?.trend === 'bullish' ? '▲' : trend?.trend === 'bearish' ? '▼' : '→'

  return (
    <SectionCard title="Market Context" tooltip={tooltips}>
      <div className="grid grid-cols-2 gap-1.5">
        <MiniCard label="VIX" value={quote.vix.toFixed(1)} sub={vixLabel} color={vixColor} />
        <MiniCard label="PCR" value={quote.pcr.toFixed(2)} sub={pcrLabel} color={pcrColor} />
        <MiniCard label="Breadth" value={`${Math.round(quote.breadth)}%`} sub={breadthLabel} color={breadthColor} />
        <MiniCard label="Trend" value={trendValue} sub={trendLabel} color={trendColor} />
      </div>
    </SectionCard>
  )
}
