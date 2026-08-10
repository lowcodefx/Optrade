import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { kiteAuthHeaders, API_BASE } from '@/core/services/apiClient'
import { RefreshCw, ChevronDown, ChevronUp, ChevronsUpDown, CalendarDays } from 'lucide-react'

// â”€â”€ Aging helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const BUY_DATES_KEY = 'sw_buy_dates'

function loadBuyDates(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(BUY_DATES_KEY) ?? '{}') } catch { return {} }
}
function saveBuyDates(d: Record<string, string>) {
  localStorage.setItem(BUY_DATES_KEY, JSON.stringify(d))
}

function daysHeld(symbol: string, buyDates: Record<string, string>): number | null {
  const d = buyDates[symbol]
  if (!d) return null
  const diff = Date.now() - new Date(d).getTime()
  return Math.max(0, Math.floor(diff / 86400000))
}

function agingColor(days: number | null): string {
  if (days === null) return 'text-[#64748b]'
  if (days <= 5)  return 'text-[#38bdf8]'   // fresh â€” blue
  if (days <= 14) return 'text-[#22c55e]'   // sweet spot â€” green
  if (days <= 21) return 'text-[#f59e0b]'   // getting long â€” amber
  return 'text-[#ef4444]'                    // overdue â€” red (>21d swing)
}

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface KiteHolding {
  tradingsymbol: string
  exchange: string
  quantity: number
  t1_quantity: number   // shares in T+1 settlement (bought today or yesterday)
  average_price: number
  last_price: number
  pnl: number
  day_change: number
  day_change_percentage: number
  close_price: number
}

interface KiteTrade {
  tradingsymbol: string
  transaction_type: 'BUY' | 'SELL'
  product: string
  order_timestamp: string // e.g. "2026-08-10 10:35:00"
}

// â”€â”€ Fetch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function fetchHoldings(): Promise<KiteHolding[]> {
  const res = await fetch(`${API_BASE}/api/kite?kite_path=portfolio/holdings`, { headers: kiteAuthHeaders() })
  if (!res.ok) throw new Error(`${res.status}`)
  const json = await res.json()
  return (json.data ?? []) as KiteHolding[]
}

async function fetchTodayTrades(): Promise<KiteTrade[]> {
  try {
    const res = await fetch(`${API_BASE}/api/kite?kite_path=trades`, { headers: kiteAuthHeaders() })
    if (!res.ok) return []
    const json = await res.json()
    return (json.data ?? []) as KiteTrade[]
  } catch { return [] }
}

function prevTradingDay(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

// â”€â”€ Cap profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const LARGE_CAP_SYMS = new Set([
  'RELIANCE','TCS','HDFCBANK','INFY','ICICIBANK','BHARTIARTL','ITC',
  'KOTAKBANK','LT','WIPRO','HDFC','BAJFINANCE','ASIANPAINT','MARUTI',
  'TITAN','SUNPHARMA','NTPC','ONGC','COALINDIA','TATASTEEL',
])
const MID_CAP_SYMS = new Set([
  'MPHASIS','PIIND','LTTS','COFORGE','PERSISTENT','ABCAPITAL',
  'SONACOMS','LTIM','KALYANKJIL','AARTIIND',
])

function capProfile(symbol: string) {
  if (LARGE_CAP_SYMS.has(symbol)) return { slPct: 0.05, tgtPct: 0.12, label: 'LG' }
  if (MID_CAP_SYMS.has(symbol))   return { slPct: 0.07, tgtPct: 0.16, label: 'MD' }
  return                                  { slPct: 0.10, tgtPct: 0.22, label: 'SM' }
}

// â”€â”€ Computed row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface ComputedRow {
  h: KiteHolding
  cap: string
  pct: number
  totalPnL: number
  dayPnL: number
  dayPnLAmount: number
  slPrice: number
  tgtPrice: number
  progressPct: number
  originalRisk: number
  achievedRR: number
  remainingRR: number
  slHit: boolean
  targetHit: boolean
  rrAlert: boolean
}

function compute(h: KiteHolding): ComputedRow {
  const { slPct, tgtPct, label } = capProfile(h.tradingsymbol)
  const slPrice  = h.average_price * (1 - slPct)
  const tgtPrice = h.average_price * (1 + tgtPct)
  const pct      = h.average_price > 0 ? ((h.last_price - h.average_price) / h.average_price) * 100 : 0
  const totalPnL = (h.last_price - h.average_price) * h.quantity
  const dayPnL   = h.day_change_percentage ?? 0
  const originalRisk   = h.average_price - slPrice
  const achievedProfit = h.last_price - h.average_price
  const achievedRR     = originalRisk > 0 ? achievedProfit / originalRisk : 0
  const riskRem        = Math.max(0, h.last_price - slPrice)
  const rewardRem      = Math.max(0, tgtPrice - h.last_price)
  const remainingRR    = riskRem > 0 ? rewardRem / riskRem : 0
  const dayPnLAmount = h.day_change * h.quantity
  const progressPct  = Math.max(0, Math.min(100, ((h.last_price - slPrice) / (tgtPrice - slPrice)) * 100))
  return {
    h, cap: label, pct, totalPnL, dayPnL, dayPnLAmount,
    slPrice, tgtPrice, progressPct, originalRisk, achievedRR, remainingRR,
    slHit:    h.last_price <= slPrice,
    targetHit: h.last_price >= tgtPrice,
    rrAlert:  achievedRR >= 2.5,
  }
}

// â”€â”€ Filter types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type PrimaryFilter = 'all' | 'profit' | 'loss'
type BucketFilter  = 'any' | 'small' | 'mid' | 'big'
type SortKey = 'symbol' | 'price' | 'pnl' | 'rr' | 'day' | 'age'
type SortDir = 'asc' | 'desc'

const BUCKETS = [
  { key: 'small' as BucketFilter, label: '0â€“2%',  min: 0, max: 2  },
  { key: 'mid'   as BucketFilter, label: '2â€“5%',  min: 2, max: 5  },
  { key: 'big'   as BucketFilter, label: '>5%',   min: 5, max: Infinity },
]

// â”€â”€ Column header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ColHeader({ label, sortKey, current, dir, onSort }: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir
  onSort: (k: SortKey) => void
}) {
  const active = current === sortKey
  return (
    <th
      onClick={() => onSort(sortKey)}
      className="px-2 py-2 text-left text-[8px] font-bold uppercase tracking-widest text-[#475569] cursor-pointer hover:text-[#94a3b8] whitespace-nowrap select-none"
    >
      <div className="flex items-center gap-0.5">
        {label}
        {active
          ? dir === 'asc' ? <ChevronUp size={8} className="text-[#38bdf8]" /> : <ChevronDown size={8} className="text-[#38bdf8]" />
          : <ChevronsUpDown size={7} className="opacity-30" />}
      </div>
    </th>
  )
}

// â”€â”€ Status badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StatusBadge({ r }: { r: ComputedRow }) {
  if (r.targetHit) return <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30 whitespace-nowrap">TARGET</span>
  if (r.slHit)     return <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30 whitespace-nowrap">SL HIT</span>
  if (r.rrAlert)   return <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 whitespace-nowrap">2.5R âœ“</span>
  if (r.remainingRR >= 2) return <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 whitespace-nowrap">HOLD</span>
  if (r.remainingRR >= 1) return <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 whitespace-nowrap">CAUTION</span>
  return <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20 whitespace-nowrap">EXIT?</span>
}

// â”€â”€ RR color â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function rrColor(r: ComputedRow) {
  if (r.slHit || r.achievedRR < 0) return 'text-[#ef4444]'
  if (r.targetHit || r.achievedRR >= 2.5) return 'text-[#22c55e]'
  if (r.achievedRR >= 1.0) return 'text-[#22c55e] opacity-80'
  return 'text-[#f59e0b]'
}

// â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function HoldingsBucket() {
  const [primary, setPrimary] = useState<PrimaryFilter>('all')
  const [bucket,  setBucket]  = useState<BucketFilter>('any')
  const [sortKey, setSortKey] = useState<SortKey>('pnl')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [buyDates, setBuyDates] = useState<Record<string, string>>(loadBuyDates)

  const { data: rawHoldings, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['stockHoldings'],
    queryFn: fetchHoldings,
    refetchInterval: 60000,
    retry: false,
  })

  // Auto-infer buy dates from today's trades and T+1 settlement quantity
  const tradesFetchedRef = useRef(false)
  useEffect(() => {
    if (!rawHoldings?.length || tradesFetchedRef.current) return
    const missing = rawHoldings.filter(h => !buyDates[h.tradingsymbol])
    if (!missing.length) return

    tradesFetchedRef.current = true
    fetchTodayTrades().then(trades => {
      const todayBuys = new Map<string, string>()
      for (const t of trades) {
        if (t.transaction_type === 'BUY' && t.product === 'CNC') {
          todayBuys.set(t.tradingsymbol, t.order_timestamp.slice(0, 10))
        }
      }
      let changed = false
      const next = { ...buyDates }
      for (const h of missing) {
        if (todayBuys.has(h.tradingsymbol)) {
          next[h.tradingsymbol] = todayBuys.get(h.tradingsymbol)!
          changed = true
        } else if ((h.t1_quantity ?? 0) > 0) {
          // T+1 means bought on the previous trading day
          next[h.tradingsymbol] = prevTradingDay()
          changed = true
        }
      }
      if (changed) { saveBuyDates(next); setBuyDates(next) }
    })
  }, [rawHoldings]) // eslint-disable-line react-hooks/exhaustive-deps

  const holdings = (rawHoldings ?? []).map(compute)

  // Filter
  const filtered = holdings.filter(r => {
    if (primary === 'profit') {
      if (r.pct <= 0) return false
      if (bucket === 'any') return true
      const b = BUCKETS.find(x => x.key === bucket)!
      return r.pct >= b.min && r.pct < b.max
    }
    if (primary === 'loss') {
      if (r.pct >= 0) return false
      const abs = Math.abs(r.pct)
      if (bucket === 'any') return true
      const b = BUCKETS.find(x => x.key === bucket)!
      return abs >= b.min && abs < b.max
    }
    return true
  })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let av = 0, bv = 0
    if (sortKey === 'symbol') { av = a.h.tradingsymbol < b.h.tradingsymbol ? -1 : 1; bv = 0 }
    else if (sortKey === 'price') { av = a.h.last_price; bv = b.h.last_price }
    else if (sortKey === 'pnl')   { av = a.totalPnL;     bv = b.totalPnL }
    else if (sortKey === 'rr')    { av = a.achievedRR;   bv = b.achievedRR }
    else if (sortKey === 'day')   { av = a.dayPnLAmount;  bv = b.dayPnLAmount }
    else if (sortKey === 'age')  { av = daysHeld(a.h.tradingsymbol, buyDates) ?? -1; bv = daysHeld(b.h.tradingsymbol, buyDates) ?? -1 }
    if (sortKey === 'symbol') return sortDir === 'asc' ? av : -av
    return sortDir === 'asc' ? av - bv : bv - av
  })

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('desc') }
  }

  function pickPrimary(f: PrimaryFilter) { setPrimary(f); setBucket('any') }

  const gainers = holdings.filter(r => r.pct > 0)
  const losers  = holdings.filter(r => r.pct < 0)

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e293b] bg-[#060d1a] sticky top-0 z-10">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-[#e2e8f0] text-xs font-bold">My Holdings</h2>
          </div>
          <p className="text-[#64748b] text-[8px]">Live Â· refreshes every 60s</p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching} className="text-[#475569] hover:text-[#94a3b8] disabled:opacity-40">
          <RefreshCw size={11} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Slicers */}
      {!isLoading && holdings.length > 0 && (
        <div className="px-3 py-1.5 border-b border-[#1e293b] bg-[#060d1a] space-y-1 shrink-0">
          <div className="flex gap-1">
            {([
              { key: 'all'    as PrimaryFilter, label: `All (${holdings.length})`,   ac: 'bg-[#1e3a5f] text-[#38bdf8] border-[#38bdf8]/40',   in: 'text-[#475569] border-[#1e293b] hover:text-[#94a3b8]' },
              { key: 'profit' as PrimaryFilter, label: `Profit (${gainers.length})`, ac: 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/40', in: 'text-[#475569] border-[#1e293b] hover:text-[#22c55e]'  },
              { key: 'loss'   as PrimaryFilter, label: `Loss (${losers.length})`,    ac: 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/40', in: 'text-[#475569] border-[#1e293b] hover:text-[#ef4444]'   },
            ]).map(({ key, label, ac, in: inactive }) => (
              <button key={key} onClick={() => pickPrimary(key)}
                className={`flex-1 text-[8px] font-bold py-0.5 rounded border transition-colors ${primary === key ? ac : inactive}`}>
                {label}
              </button>
            ))}
          </div>
          {primary !== 'all' && (
            <div className="flex gap-1">
              {[{ key: 'any' as BucketFilter, label: 'Any' }, ...BUCKETS].map(b => {
                const count = b.key === 'any' ? filtered.length : holdings.filter(r => {
                  const p = primary === 'profit' ? r.pct : -r.pct
                  if (p <= 0) return false
                  const bx = BUCKETS.find(x => x.key === b.key)!
                  return p >= bx.min && p < bx.max
                }).length
                const isAct = bucket === b.key
                const ac = primary === 'profit' ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-[#ef4444]/10 text-[#ef4444]'
                return (
                  <button key={b.key} onClick={() => setBucket(b.key)}
                    className={`flex-1 text-[8px] font-semibold py-0.5 rounded transition-colors ${isAct ? ac : 'text-[#64748b] hover:text-[#64748b]'}`}>
                    {b.label} <span className="opacity-60">({count})</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={18} className="animate-spin text-[#38bdf8]" />
        </div>
      )}

      {/* Error / empty states */}
      {!isLoading && isError && (
        <div className="py-10 text-center text-[10px] text-[#475569] px-4">
          <p className="text-[#ef4444] font-semibold mb-1">Could not load holdings</p>
          <p className="text-[#64748b]">Check that your API key and access token are set in Settings, then try again.</p>
        </div>
      )}

      {/* Table with horizontal scroll + sticky first column */}
      {!isLoading && !isError && (
        <div className="flex-1 overflow-auto">
          {sorted.length === 0 && holdings.length === 0 ? (
            <div className="py-10 text-center text-[#64748b] text-[10px]">No equity holdings found</div>
          ) : sorted.length === 0 ? (
            <div className="py-10 text-center text-[#64748b] text-[10px]">No holdings in this range</div>
          ) : (
            <table className="w-full text-[10px] border-collapse" style={{ minWidth: 700 }}>
              <thead className="sticky top-0 z-10 bg-[#060d1a]">
                <tr className="border-b border-[#1e293b]">
                  {/* sticky first col */}
                  <th className="sticky left-0 z-20 bg-[#060d1a] px-3 py-2 text-left text-[8px] font-bold uppercase tracking-widest text-[#475569] whitespace-nowrap border-r border-[#1e293b]">
                    Stock
                  </th>
                  <ColHeader label="CMP"          sortKey="price"  current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <th className="px-2 py-2 text-left text-[8px] font-bold uppercase tracking-widest text-[#475569] whitespace-nowrap">Avg. Buy</th>
                  <th className="px-2 py-2 text-left text-[8px] font-bold uppercase tracking-widest text-[#475569] whitespace-nowrap">Qty</th>
                  <ColHeader label="P&L Â· Range"  sortKey="pnl"    current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <ColHeader label="Achieved R:R" sortKey="rr"     current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <ColHeader label="Day P&L"      sortKey="day"    current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <th className="px-2 py-2 text-left text-[8px] font-bold uppercase tracking-widest text-[#475569] whitespace-nowrap">Status</th>
                  <ColHeader label="Age"          sortKey="age"    current={sortKey} dir={sortDir} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {sorted.map(r => {
                  const dUp  = r.dayPnLAmount >= 0
                  return (
                    <tr key={r.h.tradingsymbol} className="border-b border-[#0f1f35] hover:bg-[#0a1628] transition-colors">
                      {/* sticky symbol */}
                      <td className="sticky left-0 z-10 bg-[#060d1a] px-3 py-2 border-r border-[#1e293b] whitespace-nowrap">
                        <div className="font-semibold text-white text-[10px]">{r.h.tradingsymbol}</div>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div className="text-white font-semibold">{r.h.last_price.toLocaleString('en-IN')}</div>
                      </td>
                      <td className="px-2 py-2 text-[#94a3b8] whitespace-nowrap">{r.h.average_price.toLocaleString('en-IN')}</td>
                      <td className="px-2 py-2 text-[#94a3b8] whitespace-nowrap">{r.h.quantity}</td>
                      {/* P&L Â· center-anchored dual bar (loss=redâ†, profit=â†’green) */}
                      <td className="px-2 py-2 whitespace-nowrap" style={{ minWidth: 210 }}>
                        <div className="flex items-center gap-1">
                          <span className="text-[7px] text-[#ef4444] shrink-0">-{((r.h.average_price - r.slPrice) * r.h.quantity).toFixed(0)}</span>
                          {/* Full bar: left half = SL zone (red tint bg), right half = target zone (green tint bg) */}
                          <div className="relative flex-1 flex h-3 rounded overflow-hidden">
                            {/* Left half: dark red bg; bright red fill grows rightâ†’left from center for loss */}
                            <div className="relative flex-1 bg-[#1c0808] overflow-hidden">
                              {r.totalPnL < 0 && (
                                <div
                                  className="absolute right-0 top-0 h-full bg-[#ef4444]"
                                  style={{ width: `${Math.min(100, ((r.h.average_price - r.h.last_price) / (r.h.average_price - r.slPrice)) * 100)}%` }}
                                />
                              )}
                            </div>
                            {/* Right half: dark green bg; bright green fill grows leftâ†’right from center for profit */}
                            <div className="relative flex-1 bg-[#081c08] overflow-hidden">
                              {r.totalPnL >= 0 && (
                                <div
                                  className="absolute left-0 top-0 h-full bg-[#22c55e]"
                                  style={{ width: `${Math.min(100, ((r.h.last_price - r.h.average_price) / (r.tgtPrice - r.h.average_price)) * 100)}%` }}
                                />
                              )}
                            </div>
                            {/* P&L amount centered over full bar */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span
                                className={`text-[9px] font-bold leading-none ${r.totalPnL >= 0 ? 'text-white' : 'text-white'}`}
                                style={{ textShadow: '0 0 5px rgba(0,0,0,1), 0 0 5px rgba(0,0,0,1)' }}
                              >
                                {r.totalPnL >= 0 ? '+' : '-'}{Math.abs(r.totalPnL).toFixed(0)}
                              </span>
                            </div>
                          </div>
                          <span className="text-[7px] text-[#22c55e] shrink-0">+{((r.tgtPrice - r.h.average_price) * r.h.quantity).toFixed(0)}</span>
                        </div>
                      </td>
                      <td className={`px-2 py-2 font-bold whitespace-nowrap ${rrColor(r)}`}>
                        {r.achievedRR.toFixed(1)}R
                      </td>
                      <td className={`px-2 py-2 whitespace-nowrap font-semibold ${dUp ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                        {dUp ? '+' : ''}{Math.abs(r.dayPnLAmount).toFixed(0)}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <StatusBadge r={r} />
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        {(() => {
                          const d = daysHeld(r.h.tradingsymbol, buyDates)
                          if (d !== null) {
                            return <span className={`font-semibold ${agingColor(d)}`}>{d}d</span>
                          }
                          return (
                            <button
                              title="Set buy date"
                              onClick={() => {
                                const input = document.createElement('input')
                                input.type = 'date'
                                input.max = new Date().toISOString().split('T')[0]
                                input.onchange = () => {
                                  if (!input.value) return
                                  const next = { ...buyDates, [r.h.tradingsymbol]: input.value }
                                  setBuyDates(next)
                                  saveBuyDates(next)
                                }
                                input.click()
                              }}
                              className="text-[#64748b] hover:text-[#38bdf8] transition-colors"
                            >
                              <CalendarDays size={9} />
                            </button>
                          )
                        })()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

    </div>
  )
}
