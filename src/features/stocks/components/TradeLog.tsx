import { useState, useEffect } from 'react'
import { BookOpen, X } from 'lucide-react'

export interface TradeLogEntry {
  id: string
  symbol: string
  timestamp: number   // Unix ms
  price: number
  action: 'buy' | 'watchlist'
  signal: string
  note: string
}

const LOG_KEY = 'sw_trade_log'

export function loadTradeLog(): TradeLogEntry[] {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]') } catch { return [] }
}

export function appendTradeLog(e: Omit<TradeLogEntry, 'id' | 'timestamp'>): TradeLogEntry {
  const entry: TradeLogEntry = { ...e, id: Date.now().toString(), timestamp: Date.now() }
  const entries = loadTradeLog()
  entries.unshift(entry)
  localStorage.setItem(LOG_KEY, JSON.stringify(entries.slice(0, 100)))  // keep last 100
  return entry
}

const SIGNALS = ['Volume Spike', 'EMA Bounce', 'Breakout', 'RS Strength', 'Pattern Signal', 'News Catalyst', 'Other']

interface LogEntryModalProps {
  symbol: string
  price: number
  action: 'buy' | 'watchlist'
  onSave: (entry: TradeLogEntry) => void
  onCancel: () => void
}

export function LogEntryModal({ symbol, price, action, onSave, onCancel }: LogEntryModalProps) {
  const [signal, setSignal] = useState(SIGNALS[0])
  const [note, setNote] = useState('')

  function save() {
    const entry = appendTradeLog({ symbol, price, action, signal, note })
    onSave(entry)
  }

  const actionLabel = action === 'buy' ? 'CNC Buy' : 'Watchlist'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onCancel}>
      <div className="bg-[#0a1628] border border-[#1e293b] rounded-xl p-5 w-72 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold text-sm">Log Trade Entry</h3>
          <button onClick={onCancel} className="text-[#64748b] hover:text-white"><X size={13} /></button>
        </div>
        <div className="space-y-3 mb-4">
          <div className="flex justify-between text-[9px]">
            <span className="text-[#475569]">{actionLabel}</span>
            <span className="text-white font-semibold">{symbol} @ Rs.{price.toFixed(2)}</span>
          </div>
          <div>
            <label className="text-[8px] text-[#475569] uppercase tracking-wider block mb-1">Signal that triggered entry</label>
            <select
              value={signal} onChange={e => setSignal(e.target.value)}
              className="w-full bg-[#060d1a] border border-[#1e293b] rounded px-2 py-1 text-white text-[9px] focus:outline-none focus:border-[#38bdf8]"
            >
              {SIGNALS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[8px] text-[#475569] uppercase tracking-wider block mb-1">Note (optional)</label>
            <textarea
              value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder="Why this stock, why nowâ€¦"
              className="w-full bg-[#060d1a] border border-[#1e293b] rounded px-2 py-1 text-white text-[9px] resize-none focus:outline-none focus:border-[#38bdf8] placeholder-[#64748b]"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-1.5 rounded border border-[#1e293b] text-[9px] text-[#475569] hover:text-white">Skip</button>
          <button onClick={save} className="flex-1 py-1.5 rounded bg-[#38bdf8]/90 hover:bg-[#38bdf8] text-[#060d1a] text-[9px] font-bold">Save Log</button>
        </div>
      </div>
    </div>
  )
}

export function TradeLogPanel({ refreshKey }: { refreshKey: number }) {
  const [entries, setEntries] = useState<TradeLogEntry[]>(loadTradeLog)

  useEffect(() => { setEntries(loadTradeLog()) }, [refreshKey])

  function remove(id: string) {
    const next = entries.filter(e => e.id !== id)
    setEntries(next)
    localStorage.setItem(LOG_KEY, JSON.stringify(next))
  }

  return (
    <div className="p-3">
      <div className="flex items-center gap-1.5 mb-3">
        <BookOpen size={11} className="text-[#38bdf8]" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#94a3b8]">Trade Log</span>
        <span className="ml-auto text-[8px] text-[#64748b]">{entries.length} entries</span>
      </div>
      {entries.length === 0 && (
        <p className="text-[8px] text-[#64748b] text-center py-4">No entries yet. Log your entry reasons when bookmarking or buying stocks.</p>
      )}
      <div className="space-y-2">
        {entries.map(e => (
          <div key={e.id} className="bg-[#060d1a] border border-[#1e293b] rounded p-2 relative group">
            <button
              onClick={() => remove(e.id)}
              className="absolute top-1 right-1 text-[#1e293b] group-hover:text-[#64748b] hover:!text-[#ef4444] transition-colors"
            >
              <X size={8} />
            </button>
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[9px] font-bold text-white">{e.symbol}</span>
              <span className="text-[7px] text-[#64748b]">Â·</span>
              <span className={`text-[7px] font-semibold ${e.action === 'buy' ? 'text-[#22c55e]' : 'text-[#38bdf8]'}`}>
                {e.action === 'buy' ? 'CNC Buy' : 'Watchlist'}
              </span>
            </div>
            <div className="flex justify-between text-[8px]">
              <span className="text-[#f59e0b]">{e.signal}</span>
              <span className="text-[#475569]">Rs.{e.price.toFixed(0)}</span>
            </div>
            {e.note && <p className="text-[7px] text-[#64748b] mt-0.5 leading-tight">{e.note}</p>}
            <p className="text-[7px] text-[#1e293b] mt-0.5">{new Date(e.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
