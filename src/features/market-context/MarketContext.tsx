import { useMarketStore } from '@/core/store'
import { SectionCard } from '@/components/SectionCard'
import { TrendingUp, TrendingDown } from 'lucide-react'

const tooltips = {
  title: 'Market Context',
  what: 'Live snapshot of VIX, PCR, NIFTY 50 stock breadth, FII/DII flows, and global markets.',
  why: 'Before trading any individual option, knowing the overall market environment prevents trading against the trend.',
  how: 'All signals should align before entering a trade. Contradicting signals = wait.',
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
  const n50 = useMarketStore(s => s.nifty50Breadth)
  const globalMarkets = useMarketStore(s => s.globalMarkets)
  const fiiDii = useMarketStore(s => s.fiiDii)

  if (!quote) return null

  const vixColor = quote.vix < 14 ? 'text-[#22c55e]' : quote.vix < 18 ? 'text-[#f59e0b]' : 'text-[#ef4444]'
  const vixLabel = quote.vix < 14 ? 'Low' : quote.vix < 18 ? 'Moderate' : 'High'
  const pcrColor = quote.pcr > 1.2 ? 'text-[#22c55e]' : quote.pcr > 0.8 ? 'text-[#f59e0b]' : 'text-[#ef4444]'
  const pcrLabel = quote.pcr > 1.2 ? 'Bullish' : quote.pcr > 0.8 ? 'Neutral' : 'Bearish'
  const trendColor = trend?.trend === 'bullish' ? 'text-[#22c55e]' : trend?.trend === 'bearish' ? 'text-[#ef4444]' : 'text-[#f59e0b]'
  const trendValue = trend?.trend === 'bullish' ? '▲' : trend?.trend === 'bearish' ? '▼' : '→'
  const trendLabel = trend?.trend === 'bullish' ? '↑ Bull' : trend?.trend === 'bearish' ? '↓ Bear' : '→ Neutral'

  const breadthPct = n50 ? n50.breadthPct : quote.breadth
  const breadthColor = breadthPct > 60 ? 'text-[#22c55e]' : breadthPct > 40 ? 'text-[#f59e0b]' : 'text-[#ef4444]'
  const breadthLabel = n50
    ? `${n50.bullishCount}↑ ${n50.bearishCount}↓ / 50`
    : (breadthPct > 60 ? 'Positive' : breadthPct > 40 ? 'Mixed' : 'Negative')

  return (
    <SectionCard title="Market Context" tooltip={tooltips}>
      <div className="grid grid-cols-2 gap-1.5">
        <MiniCard label="VIX" value={quote.vix.toFixed(1)} sub={vixLabel} color={vixColor} />
        <MiniCard label="PCR" value={quote.pcr.toFixed(2)} sub={pcrLabel} color={pcrColor} />
        <MiniCard label="N50 Breadth" value={`${Math.round(breadthPct)}%`} sub={breadthLabel} color={breadthColor} />
        <MiniCard label="Trend" value={trendValue} sub={trendLabel} color={trendColor} />
      </div>

      {/* NIFTY 50 stock breakdown bar */}
      {n50 && (
        <div className="mt-2">
          <div className="flex justify-between text-[9px] text-[#64748b] mb-1">
            <span className="text-[#22c55e] font-semibold">{n50.strongBullCount} Strong Bull</span>
            <span className="text-[#475569]">NIFTY 50 Stocks</span>
            <span className="text-[#ef4444] font-semibold">{n50.strongBearCount} Strong Bear</span>
          </div>
          <div className="flex rounded overflow-hidden h-2">
            <div className="bg-[#22c55e]" style={{ width: `${(n50.strongBullCount / 50) * 100}%` }} />
            <div className="bg-[#22c55e]/40" style={{ width: `${((n50.bullishCount - n50.strongBullCount) / 50) * 100}%` }} />
            <div className="bg-[#ef4444]/40" style={{ width: `${((n50.bearishCount - n50.strongBearCount) / 50) * 100}%` }} />
            <div className="bg-[#ef4444]" style={{ width: `${(n50.strongBearCount / 50) * 100}%` }} />
          </div>
          <div className="flex justify-between text-[8px] text-[#475569] mt-0.5">
            <span>{n50.bullishCount} Bullish</span>
            <span>{n50.bearishCount} Bearish</span>
          </div>
        </div>
      )}

      {/* FII/DII flows */}
      {fiiDii && (
        <div className="mt-3 border-t border-[#1e293b] pt-2">
          <div className="text-[9px] text-[#64748b] uppercase tracking-widest mb-1.5">FII/DII Flows ({fiiDii.date})</div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="bg-[#060d1a] rounded p-2">
              <div className="text-[9px] text-[#64748b] mb-0.5">FII</div>
              <div className={`text-xs font-bold ${fiiDii.fiiNet >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                {fiiDii.fiiNet >= 0 ? '+' : ''}₹{(fiiDii.fiiNet / 100).toFixed(0)}Cr
              </div>
              <div className="flex items-center gap-0.5 mt-0.5">
                {fiiDii.fiiNet >= 0 ? <TrendingUp size={8} className="text-[#22c55e]" /> : <TrendingDown size={8} className="text-[#ef4444]" />}
                <span className="text-[8px] text-[#475569]">{fiiDii.fiiNet >= 0 ? 'Net Buyers' : 'Net Sellers'}</span>
              </div>
            </div>
            <div className="bg-[#060d1a] rounded p-2">
              <div className="text-[9px] text-[#64748b] mb-0.5">DII</div>
              <div className={`text-xs font-bold ${fiiDii.diiNet >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                {fiiDii.diiNet >= 0 ? '+' : ''}₹{(fiiDii.diiNet / 100).toFixed(0)}Cr
              </div>
              <div className="flex items-center gap-0.5 mt-0.5">
                {fiiDii.diiNet >= 0 ? <TrendingUp size={8} className="text-[#22c55e]" /> : <TrendingDown size={8} className="text-[#ef4444]" />}
                <span className="text-[8px] text-[#475569]">{fiiDii.diiNet >= 0 ? 'Net Buyers' : 'Net Sellers'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Markets */}
      {globalMarkets.length > 0 && (
        <div className="mt-3 border-t border-[#1e293b] pt-2">
          <div className="text-[9px] text-[#64748b] uppercase tracking-widest mb-1.5">Global Markets</div>
          <div className="space-y-1">
            {globalMarkets.map(m => {
              const isPos = m.changePct >= 0
              return (
                <div key={m.symbol} className="flex items-center justify-between text-[9px]">
                  <span className="text-[#94a3b8] font-medium">{m.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">{m.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                    <span className={`font-bold ${isPos ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      {isPos ? '+' : ''}{m.changePct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </SectionCard>
  )
}
