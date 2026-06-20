import { useState } from 'react'
import { useJournalStore } from '@/core/store'
import { AddTradeModal } from './AddTradeModal'
import { Plus, Trash2, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { JournalFilter } from '@/core/store/journalStore'

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-[#0a1628] border border-[#1e293b] rounded-lg px-3 py-2.5 text-center flex-1">
      <div className="text-[9px] text-[#475569] uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm font-bold" style={{ color: color ?? '#e2e8f0' }}>{value}</div>
      {sub && <div className="text-[9px] text-[#334155] mt-0.5">{sub}</div>}
    </div>
  )
}

export function TradeJournal() {
  const store = useJournalStore()
  const [showAdd, setShowAdd] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const entries = store.getFiltered()
  const summary = store.getSummary()

  const FILTERS: { id: JournalFilter; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'all', label: 'All Time' },
  ]

  return (
    <div className="p-3 space-y-3">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <BookOpen size={12} className="text-[#38bdf8]" />
          <span className="text-[11px] font-semibold text-[#94a3b8]">Trade Journal</span>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 text-[10px] bg-[#1e3a5f] text-[#38bdf8] px-2.5 py-1 rounded hover:bg-[#38bdf8]/20 transition-colors">
          <Plus size={10} /> Add Trade
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-[#060d1a] rounded p-0.5">
        {FILTERS.map(({ id, label }) => (
          <button key={id} onClick={() => store.setFilter(id)}
            className={cn('flex-1 text-[9px] py-1 rounded font-semibold transition-colors',
              store.filter === id ? 'bg-[#1e3a5f] text-[#38bdf8]' : 'text-[#475569] hover:text-white')}>
            {label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="flex gap-2">
        <StatCard label="Trades" value={String(summary.total)}
          sub={`${summary.wins}W · ${summary.losses}L`} />
        <StatCard label="Win Rate"
          value={summary.total > 0 ? `${summary.winRate.toFixed(0)}%` : '—'}
          color={summary.winRate >= 50 ? '#22c55e' : '#ef4444'} />
        <StatCard label="Net P&L"
          value={`${summary.netPnL >= 0 ? '+' : ''}₹${Math.round(summary.netPnL).toLocaleString('en-IN')}`}
          color={summary.netPnL >= 0 ? '#22c55e' : '#ef4444'} />
        <StatCard label="Avg RR"
          value={summary.total > 0 ? `${summary.avgRR.toFixed(1)}:1` : '—'}
          color={summary.avgRR >= 1.5 ? '#22c55e' : '#f59e0b'} />
      </div>

      {/* Trade table */}
      {entries.length === 0 ? (
        <div className="text-center py-12 text-[#334155]">
          <BookOpen size={24} className="mx-auto mb-2 opacity-40" />
          <div className="text-xs">No trades logged yet</div>
          <div className="text-[10px] mt-1 text-[#1e3a5f]">Click + Add Trade to log your first trade</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-[#334155] border-b border-[#0f1f35]">
                {['Date', 'Time', 'Strike', 'Lots', 'Entry', 'Exit', 'P&L', 'Score', 'Result', ''].map(h => (
                  <th key={h} className="text-left py-1.5 px-1 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(e => {
                const isWin = e.result === 'WIN'
                const isLoss = e.result === 'LOSS'
                return (
                  <tr key={e.id} className="border-b border-[#0a1628] hover:bg-[#0f1f35]/50 transition-colors group">
                    <td className="py-1.5 px-1 text-[#475569]">{e.date.slice(5)}</td>
                    <td className="py-1.5 px-1 text-[#475569]">{e.time}</td>
                    <td className="py-1.5 px-1 font-semibold text-white">
                      {e.strike}
                      <span className={cn('ml-0.5 font-bold', e.optionType === 'CE' ? 'text-[#22c55e]' : 'text-[#ef4444]')}>
                        {e.optionType}
                      </span>
                    </td>
                    <td className="py-1.5 px-1 text-[#94a3b8]">{e.lots}</td>
                    <td className="py-1.5 px-1 text-[#94a3b8]">{e.entryPrice}</td>
                    <td className="py-1.5 px-1 text-[#94a3b8]">{e.exitPrice}</td>
                    <td className={cn('py-1.5 px-1 font-bold', isWin ? 'text-[#22c55e]' : isLoss ? 'text-[#ef4444]' : 'text-[#94a3b8]')}>
                      {e.pnl >= 0 ? '+' : ''}₹{Math.round(e.pnl).toLocaleString('en-IN')}
                    </td>
                    <td className="py-1.5 px-1">
                      <span className={cn('text-[9px] px-1.5 py-0.5 rounded',
                        e.tradeScore >= 75 ? 'text-[#22c55e] bg-[#22c55e]/10' :
                        e.tradeScore >= 55 ? 'text-[#f59e0b] bg-[#f59e0b]/10' :
                        'text-[#ef4444] bg-[#ef4444]/10')}>
                        {e.tradeScore}
                      </span>
                    </td>
                    <td className="py-1.5 px-1">
                      <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded',
                        isWin ? 'text-[#22c55e] bg-[#22c55e]/10' :
                        isLoss ? 'text-[#ef4444] bg-[#ef4444]/10' :
                        'text-[#f59e0b] bg-[#f59e0b]/10')}>
                        {e.result === 'BREAKEVEN' ? 'B/E' : e.result}
                      </span>
                    </td>
                    <td className="py-1.5 px-1">
                      {confirmDelete === e.id ? (
                        <div className="flex gap-1">
                          <button onClick={() => { store.removeEntry(e.id); setConfirmDelete(null) }}
                            className="text-[#ef4444] text-[9px]">Yes</button>
                          <button onClick={() => setConfirmDelete(null)}
                            className="text-[#475569] text-[9px]">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(e.id)}
                          className="opacity-0 group-hover:opacity-100 text-[#334155] hover:text-[#ef4444] transition-all">
                          <Trash2 size={10} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes column (if any entry has notes) */}
      {entries.some(e => e.notes) && (
        <div className="space-y-1.5">
          <div className="text-[9px] text-[#334155] uppercase tracking-widest">Trade Notes</div>
          {entries.filter(e => e.notes).map(e => (
            <div key={e.id} className="bg-[#060d1a] border border-[#1e293b] rounded px-2.5 py-2">
              <div className="text-[9px] text-[#475569] mb-0.5">{e.date} {e.time} · {e.strike}{e.optionType}</div>
              <div className="text-[10px] text-[#94a3b8]">{e.notes}</div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddTradeModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
