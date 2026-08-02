import { useQuery } from '@tanstack/react-query'
import { kiteAuthHeaders, API_BASE } from '@/core/services/apiClient'
import { RefreshCw, TrendingUp, TrendingDown, FlaskConical } from 'lucide-react'

interface KiteHolding {
  tradingsymbol: string
  exchange: string
  quantity: number
  average_price: number
  last_price: number
  pnl: number
  day_change: number
  day_change_percentage: number
  close_price: number
}

const MOCK_HOLDINGS: KiteHolding[] = [
  { tradingsymbol: 'RELIANCE',   exchange: 'NSE', quantity: 5,  average_price: 2820, last_price: 2950, pnl: 650,  day_change: 18,  day_change_percentage: 0.61,  close_price: 2932 },
  { tradingsymbol: 'INFY',       exchange: 'NSE', quantity: 10, average_price: 1540, last_price: 1590, pnl: 500,  day_change: -8,  day_change_percentage: -0.50, close_price: 1598 },
  { tradingsymbol: 'HDFCBANK',   exchange: 'NSE', quantity: 8,  average_price: 1680, last_price: 1720, pnl: 320,  day_change: 12,  day_change_percentage: 0.70,  close_price: 1708 },
  { tradingsymbol: 'TCS',        exchange: 'NSE', quantity: 3,  average_price: 3650, last_price: 3820, pnl: 510,  day_change: 35,  day_change_percentage: 0.92,  close_price: 3785 },
  { tradingsymbol: 'BHARTIARTL', exchange: 'NSE', quantity: 15, average_price:  920, last_price:  990, pnl: 1050, day_change: -5,  day_change_percentage: -0.50, close_price:  995 },
]

async function fetchHoldings(): Promise<KiteHolding[]> {
  const res = await fetch(`${API_BASE}/api/kite?kite_path=portfolio/holdings`, { headers: kiteAuthHeaders() })
  if (!res.ok) throw new Error(`${res.status}`)
  const json = await res.json()
  return (json.data ?? []) as KiteHolding[]
}

function pct(avg: number, ltp: number) {
  if (avg <= 0) return 0
  return ((ltp - avg) / avg) * 100
}

function HoldingRow({ h }: { h: KiteHolding }) {
  const p    = pct(h.average_price, h.last_price)
  const gain = (h.last_price - h.average_price) * h.quantity
  const isUp = p >= 0
  return (
    <div className="px-3 py-2.5 border-b border-[#0f1f35] hover:bg-[#0a1628] transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${isUp ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`} />
          <div>
            <div className="text-white text-[11px] font-semibold">{h.tradingsymbol}</div>
            <div className="text-[#475569] text-[9px]">{h.quantity} shares · avg ₹{h.average_price.toFixed(1)}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-white text-[11px] font-bold">₹{h.last_price.toFixed(1)}</div>
          <div className={`flex items-center gap-0.5 justify-end text-[9px] font-semibold ${isUp ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {isUp ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
            {p >= 0 ? '+' : ''}{p.toFixed(2)}%
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <div className="flex-1 h-1 bg-[#1e293b] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${isUp ? 'bg-[#22c55e]/60' : 'bg-[#ef4444]/60'}`}
            style={{ width: `${Math.min(100, Math.abs(p) * 5)}%` }}
          />
        </div>
        <span className={`text-[9px] font-semibold ml-2 ${isUp ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
          {gain >= 0 ? '+' : ''}₹{Math.abs(gain).toFixed(0)}
        </span>
      </div>
      <div className="text-[8px] text-[#334155] mt-0.5">
        Day: <span className={h.day_change >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
          {h.day_change >= 0 ? '+' : ''}{h.day_change_percentage?.toFixed(2) ?? '0.00'}%
        </span>
      </div>
    </div>
  )
}

export function HoldingsBucket() {
  const { data: rawHoldings, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['stockHoldings'],
    queryFn: fetchHoldings,
    refetchInterval: 60000,
    retry: false,
  })

  const isMock     = !isLoading && (!rawHoldings || rawHoldings.length === 0)
  const holdings   = isMock ? MOCK_HOLDINGS : (rawHoldings ?? [])

  const totalInvested = holdings.reduce((s, h) => s + h.average_price * h.quantity, 0)
  const totalCurrent  = holdings.reduce((s, h) => s + h.last_price * h.quantity, 0)
  const totalPnL      = totalCurrent - totalInvested
  const totalPct      = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1e293b] bg-[#060d1a] sticky top-0 z-10">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-[#e2e8f0] text-xs font-bold">My Holdings</h2>
            {isMock && (
              <span className="flex items-center gap-0.5 bg-[#f59e0b]/10 text-[#f59e0b] text-[7px] font-bold px-1.5 py-0.5 rounded border border-[#f59e0b]/20">
                <FlaskConical size={7} /> Demo
              </span>
            )}
          </div>
          <p className="text-[#334155] text-[8px]">{isMock ? 'Connect Zerodha to see your portfolio' : 'From Zerodha · refreshes every 60s'}</p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching} className="text-[#475569] hover:text-[#94a3b8] disabled:opacity-40 transition-colors">
          <RefreshCw size={11} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Summary bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#0a1628] border-b border-[#1e293b]">
        <div>
          <div className="text-[8px] text-[#475569]">Invested</div>
          <div className="text-[11px] font-bold text-white">₹{(totalInvested / 1000).toFixed(1)}K</div>
        </div>
        <div>
          <div className="text-[8px] text-[#475569]">Current</div>
          <div className="text-[11px] font-bold text-white">₹{(totalCurrent / 1000).toFixed(1)}K</div>
        </div>
        <div className="text-right">
          <div className="text-[8px] text-[#475569]">Overall P&L</div>
          <div className={`text-[11px] font-bold ${totalPnL >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {totalPnL >= 0 ? '+' : ''}₹{Math.abs(totalPnL).toFixed(0)}
            <span className="text-[9px] ml-1">({totalPct >= 0 ? '+' : ''}{totalPct.toFixed(1)}%)</span>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={18} className="animate-spin text-[#38bdf8]" />
        </div>
      )}

      <div className="flex-1">
        {holdings.map(h => <HoldingRow key={h.tradingsymbol} h={h} />)}
      </div>
    </div>
  )
}
