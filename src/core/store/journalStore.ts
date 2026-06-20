import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TradeEntry } from '@/core/types/discipline'

export type JournalFilter = 'today' | 'week' | 'all'

interface JournalState {
  entries: TradeEntry[]
  filter: JournalFilter

  addEntry: (e: Omit<TradeEntry, 'id'>) => void
  removeEntry: (id: string) => void
  setFilter: (f: JournalFilter) => void
  getFiltered: () => TradeEntry[]
  getSummary: () => { total: number; wins: number; losses: number; netPnL: number; winRate: number; avgRR: number }
}

const todayStr = () => new Date().toISOString().slice(0, 10)
const weekAgoStr = () => new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)

export const useJournalStore = create<JournalState>()(
  persist(
    (set, get) => ({
      entries: [],
      filter: 'today',

      addEntry: (e) => {
        const entry: TradeEntry = { ...e, id: `J${Date.now()}` }
        set(s => ({ entries: [entry, ...s.entries] }))
      },

      removeEntry: (id) => set(s => ({ entries: s.entries.filter(e => e.id !== id) })),

      setFilter: (filter) => set({ filter }),

      getFiltered: () => {
        const { entries, filter } = get()
        if (filter === 'today') return entries.filter(e => e.date === todayStr())
        if (filter === 'week') return entries.filter(e => e.date >= weekAgoStr())
        return entries
      },

      getSummary: () => {
        const entries = get().getFiltered()
        const wins = entries.filter(e => e.result === 'WIN').length
        const losses = entries.filter(e => e.result === 'LOSS').length
        const netPnL = entries.reduce((s, e) => s + e.pnl, 0)
        const winRate = entries.length > 0 ? (wins / entries.length) * 100 : 0
        const avgRR = entries.length > 0
          ? entries.reduce((s, e) => {
              const sl = Math.abs(e.entryPrice - e.sl)
              const tgt = Math.abs(e.target - e.entryPrice)
              return s + (sl > 0 ? tgt / sl : 0)
            }, 0) / entries.length
          : 0
        return { total: entries.length, wins, losses, netPnL, winRate, avgRR }
      },
    }),
    { name: 'optrade-journal' }
  )
)
