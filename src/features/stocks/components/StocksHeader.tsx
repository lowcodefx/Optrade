import { useQuery } from '@tanstack/react-query'
import { kiteAuthHeaders, API_BASE } from '@/core/services/apiClient'

interface IndexQuote { last_price: number; net_change: number; ohlc: { close: number } }

async function fetchIndices() {
  const symbols = [
    'NSE:NIFTY 50', 'BSE:SENSEX',
    'NSE:NIFTY MIDCAP 150', 'NSE:NIFTY SMALLCAP 250',
  ]
  const qs = symbols.map(s => `i=${encodeURIComponent(s)}`).join('&')
  const res = await fetch(`${API_BASE}/api/kite?kite_path=quote/indices&${qs}`, { headers: kiteAuthHeaders() })
  if (!res.ok) return null
  const json = await res.json()
  return json.data as Record<string, IndexQuote>
}

const LABELS: Record<string, string> = {
  'NSE:NIFTY 50': 'NIFTY 50',
  'BSE:SENSEX': 'SENSEX',
  'NSE:NIFTY MIDCAP 150': 'MIDCAP 150',
  'NSE:NIFTY SMALLCAP 250': 'SMALLCAP 250',
}

export function StocksHeader() {
  const { data } = useQuery({ queryKey: ['stockIndices'], queryFn: fetchIndices, refetchInterval: 30000 })

  const indices = [
    'NSE:NIFTY 50', 'BSE:SENSEX', 'NSE:NIFTY MIDCAP 150', 'NSE:NIFTY SMALLCAP 250',
  ]

  return (
    <div className="flex items-center gap-6 px-4 py-2 border-b border-[#1e293b] bg-[#060d1a] shrink-0 overflow-x-auto">
      {indices.map(key => {
        const q = data?.[key]
        const chg = q ? q.last_price - q.ohlc.close : 0
        const pct = q ? (chg / q.ohlc.close) * 100 : 0
        const pos = chg >= 0
        return (
          <div key={key} className="flex items-center gap-2 shrink-0">
            <span className="text-[#475569] text-[9px] uppercase tracking-widest">{LABELS[key]}</span>
            <span className="text-white font-bold text-xs">
              {q ? q.last_price.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '—'}
            </span>
            {q && (
              <span className={`text-[9px] font-semibold ${pos ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                {pos ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
              </span>
            )}
            <div className="w-px h-3 bg-[#1e293b] ml-2" />
          </div>
        )
      })}
    </div>
  )
}
