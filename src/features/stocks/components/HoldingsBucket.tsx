import { useState } from 'react'
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

function holdingPct(h: KiteHolding) {
  if (h.average_price <= 0) return 0
  return ((h.last_price - h.average_price) / h.average_price) * 100
}

// ── Slicer types ──────────────────────────────────────────────────────────────

type PrimaryFilter = 'all' | 'profit' | 'loss'
type BucketFilter  = 'any' | 'small' | 'mid' | 'big'

const PROFIT_BUCKETS: { key: BucketFilter; label: string; min: number; max: number }[] = [
  { key: 'small', label: '0–2%',  min: 0,  max: 2  },
  { key: 'mid',   label: '2–5%',  min: 2,  max: 5  },
  { key: 'big',   label: '>5%',   min: 5,  max: Infinity },
]
const LOSS_BUCKETS: { key: BucketFilter; label: string; min: number; max: number }[] = [
  { key: 'small', label: '0–2%',  min: 0,  max: 2  },
  { key: 'mid',   label: '2–5%',  min: 2,  max: 5  },
  { key: 'big',   label: '>5%',   min: 5,  max: Infinity },
]

function applyFilter(holdings: KiteHolding[], primary: PrimaryFilter, bucket: BucketFilter) {
  return holdings.filter(h => {
    const p = holdingPct(h)
    if (primary === 'profit') {
      if (p <= 0) return false
      if (bucket === 'any') return true
      const b = PROFIT_BUCKETS.find(x => x.key === bucket)
      return b ? p >= b.min && p < b.max : true
    }
    if (primary === 'loss') {
      if (p >= 0) return false
      const abs = Math.abs(p)
      if (bucket === 'any') return true
      const b = LOSS_BUCKETS.find(x => x.key === bucket)
      return b ? abs >= b.min && abs < b.max : true
    }
    return true // 'all'
  })
}

// ── Row ───────────────────────────────────────────────────────────────────────

function HoldingRow({ h }: { h: KiteHolding }) {
  const p    = holdingPct(h)
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

// ── Slicer bar ────────────────────────────────────────────────────────────────

function SlicerBar({ holdings, primary, setPrimary, bucket, setBucket }: {
  holdings: KiteHolding[]
  primary: PrimaryFilter
  setPrimary: (f: PrimaryFilter) => void
  bucket: BucketFilter
  setBucket: (b: BucketFilter) => void
}) {
  const gainers = holdings.filter(h => holdingPct(h) > 0)
  const losers  = holdings.filter(h => holdingPct(h) < 0)

  const buckets = primary === 'profit' ? PROFIT_BUCKETS : primary === 'loss' ? LOSS_BUCKETS : []

  function pickPrimary(f: PrimaryFilter) {
    setPrimary(f)
    setBucket('any')
  }

  return (
    <div className="px-3 py-2 border-b border-[#1e293b] bg-[#060d1a] space-y-1.5">
      {/* Primary row */}
      <div className="flex gap-1">
        {([
          { key: 'all'    as PrimaryFilter, label: `All (${holdings.length})`,   active: 'bg-[#1e3a5f] text-[#38bdf8]',   inactive: 'bg-[#0a1628] text-[#475569] hover:text-[#94a3b8]' },
          { key: 'profit' as PrimaryFilter, label: `Profit (${gainers.length})`, active: 'bg-[#22c55e]/20 text-[#22c55e]', inactive: 'bg-[#0a1628] text-[#475569] hover:text-[#22c55e]' },
          { key: 'loss'   as PrimaryFilter, label: `Loss (${losers.length})`,    active: 'bg-[#ef4444]/20 text-[#ef4444]', inactive: 'bg-[#0a1628] text-[#475569] hover:text-[#ef4444]'  },
        ]).map(({ key, label, active, inactive }) => (
          <button
            key={key}
            onClick={() => pickPrimary(key)}
            className={`flex-1 text-[9px] font-bold py-1 rounded border transition-colors ${
              primary === key
                ? `${active} border-current`
                : `${inactive} border-[#1e293b]`
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Bucket row — only when Profit or Loss selected */}
      {buckets.length > 0 && (
        <div className="flex gap-1">
          <button
            onClick={() => setBucket('any')}
            className={`flex-1 text-[8px] font-semibold py-0.5 rounded transition-colors ${
              bucket === 'any'
                ? primary === 'profit' ? 'bg-[#22c55e]/15 text-[#22c55e]' : 'bg-[#ef4444]/15 text-[#ef4444]'
                : 'text-[#334155] hover:text-[#64748b]'
            }`}
          >
            Any
          </button>
          {buckets.map(b => {
            const count = holdings.filter(h => {
              const p = holdingPct(h)
              if (primary === 'profit' && p <= 0) return false
              if (primary === 'loss'   && p >= 0) return false
              const abs = Math.abs(p)
              return abs >= b.min && abs < b.max
            }).length
            const isActive = bucket === b.key
            return (
              <button
                key={b.key}
                onClick={() => setBucket(b.key)}
                className={`flex-1 text-[8px] font-semibold py-0.5 rounded transition-colors ${
                  isActive
                    ? primary === 'profit' ? 'bg-[#22c55e]/15 text-[#22c55e]' : 'bg-[#ef4444]/15 text-[#ef4444]'
                    : 'text-[#334155] hover:text-[#64748b]'
                }`}
              >
                {b.label} <span className="opacity-60">({count})</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function HoldingsBucket() {
  const [primary, setPrimary] = useState<PrimaryFilter>('all')
  const [bucket,  setBucket]  = useState<BucketFilter>('any')

  const { data: rawHoldings, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['stockHoldings'],
    queryFn: fetchHoldings,
    refetchInterval: 60000,
    retry: false,
  })

  const isMock   = !isLoading && (!rawHoldings || rawHoldings.length === 0)
  const holdings = isMock ? MOCK_HOLDINGS : (rawHoldings ?? [])
  const visible  = applyFilter(holdings, primary, bucket)

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

      {/* Slicers */}
      {!isLoading && holdings.length > 0 && (
        <SlicerBar
          holdings={holdings}
          primary={primary} setPrimary={setPrimary}
          bucket={bucket}   setBucket={setBucket}
        />
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={18} className="animate-spin text-[#38bdf8]" />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 && !isLoading && (
          <div className="py-10 text-center text-[#334155] text-[10px]">No holdings in this range</div>
        )}
        {visible.map(h => <HoldingRow key={h.tradingsymbol} h={h} />)}
      </div>

    </div>
  )
}
