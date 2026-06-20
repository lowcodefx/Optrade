import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ValidationResult, DisciplineGrade } from '@/core/types/discipline'
import { useSettingsStore } from './settingsStore'

interface DisciplineState {
  tradesToday: number
  dailyPnL: number
  consecutiveLosses: number
  consecutiveWins: number
  disciplineScore: number
  isLocked: boolean
  lockReason: string
  lastTradeTime: number | null
  sessionDate: string // YYYY-MM-DD — resets counters on new day

  recordTrade: (result: 'WIN' | 'LOSS' | 'BREAKEVEN', pnl: number) => void
  checkCanTrade: (tradeScore?: number) => ValidationResult
  resetDay: () => void
  overrideLock: () => void
}

const todayStr = () => new Date().toISOString().slice(0, 10)

export function calcGrade(score: number): DisciplineGrade {
  if (score >= 95) return 'A+'
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 55) return 'C'
  return 'D'
}

export const useDisciplineStore = create<DisciplineState>()(
  persist(
    (set, get) => ({
      tradesToday: 0,
      dailyPnL: 0,
      consecutiveLosses: 0,
      consecutiveWins: 0,
      disciplineScore: 100,
      isLocked: false,
      lockReason: '',
      lastTradeTime: null,
      sessionDate: todayStr(),

      recordTrade: (result, pnl) => {
        const s = get()
        const settings = useSettingsStore.getState()

        // Auto-reset on new trading day
        const today = todayStr()
        const base = s.sessionDate !== today
          ? { tradesToday: 0, dailyPnL: 0, consecutiveLosses: 0, consecutiveWins: 0, disciplineScore: 100, isLocked: false, lockReason: '', sessionDate: today }
          : {}

        const tradesToday = (base.tradesToday ?? s.tradesToday) + 1
        const dailyPnL = (base.dailyPnL ?? s.dailyPnL) + pnl
        const consecutiveLosses = result === 'LOSS'
          ? (base.consecutiveLosses ?? s.consecutiveLosses) + 1
          : 0
        const consecutiveWins = result === 'WIN'
          ? (base.consecutiveWins ?? s.consecutiveWins) + 1
          : 0

        let score = base.disciplineScore ?? s.disciplineScore
        if (result === 'LOSS' && (base.consecutiveLosses ?? s.consecutiveLosses) > 0) score -= 5
        if (dailyPnL < -(settings.maxDailyLoss * 0.7)) score -= 8

        let isLocked = false
        let lockReason = ''

        if (dailyPnL <= -settings.maxDailyLoss) {
          isLocked = true
          lockReason = 'Daily loss limit reached. Trading disabled until next session.'
          score -= 20
        } else if (tradesToday >= settings.maxTradesPerDay) {
          isLocked = true
          lockReason = 'Maximum trades for the day reached.'
          score -= 5
        } else if (consecutiveLosses >= settings.maxConsecutiveLosses) {
          isLocked = true
          lockReason = 'Discipline lock — review your last trades before continuing.'
          score -= 15
        }

        set({
          ...base,
          tradesToday,
          dailyPnL,
          consecutiveLosses,
          consecutiveWins,
          disciplineScore: Math.max(0, Math.min(100, score)),
          isLocked,
          lockReason,
          lastTradeTime: Date.now(),
        })
      },

      checkCanTrade: (tradeScore) => {
        const s = get()
        const settings = useSettingsStore.getState()

        // Reset check for new day
        if (s.sessionDate !== todayStr()) {
          return { allowed: true }
        }

        if (s.isLocked) return { allowed: false, reason: s.lockReason }
        if (s.tradesToday >= settings.maxTradesPerDay)
          return { allowed: false, reason: `Max ${settings.maxTradesPerDay} trades per day reached.` }
        if (s.dailyPnL <= -settings.maxDailyLoss)
          return { allowed: false, reason: 'Daily loss limit reached.' }
        if (s.consecutiveLosses >= settings.maxConsecutiveLosses)
          return { allowed: false, reason: `${settings.maxConsecutiveLosses} consecutive losses. Take a break.` }

        // Warnings (allowed but flagged)
        if (s.lastTradeTime) {
          const minsAgo = (Date.now() - s.lastTradeTime) / 60000
          const prevWasLoss = s.consecutiveLosses > 0
          if (minsAgo < 5 && prevWasLoss) {
            return { allowed: true, warning: 'Potential revenge trade. Last trade was a loss < 5 min ago.' }
          }
        }

        if (tradeScore !== undefined && tradeScore < settings.minTradeScore) {
          return { allowed: true, warning: `Low conviction setup (score ${tradeScore} < min ${settings.minTradeScore}).` }
        }

        return { allowed: true }
      },

      resetDay: () => set({
        tradesToday: 0,
        dailyPnL: 0,
        consecutiveLosses: 0,
        consecutiveWins: 0,
        disciplineScore: 100,
        isLocked: false,
        lockReason: '',
        lastTradeTime: null,
        sessionDate: todayStr(),
      }),

      overrideLock: () => {
        const s = get()
        set({
          isLocked: false,
          lockReason: '',
          disciplineScore: Math.max(0, s.disciplineScore - 20),
        })
      },
    }),
    {
      name: 'optrade-discipline',
      partialize: (s) => ({
        tradesToday: s.tradesToday,
        dailyPnL: s.dailyPnL,
        consecutiveLosses: s.consecutiveLosses,
        consecutiveWins: s.consecutiveWins,
        disciplineScore: s.disciplineScore,
        isLocked: s.isLocked,
        lockReason: s.lockReason,
        lastTradeTime: s.lastTradeTime,
        sessionDate: s.sessionDate,
      }),
    }
  )
)
