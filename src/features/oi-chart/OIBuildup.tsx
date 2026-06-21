import { useMemo } from 'react'
import { useMarketStore } from '@/core/store'
import { SectionCard } from '@/components/SectionCard'

function formatOI(n: number): string {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`
  return String(n)
}

export function OIBuildup() {
  const chain = useMarketStore(s => s.optionChain)

  const rows = useMemo(() => {
    if (!chain) return []
    const maxOI = Math.max(
      ...chain.strikes.flatMap(s => [s.ce.oi, s.pe.oi]),
      1
    )
    return chain.strikes.map(s => ({
      strike: s.strike,
      ceOI: s.ce.oi,
      peOI: s.pe.oi,
      ceOIChange: s.ce.oiChange,
      peOIChange: s.pe.oiChange,
      cePct: (s.ce.oi / maxOI) * 100,
      pePct: (s.pe.oi / maxOI) * 100,
      isAtm: s.strike === chain.atmStrike,
      isMaxPain: s.strike === chain.maxPainStrike,
    }))
  }, [chain])

  if (!chain || rows.length === 0) {
    return (
      <SectionCard title="OI Buildup">
        <div className="text-[#475569] text-xs text-center py-4">Loading option chain data…</div>
      </SectionCard>
    )
  }

  const totalCE = chain.totalCEOI
  const totalPE = chain.totalPEOI
  const pcr = totalCE > 0 ? (totalPE / totalCE).toFixed(2) : '—'
  const pcrNum = totalCE > 0 ? totalPE / totalCE : 1

  return (
    <SectionCard
      title="OI Buildup"
      badge={`PCR ${pcr}`}
      collapsible
      defaultOpen
    >
      {/* PCR summary */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="text-center">
          <div className="text-[9px] text-[#ef4444] uppercase mb-0.5">Total CE OI</div>
          <div className="text-[#ef4444] font-bold text-xs">{formatOI(totalCE)}</div>
        </div>
        <div className="text-center">
          <div className={`text-xs font-bold px-2 py-0.5 rounded ${pcrNum > 1.2 ? 'bg-[#0d2b0d] text-[#22c55e]' : pcrNum < 0.8 ? 'bg-[#2b0d0d] text-[#ef4444]' : 'bg-[#1e293b] text-[#f59e0b]'}`}>
            PCR {pcr}
          </div>
          <div className="text-[8px] text-[#475569] mt-0.5">
            {pcrNum > 1.2 ? 'Bullish bias' : pcrNum < 0.8 ? 'Bearish bias' : 'Neutral'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-[#22c55e] uppercase mb-0.5">Total PE OI</div>
          <div className="text-[#22c55e] font-bold text-xs">{formatOI(totalPE)}</div>
        </div>
      </div>

      {/* OI bars — CE left, PE right */}
      <div className="space-y-0.5">
        {/* Header */}
        <div className="flex items-center text-[8px] text-[#475569] pb-1 border-b border-[#1e293b]">
          <span className="flex-1 text-right pr-2 text-[#ef4444]">CE OI</span>
          <span className="w-16 text-center font-bold">Strike</span>
          <span className="flex-1 pl-2 text-[#22c55e]">PE OI</span>
        </div>

        {rows.map(row => (
          <div
            key={row.strike}
            className={`flex items-center text-[9px] py-0.5 rounded ${
              row.isAtm ? 'bg-[#f59e0b]/10 border border-[#f59e0b]/20' : ''
            }`}
          >
            {/* CE OI bar (right-aligned, extends left) */}
            <div className="flex-1 flex items-center justify-end pr-1">
              <span className="text-[#64748b] mr-1 shrink-0">
                {formatOI(row.ceOI)}
                {row.ceOIChange !== 0 && (
                  <span className={`ml-0.5 ${row.ceOIChange > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                    {row.ceOIChange > 0 ? '↑' : '↓'}
                  </span>
                )}
              </span>
              <div className="relative h-4 flex items-center" style={{ width: 80 }}>
                <div
                  className="absolute right-0 h-3 rounded-l bg-[#ef4444]/60"
                  style={{ width: `${row.cePct}%` }}
                />
              </div>
            </div>

            {/* Strike label */}
            <div className={`w-16 text-center font-bold shrink-0 ${
              row.isAtm ? 'text-[#f59e0b]' : row.isMaxPain ? 'text-[#a855f7]' : 'text-white'
            }`}>
              {row.strike}
              {row.isAtm && <span className="text-[#f59e0b] text-[7px] block leading-none">ATM</span>}
              {row.isMaxPain && !row.isAtm && <span className="text-[#a855f7] text-[7px] block leading-none">MaxP</span>}
            </div>

            {/* PE OI bar (left-aligned, extends right) */}
            <div className="flex-1 flex items-center pl-1">
              <div className="relative h-4 flex items-center" style={{ width: 80 }}>
                <div
                  className="absolute left-0 h-3 rounded-r bg-[#22c55e]/60"
                  style={{ width: `${row.pePct}%` }}
                />
              </div>
              <span className="text-[#64748b] ml-1 shrink-0">
                {formatOI(row.peOI)}
                {row.peOIChange !== 0 && (
                  <span className={`ml-0.5 ${row.peOIChange > 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                    {row.peOIChange > 0 ? '↑' : '↓'}
                  </span>
                )}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mt-2 text-[8px] text-[#475569]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[#ef4444]/60" /> CE = Resistance</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[#22c55e]/60" /> PE = Support</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[#f59e0b]/30" /> ATM</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[#a855f7]/30" /> Max Pain</span>
      </div>
    </SectionCard>
  )
}
