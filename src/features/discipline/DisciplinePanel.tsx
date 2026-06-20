import { useDisciplineStore, calcGrade } from '@/core/store'
import { useSettingsStore } from '@/core/store'
import { formatCurrency, cn } from '@/lib/utils'
import { ShieldCheck, ShieldOff, RotateCcw, AlertTriangle } from 'lucide-react'

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="h-1.5 bg-[#0f1f35] rounded-full overflow-hidden flex-1">
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
    </div>
  )
}

function RuleRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={ok ? 'text-[#22c55e]' : 'text-[#ef4444]'}>{ok ? '✓' : '✗'}</span>
      <span className={cn('text-[9px]', ok ? 'text-[#475569]' : 'text-[#ef4444]')}>{label}</span>
    </div>
  )
}

export function DisciplinePanel() {
  const d = useDisciplineStore()
  const settings = useSettingsStore()
  const grade = calcGrade(d.disciplineScore)

  const remainingRisk = Math.max(0, settings.maxDailyLoss + d.dailyPnL)
  const remainingTrades = Math.max(0, settings.maxTradesPerDay - d.tradesToday)
  const dailyLossUsedPct = Math.min(Math.abs(Math.min(0, d.dailyPnL)) / settings.maxDailyLoss, 1)

  const gradeColor = { 'A+': '#22c55e', A: '#22c55e', B: '#38bdf8', C: '#f59e0b', D: '#ef4444' }[grade]

  const rules = [
    { ok: d.dailyPnL > -settings.maxDailyLoss, label: 'Daily loss limit OK' },
    { ok: d.tradesToday < settings.maxTradesPerDay, label: `Trade count OK (${d.tradesToday}/${settings.maxTradesPerDay})` },
    { ok: d.consecutiveLosses < settings.maxConsecutiveLosses, label: `Consecutive losses OK (${d.consecutiveLosses}/${settings.maxConsecutiveLosses})` },
    { ok: !d.isLocked, label: d.isLocked ? 'Discipline lock active' : 'No lock active' },
  ]

  return (
    <div className="border-b border-[#1e293b] px-3 py-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {d.isLocked
            ? <ShieldOff size={11} className="text-[#ef4444]" />
            : <ShieldCheck size={11} className="text-[#22c55e]" />}
          <span className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-widest">Discipline</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold" style={{ color: gradeColor }}>{grade}</span>
          <span className="text-[10px] text-[#64748b]">·</span>
          <span className="text-[10px] font-bold" style={{ color: gradeColor }}>{d.disciplineScore}</span>
        </div>
      </div>

      {/* Counters */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-[#475569] w-[80px]">Trades Today</span>
          <ProgressBar value={d.tradesToday} max={settings.maxTradesPerDay} color="bg-[#38bdf8]" />
          <span className="text-[9px] text-white w-[28px] text-right">{d.tradesToday}/{settings.maxTradesPerDay}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-[#475569] w-[80px]">Daily Loss Used</span>
          <ProgressBar value={dailyLossUsedPct * 100} max={100}
            color={dailyLossUsedPct > 0.7 ? 'bg-[#ef4444]' : dailyLossUsedPct > 0.4 ? 'bg-[#f59e0b]' : 'bg-[#22c55e]'} />
          <span className={cn('text-[9px] w-[28px] text-right',
            dailyLossUsedPct > 0.7 ? 'text-[#ef4444]' : 'text-[#94a3b8]')}>
            {Math.round(dailyLossUsedPct * 100)}%
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-1.5">
        {[
          { label: 'Daily P&L', value: formatCurrency(d.dailyPnL), color: d.dailyPnL >= 0 ? '#22c55e' : '#ef4444' },
          { label: 'Remaining Risk', value: formatCurrency(remainingRisk), color: remainingRisk < settings.maxDailyLoss * 0.3 ? '#ef4444' : '#94a3b8' },
          { label: 'Consec Losses', value: String(d.consecutiveLosses), color: d.consecutiveLosses >= settings.maxConsecutiveLosses - 1 ? '#ef4444' : '#94a3b8' },
          { label: 'Remaining Trades', value: String(remainingTrades), color: remainingTrades <= 1 ? '#f59e0b' : '#94a3b8' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#060d1a] rounded px-2 py-1.5">
            <div className="text-[8px] text-[#475569] mb-0.5">{label}</div>
            <div className="text-[11px] font-bold" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Rules */}
      <div className="space-y-1">
        {rules.map(r => <RuleRow key={r.label} ok={r.ok} label={r.label} />)}
      </div>

      {/* Status + actions */}
      {d.isLocked ? (
        <div className="space-y-1.5">
          <div className="flex items-start gap-1.5 bg-[#1a0a0a] border border-[#ef4444]/30 rounded px-2 py-1.5">
            <AlertTriangle size={10} className="text-[#ef4444] mt-0.5 shrink-0" />
            <span className="text-[9px] text-[#ef4444]">{d.lockReason}</span>
          </div>
          <div className="flex gap-1.5">
            <button onClick={d.overrideLock}
              className="flex-1 text-[9px] bg-[#1e3a5f] text-[#f59e0b] border border-[#f59e0b]/40 rounded py-1 hover:bg-[#f59e0b]/10 transition-colors">
              Override (−20 pts)
            </button>
            <button onClick={d.resetDay}
              className="flex items-center gap-1 text-[9px] bg-[#0f1f35] text-[#475569] rounded px-2 py-1 hover:text-white transition-colors">
              <RotateCcw size={9} /> Reset
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 bg-[#0a1f0a] border border-[#22c55e]/25 rounded px-2 py-1">
            <ShieldCheck size={9} className="text-[#22c55e]" />
            <span className="text-[9px] text-[#22c55e] font-semibold">Trading Enabled</span>
          </div>
          <button onClick={d.resetDay}
            className="flex items-center gap-1 text-[9px] text-[#334155] hover:text-[#64748b] transition-colors">
            <RotateCcw size={9} /> Reset Day
          </button>
        </div>
      )}
    </div>
  )
}
