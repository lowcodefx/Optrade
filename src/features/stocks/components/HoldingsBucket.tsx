import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { kiteAuthHeaders, API_BASE } from '@/core/services/apiClient'
import { RefreshCw, FlaskConical, ChevronDown, ChevronUp, ChevronsUpDown, CalendarDays } from 'lucide-react'

// ── Aging helpers ─────────────────────────────────────────────────────────────

const BUY_DATES_KEY = 'sw_buy_dates'

function loadBuyDates(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(BUY_DATES_KEY) ?? '{}') } catch { return {} }
}
function saveBuyDates(d: Record<string, string>) {
  localStorage.setItem(BUY_DATES_KEY, JSON.stringify(d))
}

// Mock buy dates (days ago from today)
const MOCK_AGES: Record<string, number> = {
  BHARTIARTL: 31, INFY: 8, COFORGE: 3, HDFCBANK: 22, TCS: 5,
  MPHASIS: 18, WIPRO: 4, RELIANCE: 12,
}

function daysHeld(symbol: string, isMock: boolean, buyDates: Record<string, string>): number | null {
  if (isMock) return MOCK_AGES[symbol] ?? null
  const d = buyDates[symbol]
  if (!d) return null
  const diff = Date.now() - new Date(d).getTime()
  return Math.max(0, Math.floor(diff / 86400000))
}

function agingColor(days: number | null): string {
  if (days === null) return 'text-[#334155]'
  if (days <= 5)  return 'text-[#38bdf8]'   // fresh — blue
  if (days <= 14) return 'text-[#22c55e]'   // sweet spot — green
  if (days <= 21) return 'text-[#f59e0b]'   // getting long — amber
  return 'text-[#ef4444]'                    // overdue — red (>21d swing)
}

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_HOLDINGS: KiteHolding[] = [
  // TARGET HIT — large cap, 15% up vs 12% target
  { tradingsymbol: 'BHARTIARTL', exchange: 'NSE', quantity: 15, average_price: 920,  last_price: 1058, pnl: 2070, day_change: 15,  day_change_percentage:  1.44, close_price: 1043 },
  // HOLD — large cap, 0.3% up, excellent remaining R:R (lots of runway)
  { tradingsymbol: 'INFY',       exchange: 'NSE', quantity: 10, average_price: 1540, last_price: 1545, pnl:   50, day_change: -8,  day_change_percentage: -0.52, close_price: 1553 },
  // HOLD — mid cap, just entered, large upside remaining
  { tradingsymbol: 'COFORGE',    exchange: 'NSE', quantity:  2, average_price: 1800, last_price: 1808, pnl:   16, day_change: 22,  day_change_percentage:  1.23, close_price: 1786 },
  // CAUTION — large cap, 1.2% up, R:R narrowing
  { tradingsymbol: 'HDFCBANK',   exchange: 'NSE', quantity:  8, average_price: 1680, last_price: 1700, pnl:  160, day_change:  5,  day_change_percentage:  0.29, close_price: 1695 },
  // EXIT? — large cap, 4.7% up but remaining R:R is poor (SL stays at entry)
  { tradingsymbol: 'TCS',        exchange: 'NSE', quantity:  3, average_price: 3650, last_price: 3820, pnl:  510, day_change: 35,  day_change_percentage:  0.92, close_price: 3785 },
  // EXIT? — mid cap, 13% up, nearly at 16% target
  { tradingsymbol: 'MPHASIS',    exchange: 'NSE', quantity:  4, average_price: 2100, last_price: 2373, pnl: 1092, day_change: -25, day_change_percentage: -1.04, close_price: 2398 },
  // SL HIT — large cap, fell below 5% SL level
  { tradingsymbol: 'WIPRO',      exchange: 'NSE', quantity: 20, average_price:  480, last_price:  448, pnl: -640, day_change: -12, day_change_percentage: -2.61, close_price:  460 },
  // Loss but above SL — large cap, 2.5% loss, still valid, high remaining upside
  { tradingsymbol: 'RELIANCE',   exchange: 'NSE', quantity:  5, average_price: 2820, last_price: 2750, pnl: -350, day_change: -30, day_change_percentage: -1.08, close_price: 2780 },
]

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchHoldings(): Promise<KiteHolding[]> {
  const res = await fetch(`${API_BASE}/api/kite?kite_path=portfolio/holdings`, { headers: kiteAuthHeaders() })
  if (!res.ok) throw new Error(`${res.status}`)
  const json = await res.json()
  return (json.data ?? []) as KiteHolding[]
}

// ── Cap profile ───────────────────────────────────────────────────────────────

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

// ── Computed row ──────────────────────────────────────────────────────────────

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

// ── Filter types ──────────────────────────────────────────────────────────────

type PrimaryFilter = 'all' | 'profit' | 'loss'
type BucketFilter  = 'any' | 'small' | 'mid' | 'big'
type SortKey = 'symbol' | 'price' | 'pnl' | 'rr' | 'day' | 'age'
type SortDir = 'asc' | 'desc'

const BUCKETS = [
  { key: 'small' as BucketFilter, label: '0–2%',  min: 0, max: 2  },
  { key: 'mid'   as BucketFilter, label: '2–5%',  min: 2, max: 5  },
  { key: 'big'   as BucketFilter, label: '>5%',   min: 5, max: Infinity },
]

// ── Column header ─────────────────────────────────────────────────────────────

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

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ r }: { r: ComputedRow }) {
  if (r.targetHit) return <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30 whitespace-nowrap">TARGET</span>
  if (r.slHit)     return <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30 whitespace-nowrap">SL HIT</span>
  if (r.rrAlert)   return <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 whitespace-nowrap">2.5R ✓</span>
  if (r.remainingRR >= 2) return <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 whitespace-nowrap">HOLD</span>
  if (r.remainingRR >= 1) return <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 whitespace-nowrap">CAUTION</span>
  return <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20 whitespace-nowrap">EXIT?</span>
}

// ── RR color ──────────────────────────────────────────────────────────────────

function rrColor(r: ComputedRow) {
  if (r.slHit || r.achievedRR < 0) return 'text-[#ef4444]'
  if (r.targetHit || r.achievedRR >= 2.5) return 'text-[#22c55e]'
  if (r.achievedRR >= 1.0) return 'text-[#22c55e] opacity-80'
  return 'text-[#f59e0b]'
}

// ── Main component ────────────────────────────────────────────────────────────

export function HoldingsBucket() {
  const [primary, setPrimary] = useState<PrimaryFilter>('all')
  const [bucket,  setBucket]  = useState<BucketFilter>('any')
  const [sortKey, setSortKey] = useState<SortKey>('pnl')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [buyDates, setBuyDates] = useState<Record<string, string>>(loadBuyDates)

  const { data: rawHoldings, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['stockHoldings'],
    queryFn: fetchHoldings,
    refetchInterval: 60000,
    retry: false,
  })

  const isMock   = !isLoading && (!rawHoldings || rawHoldings.length === 0)
  const holdings = (isMock ? MOCK_HOLDINGS : (rawHoldings ?? [])).map(compute)

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
    else if (sortKey === 'age')  { av = daysHeld(a.h.tradingsymbol, isMock, buyDates) ?? -1; bv = daysHeld(b.h.tradingsymbol, isMock, buyDates) ?? -1 }
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
            {isMock && (
              <span className="flex items-center gap-0.5 bg-[#f59e0b]/10 text-[#f59e0b] text-[7px] font-bold px-1.5 py-0.5 rounded border border-[#f59e0b]/20">
                <FlaskConical size={7} /> Demo
              </span>
            )}
          </div>
          <p className="text-[#334155] text-[8px]">{isMock ? 'Connect Zerodha to see your portfolio' : 'Refreshes every 60s'}</p>
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
                    className={`flex-1 text-[8px] font-semibold py-0.5 rounded transition-colors ${isAct ? ac : 'text-[#334155] hover:text-[#64748b]'}`}>
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

      {/* Table with horizontal scroll + sticky first column */}
      {!isLoading && (
        <div className="flex-1 overflow-auto">
          {sorted.length === 0 ? (
            <div className="py-10 text-center text-[#334155] text-[10px]">No holdings in this range</div>
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
                  <ColHeader label="P&L · Range"  sortKey="pnl"    current={sortKey} dir={sortDir} onSort={toggleSort} />
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
                        <div className="text-[7px] text-[#334155]">{r.cap} · {r.h.quantity} qty</div>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div className="text-white font-semibold">{r.h.last_price.toLocaleString('en-IN')}</div>
                      </td>
                      <td className="px-2 py-2 text-[#94a3b8] whitespace-nowrap">{r.h.average_price.toLocaleString('en-IN')}</td>
                      <td className="px-2 py-2 text-[#94a3b8] whitespace-nowrap">{r.h.quantity}</td>
                      {/* P&L · left-red / right-green dual bar · Target */}
                      <td className="px-2 py-2 whitespace-nowrap" style={{ minWidth: 200 }}>
                        <div className="flex items-center gap-1">
                          {/* SL label */}
                          <span className="text-[7px] text-[#ef4444] shrink-0">{r.slPrice.toFixed(0)}</span>
                          {/* Proportional dual bar with P&L overlaid center */}
                          <div className="relative flex-1 flex h-3 rounded overflow-hidden bg-[#0f172a]">
                            {/* Red bar: progressPct% of total width */}
                            <div className="h-full bg-[#ef4444]" style={{ width: `${r.progressPct}%` }} />
                            {/* Green bar: remaining width */}
                            <div className="h-full bg-[#22c55e] flex-1" />
                            {/* P&L centered absolutely over both bars */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span
                                className="text-[9px] font-bold leading-none text-white"
                                style={{ textShadow: '0 0 4px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.95)' }}
                              >
                                {r.totalPnL >= 0 ? '+' : '-'}{Math.abs(r.totalPnL).toFixed(0)}
                              </span>
                            </div>
                          </div>
                          {/* Target label */}
                          <span className="text-[7px] text-[#22c55e] shrink-0">{r.tgtPrice.toFixed(0)}</span>
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
                          const d = daysHeld(r.h.tradingsymbol, isMock, buyDates)
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
                              className="text-[#334155] hover:text-[#38bdf8] transition-colors"
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
