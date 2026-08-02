import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { kiteAuthHeaders, API_BASE } from '@/core/services/apiClient'
import { Plus, X, Eye } from 'lucide-react'

async function fetchQuotes(symbols: string[]) {
  if (symbols.length === 0) return {}
  const qs = symbols.map(s => `i=NSE:${encodeURIComponent(s)}`).join('&')
  const res = await fetch(`${API_BASE}/api/kite?kite_path=quote&${qs}`, { headers: kiteAuthHeaders() })
  if (!res.ok) return {}
  const json = await res.json()
  return json.data as Record<string, { last_price: number; net_change: number; ohlc: { close: number } }>
}

export function StocksWatchlist({ watchlist, onRemove, onAdd }: {
  watchlist: string[]
  onRemove: (s: string) => void
  onAdd: (s: string) => void
}) {
  const [input, setInput] = useState('')

  const { data: quotes = {} } = useQuery({
    queryKey: ['watchlistQuotes', watchlist],
    queryFn: () => fetchQuotes(watchlist),
    enabled: watchlist.length > 0,
    refetchInterval: 30000,
  })

  function handleAdd() {
    const sym = input.trim().toUpperCase()
    if (sym && !watchlist.includes(sym)) { onAdd(sym); setInput('') }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-[#1e293b]">
        <div className="flex items-center gap-1.5 mb-2">
          <Eye size={11} className="text-[#38bdf8]" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#94a3b8]">Watchlist</span>
        </div>
        <div className="flex gap-1">
          <input
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Add symbol…"
            className="flex-1 bg-[#060d1a] border border-[#1e3a5f] rounded px-2 py-1 text-[10px] text-white placeholder:text-[#334155] focus:outline-none focus:border-[#38bdf8]/50"
          />
          <button onClick={handleAdd} className="bg-[#1e3a5f] hover:bg-[#38bdf8]/20 text-[#38bdf8] rounded px-1.5 transition-colors">
            <Plus size={11} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {watchlist.length === 0 && (
          <div className="px-3 py-6 text-center text-[#334155] text-[9px]">
            Add symbols to track
          </div>
        )}
        {watchlist.map(sym => {
          const q = quotes[`NSE:${sym}`]
          const chg = q ? ((q.last_price - q.ohlc.close) / q.ohlc.close) * 100 : null
          const pos = (chg ?? 0) >= 0
          return (
            <div key={sym} className="flex items-center justify-between px-3 py-2 border-b border-[#0f1f35] hover:bg-[#0a1628] transition-colors group">
              <div>
                <div className="text-white text-[10px] font-semibold">{sym}</div>
                {q && (
                  <div className={`text-[9px] font-semibold ${pos ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                    ₹{q.last_price.toFixed(1)} <span className="text-[8px]">{chg !== null ? (pos ? '+' : '') + chg.toFixed(2) + '%' : ''}</span>
                  </div>
                )}
                {!q && <div className="text-[#334155] text-[9px]">—</div>}
              </div>
              <button onClick={() => onRemove(sym)} className="text-[#1e293b] group-hover:text-[#ef4444] transition-colors">
                <X size={10} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Sector heatmap */}
      <div className="border-t border-[#1e293b] p-3">
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#94a3b8] mb-2">Sectors</div>
        <div className="grid grid-cols-2 gap-1">
          {[
            { name: 'IT',      color: 'bg-[#22c55e]/20 text-[#22c55e]' },
            { name: 'Banks',   color: 'bg-[#ef4444]/20 text-[#ef4444]' },
            { name: 'Pharma',  color: 'bg-[#22c55e]/20 text-[#22c55e]' },
            { name: 'Auto',    color: 'bg-[#f59e0b]/20 text-[#f59e0b]' },
            { name: 'FMCG',    color: 'bg-[#22c55e]/20 text-[#22c55e]' },
            { name: 'Metal',   color: 'bg-[#ef4444]/20 text-[#ef4444]' },
            { name: 'Energy',  color: 'bg-[#f59e0b]/20 text-[#f59e0b]' },
            { name: 'Realty',  color: 'bg-[#22c55e]/20 text-[#22c55e]' },
          ].map(s => (
            <div key={s.name} className={`rounded px-1.5 py-1 text-[8px] font-semibold text-center ${s.color}`}>
              {s.name}
            </div>
          ))}
        </div>
        <p className="text-[#1e293b] text-[7px] mt-1 text-center">Sector data coming soon</p>
      </div>
    </div>
  )
}
