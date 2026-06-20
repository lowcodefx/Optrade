import { useState } from 'react'
import { useJournalStore } from '@/core/store'
import { useDisciplineStore } from '@/core/store'
import { X } from 'lucide-react'
import type { TradeResult } from '@/core/types/discipline'

interface Props { onClose: () => void }

const LOT_SIZE = 75

export function AddTradeModal({ onClose }: Props) {
  const addEntry = useJournalStore(s => s.addEntry)
  const recordTrade = useDisciplineStore(s => s.recordTrade)

  const today = new Date().toISOString().slice(0, 10)
  const now = new Date().toTimeString().slice(0, 5)

  const [form, setForm] = useState({
    date: today, time: now,
    strike: 24500, optionType: 'CE' as 'CE' | 'PE',
    lots: 1, entryPrice: 185, exitPrice: 235,
    sl: 155, target: 235, tradeScore: 75,
    regime: 'Trending Up', notes: '',
  })

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function handleSave() {
    const pnl = (form.exitPrice - form.entryPrice) * form.lots * LOT_SIZE
    const result: TradeResult = pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN'
    addEntry({ ...form, pnl, result })
    recordTrade(result, pnl)
    onClose()
  }

  const pnl = (form.exitPrice - form.entryPrice) * form.lots * LOT_SIZE

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl w-[420px] shadow-2xl"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e293b]">
          <span className="text-sm font-semibold text-[#38bdf8]">Log Trade</span>
          <button onClick={onClose} className="text-[#475569] hover:text-white"><X size={15} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Date', key: 'date' as const, type: 'date' },
              { label: 'Time', key: 'time' as const, type: 'time' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label className="text-[9px] text-[#475569] uppercase tracking-wider block mb-1">{label}</label>
                <input type={type} value={form[key] as string}
                  onChange={e => set(key, e.target.value)}
                  className="w-full bg-[#060d1a] border border-[#1e3a5f] rounded px-2 py-1.5 text-white text-xs" />
              </div>
            ))}
          </div>

          {/* Strike + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] text-[#475569] uppercase tracking-wider block mb-1">Strike</label>
              <input type="number" value={form.strike} step={50}
                onChange={e => set('strike', Number(e.target.value))}
                className="w-full bg-[#060d1a] border border-[#1e3a5f] rounded px-2 py-1.5 text-white text-xs" />
            </div>
            <div>
              <label className="text-[9px] text-[#475569] uppercase tracking-wider block mb-1">Option Type</label>
              <div className="flex rounded overflow-hidden border border-[#1e3a5f]">
                {(['CE', 'PE'] as const).map(t => (
                  <button key={t} onClick={() => set('optionType', t)}
                    className={`flex-1 py-1.5 text-xs font-bold transition-colors ${form.optionType === t
                      ? t === 'CE' ? 'bg-[#22c55e] text-black' : 'bg-[#ef4444] text-white'
                      : 'bg-[#060d1a] text-[#475569]'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Entry', key: 'entryPrice' as const },
              { label: 'Exit', key: 'exitPrice' as const },
              { label: 'SL', key: 'sl' as const },
              { label: 'Target', key: 'target' as const },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="text-[9px] text-[#475569] uppercase tracking-wider block mb-1">{label}</label>
                <input type="number" value={form[key] as number} step={1}
                  onChange={e => set(key, Number(e.target.value))}
                  className="w-full bg-[#060d1a] border border-[#1e3a5f] rounded px-2 py-1.5 text-white text-xs" />
              </div>
            ))}
          </div>

          {/* Lots + Score + Regime */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[9px] text-[#475569] uppercase tracking-wider block mb-1">Lots</label>
              <input type="number" value={form.lots} min={1}
                onChange={e => set('lots', Number(e.target.value))}
                className="w-full bg-[#060d1a] border border-[#1e3a5f] rounded px-2 py-1.5 text-white text-xs" />
            </div>
            <div>
              <label className="text-[9px] text-[#475569] uppercase tracking-wider block mb-1">Trade Score</label>
              <input type="number" value={form.tradeScore} min={0} max={100}
                onChange={e => set('tradeScore', Number(e.target.value))}
                className="w-full bg-[#060d1a] border border-[#1e3a5f] rounded px-2 py-1.5 text-white text-xs" />
            </div>
            <div>
              <label className="text-[9px] text-[#475569] uppercase tracking-wider block mb-1">Regime</label>
              <select value={form.regime} onChange={e => set('regime', e.target.value)}
                className="w-full bg-[#060d1a] border border-[#1e3a5f] rounded px-2 py-1.5 text-white text-xs">
                {['Trending Up', 'Trending Down', 'Range Bound', 'Volatile', 'Expiry Mode'].map(r =>
                  <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[9px] text-[#475569] uppercase tracking-wider block mb-1">Notes (optional)</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              className="w-full bg-[#060d1a] border border-[#1e3a5f] rounded px-2 py-1.5 text-white text-xs resize-none"
              placeholder="Setup reasoning, mistakes, learnings..." />
          </div>

          {/* P&L preview */}
          <div className={`text-center py-2 rounded ${pnl >= 0 ? 'bg-[#0a1f0a]' : 'bg-[#1a0a0a]'}`}>
            <span className="text-[10px] text-[#475569]">Calculated P&L · </span>
            <span className={`text-sm font-bold ${pnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {pnl >= 0 ? '+' : ''}₹{Math.round(pnl).toLocaleString('en-IN')}
            </span>
            <span className="text-[9px] text-[#334155] ml-1">({form.lots} lot{form.lots > 1 ? 's' : ''} × {LOT_SIZE})</span>
          </div>

          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-2 rounded text-[#475569] border border-[#1e293b] hover:text-white text-sm transition-colors">
              Cancel
            </button>
            <button onClick={handleSave}
              className="flex-1 py-2 rounded bg-[#38bdf8] text-black font-bold text-sm hover:bg-[#0ea5e9] transition-colors">
              Save Trade
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
