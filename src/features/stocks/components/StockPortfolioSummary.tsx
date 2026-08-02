import { useQuery } from '@tanstack/react-query'
import { kiteAuthHeaders, API_BASE } from '@/core/services/apiClient'
import { PieChart, Shield } from 'lucide-react'
import { EventsCalendar } from './EventsCalendar'

interface KiteHolding {
  tradingsymbol: string
  quantity: number
  average_price: number
  last_price: number
  pnl: number
}

async function fetchHoldings(): Promise<KiteHolding[]> {
  const res = await fetch(`${API_BASE}/api/kite?kite_path=portfolio/holdings`, { headers: kiteAuthHeaders() })
  if (!res.ok) throw new Error(`${res.status}`)
  const json = await res.json()
  return (json.data ?? []) as KiteHolding[]
}

// Hardcoded SL assumptions (15% below avg) — user can configure later
function estimateSLRisk(h: KiteHolding) {
  const slPrice = h.average_price * 0.85
  return Math.max(0, h.average_price - slPrice) * h.quantity
}

export function StockPortfolioSummary() {
  const { data: holdings = [] } = useQuery({
    queryKey: ['stockHoldings'],
    queryFn: fetchHoldings,
    refetchInterval: 60000,
    retry: false,
  })

  const totalInvested = holdings.reduce((s, h) => s + h.average_price * h.quantity, 0)
  const totalCurrent  = holdings.reduce((s, h) => s + h.last_price * h.quantity, 0)
  const totalPnL      = totalCurrent - totalInvested
  const totalPct      = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0
  const totalRisk     = holdings.reduce((s, h) => s + estimateSLRisk(h), 0)
  const riskPct       = totalInvested > 0 ? (totalRisk / totalInvested) * 100 : 0

  const winners = holdings.filter(h => h.last_price > h.average_price)
  const losers  = holdings.filter(h => h.last_price < h.average_price)

  return (
    <div className="flex flex-col gap-0">

      {/* Portfolio summary */}
      <div className="p-3 border-b border-[#1e293b]">
        <div className="flex items-center gap-1.5 mb-3">
          <PieChart size={11} className="text-[#a78bfa]" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#94a3b8]">Portfolio</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-[9px] text-[#475569]">Invested</span>
            <span className="text-[10px] font-semibold text-white">₹{(totalInvested / 1000).toFixed(1)}K</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[9px] text-[#475569]">Current</span>
            <span className="text-[10px] font-semibold text-white">₹{(totalCurrent / 1000).toFixed(1)}K</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[9px] text-[#475569]">P&L</span>
            <span className={`text-[10px] font-bold ${totalPnL >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {totalPnL >= 0 ? '+' : ''}₹{Math.abs(totalPnL).toFixed(0)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[9px] text-[#475569]">Return</span>
            <span className={`text-[10px] font-bold ${totalPct >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {totalPct >= 0 ? '+' : ''}{totalPct.toFixed(2)}%
            </span>
          </div>

          {/* Win/loss bar */}
          {holdings.length > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-[8px] text-[#475569] mb-1">
                <span>{winners.length} winning</span>
                <span>{losers.length} losing</span>
              </div>
              <div className="flex h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#22c55e]" style={{ width: `${(winners.length / holdings.length) * 100}%` }} />
                <div className="bg-[#ef4444]" style={{ width: `${(losers.length / holdings.length) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Risk meter */}
      <div className="p-3 border-b border-[#1e293b]">
        <div className="flex items-center gap-1.5 mb-3">
          <Shield size={11} className="text-[#f59e0b]" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#94a3b8]">Risk Meter</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-[9px] text-[#475569]">At Risk (15% SL)</span>
            <span className="text-[10px] font-semibold text-[#f59e0b]">₹{(totalRisk / 1000).toFixed(1)}K</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[9px] text-[#475569]">Risk %</span>
            <span className={`text-[10px] font-bold ${riskPct > 20 ? 'text-[#ef4444]' : riskPct > 10 ? 'text-[#f59e0b]' : 'text-[#22c55e]'}`}>
              {riskPct.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${riskPct > 20 ? 'bg-[#ef4444]' : riskPct > 10 ? 'bg-[#f59e0b]' : 'bg-[#22c55e]'}`}
              style={{ width: `${Math.min(100, riskPct * 2)}%` }}
            />
          </div>
          <p className="text-[#334155] text-[8px]">Based on 15% trailing SL assumption</p>
        </div>
      </div>

      {/* Events calendar */}
      <EventsCalendar />

    </div>
  )
}
