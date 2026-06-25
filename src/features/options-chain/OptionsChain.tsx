import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useMarketStore, useOrderStore } from '@/core/store'
import { SectionCard } from '@/components/SectionCard'
import { formatOI } from '@/lib/utils'
import { RefreshCw } from 'lucide-react'

const tooltip = {
  title: 'Options Chain',
  what: 'Displays Open Interest, volume, and IV for CALL and PUT options across 7 strikes (ATM±3).',
  why: 'OI shows where smart money is positioned. High Put OI = strong support. High Call OI = resistance.',
  how: 'Watch for highest OI strikes as support/resistance. OI addition = building position. OI shedding = unwinding.',
  bullish: 'Put writing (PE OI increasing) at lower strikes = bullish. PCR rising above 1.2 = bullish.',
  bearish: 'Call writing (CE OI increasing) at higher strikes = bearish. PCR falling below 0.8 = bearish.',
}

type Filter = 'all' | 'top-oi' | 'top-vol'

export function OptionsChain() {
  const chain = useMarketStore(s => s.optionChain)
  const [filter, setFilter] = useState<Filter>('all')
  const [refreshing, setRefreshing] = useState(false)
  const optionType = useOrderStore(s => s.optionType)
  const qc = useQueryClient()

  function refresh() {
    setRefreshing(true)
    qc.invalidateQueries({ queryKey: ['option-chain'] })
    setTimeout(() => setRefreshing(false), 2000)
  }

  if (!chain) return (
    <SectionCard title="Options Chain" tooltip={tooltip} noPadding>
      <div className="px-3 py-8 text-center text-[#475569] text-[10px]">
        <div className="w-5 h-5 border-2 border-[#38bdf8] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        Loading option chain… (downloading instruments)
        <button onClick={refresh} className="block mx-auto mt-3 text-[#38bdf8] text-[9px] border border-[#38bdf8] px-3 py-1 rounded hover:bg-[#0f1f35] transition-colors">
          Retry
        </button>
      </div>
    </SectionCard>
  )

  const maxCEOI = Math.max(...chain.strikes.map(s => s.ce.oi))
  const maxPEOI = Math.max(...chain.strikes.map(s => s.pe.oi))
  const maxVol = Math.max(...chain.strikes.flatMap(s => [s.ce.volume, s.pe.volume]))

  let displayed = chain.strikes
  if (filter === 'top-oi') displayed = [...chain.strikes].sort((a, b) => (b.ce.oi + b.pe.oi) - (a.ce.oi + a.pe.oi)).slice(0, 5)
  if (filter === 'top-vol') displayed = [...chain.strikes].sort((a, b) => (b.ce.volume + b.pe.volume) - (a.ce.volume + a.pe.volume)).slice(0, 5)

  return (
    <SectionCard title="Options Chain" tooltip={tooltip} noPadding>
      {/* Filters + expiry */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#1e293b]">
        <span className="text-[#64748b] text-[9px] mr-1">{chain.expiry}</span>
        {(['all', 'top-oi', 'top-vol'] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${filter === f ? 'bg-[#1e3a5f] text-[#38bdf8] border-[#38bdf8]' : 'text-[#475569] border-[#1e293b] hover:text-white'}`}>
            {f === 'all' ? 'ATM ±3' : f === 'top-oi' ? 'Top OI' : 'Top Vol'}
          </button>
        ))}
        <button onClick={refresh} title="Refresh chain" className={`ml-auto text-[#475569] hover:text-[#38bdf8] transition-colors ${refreshing ? 'animate-spin' : ''}`}>
          <RefreshCw size={11} />
        </button>
        <span className="text-[9px] text-[#64748b]">
          PCR: <span className={chain.totalPEOI / chain.totalCEOI > 1 ? 'text-[#22c55e] font-semibold' : 'text-[#ef4444] font-semibold'}>{(chain.totalPEOI / chain.totalCEOI).toFixed(2)}</span>
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="text-[#475569] bg-[#0a1628]">
              <th className="py-1.5 px-2 text-right font-medium">OI</th>
              <th className="py-1.5 px-1 text-right font-medium">Chng</th>
              <th className="py-1.5 px-1 text-right font-medium">Vol</th>
              <th className="py-1.5 px-1 text-right font-medium">IV</th>
              <th className="py-1.5 px-2 text-center font-semibold text-[#38bdf8] bg-[#132036]">STRIKE</th>
              <th className="py-1.5 px-1 text-left font-medium">IV</th>
              <th className="py-1.5 px-1 text-left font-medium">Vol</th>
              <th className="py-1.5 px-1 text-left font-medium">Chng</th>
              <th className="py-1.5 px-2 text-left font-medium">OI</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map(row => {
              const isATM = row.strike === chain.atmStrike
              const ceHighOI = row.ce.oi === maxCEOI
              const peHighOI = row.pe.oi === maxPEOI
              const ceHighVol = row.ce.volume === maxVol
              const peHighVol = row.pe.volume === maxVol

              return (
                <tr key={row.strike}
                  className={`border-b border-[#0f1f35] cursor-pointer hover:bg-[#0a1628] transition-colors ${isATM ? 'bg-[#0a1f0a]' : ''}`}
                  style={isATM ? { borderLeft: '2px solid #22c55e' } : {}}
                  onClick={() => useOrderStore.getState().setStrike(row.strike, optionType, optionType === 'CE' ? row.ce.ltp : row.pe.ltp)}
                >
                  <td className={`py-1.5 px-2 text-right ${ceHighOI ? 'text-[#ef4444] font-bold' : 'text-[#94a3b8]'}`}>{formatOI(row.ce.oi)}</td>
                  <td className={`py-1.5 px-1 text-right text-[9px] ${row.ce.oiChange > 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{row.ce.oiChange > 0 ? '+' : ''}{formatOI(row.ce.oiChange)}</td>
                  <td className={`py-1.5 px-1 text-right ${ceHighVol ? 'text-[#f59e0b] font-semibold' : 'text-[#64748b]'}`}>{formatOI(row.ce.volume)}</td>
                  <td className="py-1.5 px-1 text-right text-[#64748b]">{row.ce.iv.toFixed(1)}</td>
                  <td className={`py-1.5 px-2 text-center font-semibold ${isATM ? 'text-[#38bdf8] bg-[#132036]' : 'text-[#94a3b8] bg-[#0f172a]'}`}>
                    {row.strike}{isATM && <span className="text-[8px] ml-1 text-[#38bdf8]">ATM</span>}
                  </td>
                  <td className="py-1.5 px-1 text-[#64748b]">{row.pe.iv.toFixed(1)}</td>
                  <td className={`py-1.5 px-1 ${peHighVol ? 'text-[#f59e0b] font-semibold' : 'text-[#64748b]'}`}>{formatOI(row.pe.volume)}</td>
                  <td className={`py-1.5 px-1 text-[9px] ${row.pe.oiChange > 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{row.pe.oiChange > 0 ? '+' : ''}{formatOI(row.pe.oiChange)}</td>
                  <td className={`py-1.5 px-2 ${peHighOI ? 'text-[#22c55e] font-bold' : 'text-[#94a3b8]'}`}>{formatOI(row.pe.oi)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-1.5 text-[9px] text-[#475569] border-t border-[#0f1f35] flex gap-4">
        <span>Max Call OI: <span className="text-[#ef4444] font-semibold">{chain.strikes.find(s => s.ce.oi === maxCEOI)?.strike}</span></span>
        <span>Max Put OI: <span className="text-[#22c55e] font-semibold">{chain.strikes.find(s => s.pe.oi === maxPEOI)?.strike}</span></span>
        <span>Max Pain: <span className="text-[#f59e0b] font-semibold">{chain.maxPainStrike}</span></span>
      </div>
    </SectionCard>
  )
}
