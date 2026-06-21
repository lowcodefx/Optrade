import { useMemo } from 'react'
import { useJournalStore } from '@/core/store/journalStore'
import { useMarketStore } from '@/core/store'
import { useLiveModeStore } from '@/core/services/tradingService'
import { usePositions } from '@/core/hooks/useMarketData'
import type { TradeEntry } from '@/core/types/discipline'

function formatCur(n: number) {
  return (n >= 0 ? '+' : '') + '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-[#0a1628] border border-[#1e293b] rounded p-3">
      <div className="text-[9px] text-[#64748b] uppercase tracking-widest mb-1">{label}</div>
      <div className={`text-base font-bold ${color ?? 'text-white'}`}>{value}</div>
      {sub && <div className="text-[9px] text-[#475569] mt-0.5">{sub}</div>}
    </div>
  )
}

function DailyPnLChart({ entries }: { entries: TradeEntry[] }) {
  const days = useMemo(() => {
    const map = new Map<string, number>()
    entries.forEach(e => map.set(e.date, (map.get(e.date) ?? 0) + e.pnl))
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14) // last 14 trading days
  }, [entries])

  if (days.length === 0) return <div className="text-[#475569] text-xs text-center py-6">No trade data yet</div>

  const max = Math.max(...days.map(([, v]) => Math.abs(v)), 1)
  const BAR_H = 80

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1 min-w-0" style={{ height: BAR_H + 28 }}>
        {days.map(([date, pnl]) => {
          const h = Math.max(3, Math.round((Math.abs(pnl) / max) * BAR_H))
          const isPos = pnl >= 0
          const label = date.slice(5) // MM-DD
          return (
            <div key={date} className="flex flex-col items-center gap-0.5 flex-1 min-w-[28px]">
              <div className="text-[8px] text-[#64748b] font-semibold leading-none">
                {pnl >= 0 ? '+' : ''}{Math.round(pnl / 1000)}k
              </div>
              <div
                className={`w-full rounded-t ${isPos ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`}
                style={{ height: h }}
                title={`${date}: ₹${pnl.toFixed(0)}`}
              />
              <div className="text-[8px] text-[#475569] leading-none">{label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WinRateRing({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses
  const rate = total > 0 ? (wins / total) * 100 : 0
  const r = 28
  const circ = 2 * Math.PI * r
  const dash = (rate / 100) * circ

  return (
    <div className="flex items-center gap-3">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle
          cx="36" cy="36" r={r} fill="none"
          stroke={rate >= 50 ? '#22c55e' : '#ef4444'}
          strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
        />
        <text x="36" y="40" textAnchor="middle" className="font-bold" fill="white" fontSize="13">
          {rate.toFixed(0)}%
        </text>
      </svg>
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
          <span className="text-[#64748b]">Wins</span>
          <span className="text-white font-bold">{wins}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
          <span className="text-[#64748b]">Losses</span>
          <span className="text-white font-bold">{losses}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="w-2 h-2 rounded-full bg-[#475569]" />
          <span className="text-[#64748b]">Total</span>
          <span className="text-white font-bold">{total}</span>
        </div>
      </div>
    </div>
  )
}

function SideBreakdown({ entries }: { entries: TradeEntry[] }) {
  const ce = entries.filter(e => e.optionType === 'CE')
  const pe = entries.filter(e => e.optionType === 'PE')
  const ceWins = ce.filter(e => e.result === 'WIN').length
  const peWins = pe.filter(e => e.result === 'WIN').length
  const cePnL = ce.reduce((s, e) => s + e.pnl, 0)
  const pePnL = pe.reduce((s, e) => s + e.pnl, 0)

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="bg-[#0a1628] border border-[#22c55e]/30 rounded p-2">
        <div className="text-[#22c55e] text-[9px] font-bold uppercase mb-1">CE (Bullish)</div>
        <div className={`text-sm font-bold ${cePnL >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{formatCur(cePnL)}</div>
        <div className="text-[9px] text-[#64748b]">{ce.length} trades · {ce.length > 0 ? Math.round(ceWins / ce.length * 100) : 0}% win</div>
      </div>
      <div className="bg-[#0a1628] border border-[#ef4444]/30 rounded p-2">
        <div className="text-[#ef4444] text-[9px] font-bold uppercase mb-1">PE (Bearish)</div>
        <div className={`text-sm font-bold ${pePnL >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{formatCur(pePnL)}</div>
        <div className="text-[9px] text-[#64748b]">{pe.length} trades · {pe.length > 0 ? Math.round(peWins / pe.length * 100) : 0}% win</div>
      </div>
    </div>
  )
}

const HOUR_LABELS = ['9-10', '10-11', '11-12', '12-1', '1-2', '2-3']
const HOUR_KEYS = [9, 10, 11, 12, 13, 14]

function TimeOfDayChart({ entries }: { entries: TradeEntry[] }) {
  const hourData = useMemo(() => {
    return HOUR_KEYS.map(h => {
      const hourEntries = entries.filter(e => {
        const hr = parseInt(e.time?.split(':')[0] ?? '0', 10)
        return hr === h
      })
      const wins = hourEntries.filter(e => e.result === 'WIN').length
      const total = hourEntries.length
      const winRate = total > 0 ? Math.round((wins / total) * 100) : null
      const pnl = hourEntries.reduce((s, e) => s + e.pnl, 0)
      return { label: HOUR_LABELS[HOUR_KEYS.indexOf(h)], wins, total, winRate, pnl }
    })
  }, [entries])

  const hasData = hourData.some(h => h.total > 0)
  if (!hasData) return null

  return (
    <div className="bg-[#0a1628] border border-[#1e293b] rounded p-3">
      <div className="text-[9px] text-[#64748b] uppercase tracking-widest mb-3">Win Rate by Hour</div>
      <div className="flex gap-1.5 items-end" style={{ height: 72 }}>
        {hourData.map(({ label, winRate, total, pnl }) => {
          const barH = winRate !== null ? Math.round((winRate / 100) * 60) : 0
          const isGood = winRate !== null && winRate >= 50
          return (
            <div key={label} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
              {winRate !== null && (
                <div className="text-[7px] text-center leading-none font-semibold" style={{ color: isGood ? '#22c55e' : '#ef4444' }}>
                  {winRate}%
                </div>
              )}
              <div className="w-full flex justify-center">
                {winRate !== null ? (
                  <div
                    className={`w-full rounded-t ${pnl >= 0 ? 'bg-[#22c55e]/70' : 'bg-[#ef4444]/70'}`}
                    style={{ height: Math.max(barH, 2) }}
                    title={`${label}: ${winRate}% win rate (${total} trades)`}
                  />
                ) : (
                  <div className="w-full rounded bg-[#1e293b]" style={{ height: 2 }} />
                )}
              </div>
              <div className="text-[7px] text-[#475569] text-center leading-none">{label}</div>
              {total > 0 && <div className="text-[7px] text-[#334155] text-center leading-none">{total}t</div>}
            </div>
          )
        })}
      </div>
      <div className="text-[8px] text-[#334155] mt-1 text-center">Best hours = green bars above 50%</div>
    </div>
  )
}

function TradeRow({ e }: { e: TradeEntry }) {
  const pnlColor = e.pnl > 0 ? 'text-[#22c55e]' : e.pnl < 0 ? 'text-[#ef4444]' : 'text-[#f59e0b]'
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#1e293b]/60 hover:bg-[#0f1f35]/50 transition-colors text-[10px]">
      <span className="text-[#475569] w-10 shrink-0">{e.date.slice(5)}</span>
      <span className={`font-bold shrink-0 w-8 ${e.optionType === 'CE' ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{e.optionType}</span>
      <span className="text-white shrink-0">{e.strike}</span>
      <span className="text-[#64748b] shrink-0">₹{e.entryPrice}→₹{e.exitPrice}</span>
      <span className={`ml-auto font-bold ${pnlColor}`}>{formatCur(e.pnl)}</span>
      <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded font-bold ${
        e.result === 'WIN' ? 'bg-[#0d2b0d] text-[#22c55e]' :
        e.result === 'LOSS' ? 'bg-[#2b0d0d] text-[#ef4444]' :
        'bg-[#1e293b] text-[#f59e0b]'
      }`}>{e.result}</span>
    </div>
  )
}

export function AnalyticsDashboard() {
  const entries = useJournalStore(s => s.entries)
  const allEntries = entries
  const availableMargin = useMarketStore(s => s.availableMargin)
  const usedMargin = useMarketStore(s => s.usedMargin)
  const isLive = useLiveModeStore(s => s.isLive)
  const { data: positions = [] } = usePositions()
  const openPnL = positions.reduce((s, p) => s + p.pnl, 0)
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayEntries = allEntries.filter(e => e.date === todayStr)
  const todayPnL = todayEntries.reduce((s, e) => s + e.pnl, 0)

  const stats = useMemo(() => {
    if (allEntries.length === 0) return null
    const wins = allEntries.filter(e => e.result === 'WIN').length
    const losses = allEntries.filter(e => e.result === 'LOSS').length
    const netPnL = allEntries.reduce((s, e) => s + e.pnl, 0)
    const winPnL = allEntries.filter(e => e.pnl > 0).reduce((s, e) => s + e.pnl, 0)
    const lossPnL = allEntries.filter(e => e.pnl < 0).reduce((s, e) => s + e.pnl, 0)
    const best = allEntries.reduce((a, b) => a.pnl > b.pnl ? a : b)
    const worst = allEntries.reduce((a, b) => a.pnl < b.pnl ? a : b)
    const avgRR = allEntries.reduce((s, e) => {
      const sl = Math.abs(e.entryPrice - e.sl)
      const tgt = Math.abs(e.target - e.entryPrice)
      return s + (sl > 0 ? tgt / sl : 0)
    }, 0) / allEntries.length
    const avgWin = wins > 0 ? winPnL / wins : 0
    const avgLoss = losses > 0 ? lossPnL / losses : 0
    // Streak
    let streak = 0, maxStreak = 0, cur = 0
    for (const e of [...allEntries].reverse()) {
      if (e.result === 'WIN') { cur++; maxStreak = Math.max(maxStreak, cur) }
      else { cur = 0 }
    }
    // current streak
    for (const e of allEntries) {
      if (e.result === 'WIN') streak++; else break
    }
    return { wins, losses, netPnL, best, worst, avgRR, avgWin, avgLoss, maxStreak, streak }
  }, [allEntries])

  if (allEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <div className="text-4xl mb-3">📊</div>
        <div className="text-white font-semibold mb-1">No trades yet</div>
        <div className="text-[#64748b] text-xs">Add trades via the Journal tab to see your analytics.</div>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-4">

      {/* Account snapshot */}
      {isLive && availableMargin > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#0a1628] border border-[#22c55e]/30 rounded p-3 text-center">
            <div className="text-[9px] text-[#64748b] uppercase mb-1">Available</div>
            <div className="text-[#22c55e] font-bold text-base">
              ₹{availableMargin >= 100000
                ? `${(availableMargin / 100000).toFixed(2)}L`
                : `${(availableMargin / 1000).toFixed(1)}K`}
            </div>
          </div>
          <div className="bg-[#0a1628] border border-[#f59e0b]/30 rounded p-3 text-center">
            <div className="text-[9px] text-[#64748b] uppercase mb-1">Used Margin</div>
            <div className="text-[#f59e0b] font-bold text-base">
              ₹{usedMargin >= 100000
                ? `${(usedMargin / 100000).toFixed(2)}L`
                : `${(usedMargin / 1000).toFixed(1)}K`}
            </div>
          </div>
          <div className={`bg-[#0a1628] border rounded p-3 text-center ${openPnL >= 0 ? 'border-[#22c55e]/30' : 'border-[#ef4444]/30'}`}>
            <div className="text-[9px] text-[#64748b] uppercase mb-1">Open P&L</div>
            <div className={`font-bold text-base ${openPnL >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {openPnL >= 0 ? '+' : ''}₹{Math.abs(openPnL).toFixed(0)}
            </div>
          </div>
        </div>
      )}

      {/* Today snapshot */}
      <div className={`bg-[#0a1628] border rounded p-3 flex items-center justify-between ${todayPnL >= 0 ? 'border-[#22c55e]/30' : 'border-[#ef4444]/30'}`}>
        <div>
          <div className="text-[9px] text-[#64748b] uppercase mb-0.5">Today's Realised P&L</div>
          <div className={`text-xl font-bold ${todayPnL >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {todayPnL >= 0 ? '+' : ''}₹{Math.abs(todayPnL).toLocaleString('en-IN')}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] text-[#64748b] mb-0.5">{todayEntries.length} trades today</div>
          <div className="text-[9px] text-[#64748b]">
            {todayEntries.filter(e => e.result === 'WIN').length}W · {todayEntries.filter(e => e.result === 'LOSS').length}L
          </div>
        </div>
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard
          label="Net P&L (All)"
          value={formatCur(stats!.netPnL)}
          sub={`${allEntries.length} trades`}
          color={stats!.netPnL >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}
        />
        <StatCard
          label="Avg Win"
          value={`₹${Math.round(stats!.avgWin)}`}
          sub={`${stats!.wins} wins`}
          color="text-[#22c55e]"
        />
        <StatCard
          label="Avg Loss"
          value={`₹${Math.round(Math.abs(stats!.avgLoss))}`}
          sub={`${stats!.losses} losses`}
          color="text-[#ef4444]"
        />
        <StatCard
          label="Avg R:R"
          value={stats!.avgRR.toFixed(2)}
          sub={`Max streak ${stats!.maxStreak}W`}
          color="text-[#f59e0b]"
        />
      </div>

      {/* Win rate + streak */}
      <div className="bg-[#0a1628] border border-[#1e293b] rounded p-3 flex items-center justify-between gap-4">
        <WinRateRing wins={stats!.wins} losses={stats!.losses} />
        <div className="space-y-1 text-right">
          <div className="text-[9px] text-[#64748b] uppercase">Best Trade</div>
          <div className="text-[#22c55e] font-bold text-sm">₹{stats!.best.pnl.toFixed(0)}</div>
          <div className="text-[9px] text-[#475569]">{stats!.best.strike} {stats!.best.optionType} · {stats!.best.date}</div>
          <div className="h-px bg-[#1e293b] my-1" />
          <div className="text-[9px] text-[#64748b] uppercase">Worst Trade</div>
          <div className="text-[#ef4444] font-bold text-sm">₹{stats!.worst.pnl.toFixed(0)}</div>
          <div className="text-[9px] text-[#475569]">{stats!.worst.strike} {stats!.worst.optionType} · {stats!.worst.date}</div>
        </div>
      </div>

      {/* CE vs PE */}
      <SideBreakdown entries={allEntries} />

      {/* Daily P&L chart */}
      <div className="bg-[#0a1628] border border-[#1e293b] rounded p-3">
        <div className="text-[9px] text-[#64748b] uppercase tracking-widest mb-2">Daily P&L (last 14 days)</div>
        <DailyPnLChart entries={allEntries} />
      </div>

      {/* Time-of-day breakdown */}
      <TimeOfDayChart entries={allEntries} />

      {/* Recent trades */}
      <div className="bg-[#0a1628] border border-[#1e293b] rounded overflow-hidden">
        <div className="text-[9px] text-[#64748b] uppercase tracking-widest px-3 py-2 border-b border-[#1e293b]">
          All Trades ({allEntries.length})
        </div>
        <div className="max-h-64 overflow-y-auto">
          {allEntries.map(e => <TradeRow key={e.id} e={e} />)}
        </div>
      </div>

    </div>
  )
}
