import { useState } from 'react'
import { useSettingsStore } from '@/core/store'
import { useLiveModeStore } from '@/core/services/tradingService'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell, CartesianGrid,
} from 'recharts'
import { Play, AlertCircle } from 'lucide-react'

const LOT_SIZE   = 65
const DELTA      = 0.5
const PL_FACTOR  = LOT_SIZE * DELTA  // ₹37.5 per NIFTY point per lot
const INITIAL_CAPITAL = 30_000

// ── types ─────────────────────────────────────────────────────────────────────
interface Candle { date: string; open: number; high: number; low: number; close: number }

interface DayResult {
  date: string; label: string
  pp: number; r1: number; r2: number; s1: number; s2: number
  open: number; high: number; low: number; close: number
  signal: 'CE' | 'PE' | 'NONE'
  outcome: 'WIN' | 'LOSS' | 'NO_TRADE'
  pnl: number; entry: number; target: number; sl: number
  capital: number
}

// ── data fetch ────────────────────────────────────────────────────────────────
async function fetchDailyCandles(from: string, to: string, apiKey: string, accessToken: string): Promise<Candle[]> {
  const qs = `kite_path=instruments/historical/256265/day&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&continuous=0&oi=0`
  const res = await fetch(`/api/kite?${qs}`, {
    headers: { 'X-Kite-Auth': `token ${apiKey}:${accessToken}`, 'X-Kite-Version': '3' },
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  const json = await res.json()
  const raw: Array<[string, number, number, number, number]> = json.data?.candles ?? []
  return raw.map(([ts, o, h, l, c]) => ({ date: ts.slice(0, 10), open: o, high: h, low: l, close: c }))
}

// ── strategy ──────────────────────────────────────────────────────────────────
function calcPivots(h: number, l: number, c: number) {
  const pp = (h + l + c) / 3
  return { pp, r1: 2 * pp - l, r2: pp + (h - l), s1: 2 * pp - h, s2: pp - (h - l) }
}

function dayLabel(date: string) {
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function simulateDay(day: Candle, prev: Candle, capital: number): DayResult {
  const { pp, r1, r2, s1, s2 } = calcPivots(prev.high, prev.low, prev.close)
  const { date, open, high, low, close } = day
  const base = { date, label: dayLabel(date), pp, r1, r2, s1, s2, open, high, low, close }

  // CE: opens above PP and reaches R1
  if (open > pp && high >= r1) {
    const [entry, target, sl] = [r1, r2, pp]
    let pnl: number, outcome: 'WIN' | 'LOSS'
    if (high >= target) { pnl = (target - entry) * PL_FACTOR; outcome = 'WIN' }
    else if (low <= sl)  { pnl = -(entry - sl) * PL_FACTOR;   outcome = 'LOSS' }
    else                 { pnl = (close - entry) * PL_FACTOR;  outcome = pnl >= 0 ? 'WIN' : 'LOSS' }
    return { ...base, signal: 'CE', outcome, pnl: Math.round(pnl), entry, target, sl, capital: capital + Math.round(pnl) }
  }

  // PE: opens below PP and reaches S1
  if (open < pp && low <= s1) {
    const [entry, target, sl] = [s1, s2, pp]
    let pnl: number, outcome: 'WIN' | 'LOSS'
    if (low <= target)  { pnl = (entry - target) * PL_FACTOR;  outcome = 'WIN' }
    else if (high >= sl) { pnl = -(sl - entry) * PL_FACTOR;    outcome = 'LOSS' }
    else                 { pnl = (entry - close) * PL_FACTOR;   outcome = pnl >= 0 ? 'WIN' : 'LOSS' }
    return { ...base, signal: 'PE', outcome, pnl: Math.round(pnl), entry, target, sl, capital: capital + Math.round(pnl) }
  }

  return { ...base, signal: 'NONE', outcome: 'NO_TRADE', pnl: 0, entry: 0, target: 0, sl: 0, capital }
}

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt  = (n: number) => n.toLocaleString('en-IN')
const sign = (n: number) => (n >= 0 ? '+' : '') + fmt(n)

// ── component ─────────────────────────────────────────────────────────────────
export function MayBacktest() {
  const { apiKey, accessToken } = useSettingsStore()
  const isLive = useLiveModeStore(s => s.isLive)
  const [results, setResults] = useState<DayResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [ran, setRan]       = useState(false)

  async function run() {
    setLoading(true); setError('')
    try {
      const candles = await fetchDailyCandles('2026-04-25 00:00:00', '2026-05-31 23:59:59', apiKey, accessToken)
      const mayIdx  = candles.findIndex(c => c.date.startsWith('2026-05'))
      if (mayIdx <= 0) throw new Error('No May 2026 data returned — ensure your account has historical data access')

      const mayCandles = candles.slice(mayIdx)
      let cap = INITIAL_CAPITAL
      const days = mayCandles.map((day, i) => {
        const prev   = candles[mayIdx + i - 1]
        const result = simulateDay(day, prev, cap)
        cap = result.capital
        return result
      })
      setResults(days); setRan(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch data')
    }
    setLoading(false)
  }

  const trades  = results.filter(d => d.signal !== 'NONE')
  const wins    = trades.filter(d => d.outcome === 'WIN')
  const losses  = trades.filter(d => d.outcome === 'LOSS')
  const totalPnl   = trades.reduce((s, d) => s + d.pnl, 0)
  const winRate    = trades.length > 0 ? (wins.length / trades.length) * 100 : 0
  const tradingDays = results.length
  const avgPerDay  = tradingDays > 0 ? (trades.length / tradingDays).toFixed(1) : '—'
  const finalCap   = results.at(-1)?.capital ?? INITIAL_CAPITAL
  const returnPct  = ((finalCap - INITIAL_CAPITAL) / INITIAL_CAPITAL * 100).toFixed(1)
  const bestDay    = trades.length > 0 ? trades.reduce((a, b) => b.pnl > a.pnl ? b : a) : null
  const worstDay   = trades.length > 0 ? trades.reduce((a, b) => b.pnl < a.pnl ? b : a) : null

  if (!isLive) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2">
        <AlertCircle size={22} className="text-[#f59e0b]" />
        <p className="text-[#64748b] text-xs text-center">
          Connect to Zerodha to run the May 2026 backtest
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-3 overflow-y-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[#e2e8f0] text-xs font-semibold">May 2026 Backtest</h3>
          <p className="text-[#475569] text-[9px]">Pivot R1/S1 breakout · 1 lot (75) · Capital ₹{fmt(INITIAL_CAPITAL)} · Delta 0.5</p>
        </div>
        <button
          onClick={run} disabled={loading}
          className="flex items-center gap-1.5 bg-[#38bdf8] text-black text-[10px] font-bold px-3 py-1.5 rounded hover:bg-[#0ea5e9] disabled:opacity-50 transition-colors"
        >
          <Play size={10} />
          {loading ? 'Fetching…' : ran ? 'Re-run' : 'Run Analysis'}
        </button>
      </div>

      {error && <div className="text-red-400 text-[10px] bg-red-900/20 rounded p-2">{error}</div>}

      {ran && results.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-2">
            {/* row 1 */}
            <StatCard label="Trading Days"   value={String(tradingDays)} sub={`${trades.length} trades taken`} />
            <StatCard label="Avg Trades/Day" value={avgPerDay}           sub={`${wins.length}W  ${losses.length}L`} />
            <StatCard label="Win Rate"        value={`${winRate.toFixed(0)}%`} sub={`${wins.length} of ${trades.length}`} />
            <StatCard
              label="Net P&L"
              value={`₹${sign(totalPnl)}`}
              sub={`${returnPct}% return on ₹${fmt(INITIAL_CAPITAL)}`}
              color={totalPnl >= 0 ? '#22c55e' : '#ef4444'}
            />
          </div>

          {/* Capital: start → end */}
          <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded p-3 flex items-center justify-between">
            <div>
              <div className="text-[#64748b] text-[9px]">Starting Capital</div>
              <div className="text-white text-sm font-bold">₹{fmt(INITIAL_CAPITAL)}</div>
            </div>
            <div className="text-[#475569] text-sm">→</div>
            <div className="text-right">
              <div className="text-[#64748b] text-[9px]">End of May</div>
              <div className={`text-sm font-bold ${finalCap >= INITIAL_CAPITAL ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>₹{fmt(finalCap)}</div>
            </div>
            <div className="text-right">
              <div className="text-[#64748b] text-[9px]">Best Day</div>
              <div className="text-[#22c55e] text-xs font-semibold">{bestDay ? `+₹${fmt(bestDay.pnl)} (${bestDay.label})` : '—'}</div>
            </div>
            <div className="text-right">
              <div className="text-[#64748b] text-[9px]">Worst Day</div>
              <div className="text-[#ef4444] text-xs font-semibold">{worstDay ? `₹${fmt(worstDay.pnl)} (${worstDay.label})` : '—'}</div>
            </div>
          </div>

          {/* Daily P&L bar chart */}
          <div>
            <div className="text-[#64748b] text-[9px] mb-1 uppercase tracking-widest">Daily P&L (₹)</div>
            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={trades} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 7, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 7, fill: '#475569' }} width={48}
                  tickFormatter={v => `${v >= 0 ? '+' : ''}${(v / 1000).toFixed(1)}k`} />
                <Tooltip
                  contentStyle={{ background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: 4, fontSize: 10 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: number, _: string, item: any) => [
                    `₹${sign(v as number)}  (${item?.payload?.signal ?? ''})`,
                    item?.payload?.outcome ?? '',
                  ]}
                />
                <ReferenceLine y={0} stroke="#334155" />
                <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                  {trades.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#22c55e' : '#ef4444'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Capital growth line chart */}
          <div>
            <div className="text-[#64748b] text-[9px] mb-1 uppercase tracking-widest">Capital Growth (₹)</div>
            <ResponsiveContainer width="100%" height={90}>
              <LineChart
                data={[{ label: 'Start', capital: INITIAL_CAPITAL }, ...results]}
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" />
                <XAxis dataKey="label" tick={{ fontSize: 7, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 7, fill: '#475569' }} width={52}
                  tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
                  domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: 4, fontSize: 10 }}
                  formatter={(v: number) => [`₹${fmt(v)}`, 'Capital']}
                />
                <ReferenceLine y={INITIAL_CAPITAL} stroke="#475569" strokeDasharray="4 3" />
                <Line type="monotone" dataKey="capital" stroke="#38bdf8" dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Day-by-day table */}
          <div>
            <div className="text-[#64748b] text-[9px] mb-1 uppercase tracking-widest">Day-by-Day</div>
            <div className="rounded border border-[#1e3a5f] overflow-hidden">
              <div className="grid grid-cols-8 text-[8px] text-[#475569] bg-[#060d1a] px-2 py-1.5">
                {['Date', 'PP', 'R1', 'S1', 'Signal', 'Entry→Target', 'Outcome', 'P&L'].map(h => (
                  <span key={h} className={h === 'P&L' ? 'text-right' : ''}>{h}</span>
                ))}
              </div>
              {results.map(d => (
                <div
                  key={d.date}
                  className={`grid grid-cols-8 text-[9px] px-2 py-1 border-t border-[#1e293b] ${
                    d.signal === 'NONE' ? 'opacity-40' : ''
                  }`}
                >
                  <span className="text-[#94a3b8]">{d.label}</span>
                  <span className="text-[#64748b]">{d.pp.toFixed(0)}</span>
                  <span className="text-[#64748b]">{d.r1.toFixed(0)}</span>
                  <span className="text-[#64748b]">{d.s1.toFixed(0)}</span>
                  <span className={d.signal === 'CE' ? 'text-[#22c55e] font-semibold' : d.signal === 'PE' ? 'text-[#ef4444] font-semibold' : 'text-[#334155]'}>
                    {d.signal === 'NONE' ? '—' : d.signal}
                  </span>
                  <span className="text-[#64748b] text-[8px]">
                    {d.entry ? `${d.entry.toFixed(0)}→${d.target.toFixed(0)}` : '—'}
                  </span>
                  <span className={d.outcome === 'WIN' ? 'text-[#22c55e]' : d.outcome === 'LOSS' ? 'text-[#ef4444]' : 'text-[#475569]'}>
                    {d.outcome === 'NO_TRADE' ? '—' : d.outcome}
                  </span>
                  <span className={`text-right font-mono font-semibold ${d.pnl > 0 ? 'text-[#22c55e]' : d.pnl < 0 ? 'text-[#ef4444]' : 'text-[#475569]'}`}>
                    {d.pnl === 0 ? '—' : `₹${sign(d.pnl)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <p className="text-[#334155] text-[8px] leading-relaxed">
            Strategy: Buy CE when day opens above PP and reaches R1 (target R2, SL PP). Buy PE when opens below PP and reaches S1 (target S2, SL PP).
            P&amp;L uses delta ≈ 0.5 on 1 lot (75 qty). Actual options premium varies with IV. This is a simulation — past performance does not guarantee future results.
          </p>
        </>
      )}
    </div>
  )
}

// ── small reusable card ───────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded p-2.5">
      <div className="text-[#64748b] text-[9px]">{label}</div>
      <div className="text-sm font-bold mt-0.5" style={{ color: color ?? '#e2e8f0' }}>{value}</div>
      <div className="text-[#475569] text-[8px]">{sub}</div>
    </div>
  )
}
