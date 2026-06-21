import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AlertType = 'price-above' | 'price-below' | 'ce-score' | 'pe-score'

export interface AlertRule {
  id: string
  type: AlertType
  value: number
  label: string
  active: boolean
  triggered: boolean
  triggeredAt?: string
}

interface AlertStore {
  rules: AlertRule[]
  notificationsEnabled: boolean
  addRule: (r: Omit<AlertRule, 'id' | 'triggered'>) => void
  removeRule: (id: string) => void
  markTriggered: (id: string) => void
  resetTriggers: () => void
  setNotificationsEnabled: (v: boolean) => void
}

export const useAlertStore = create<AlertStore>()(
  persist(
    (set) => ({
      rules: [],
      notificationsEnabled: false,

      addRule: (r) => set(s => ({
        rules: [...s.rules, { ...r, id: Date.now().toString(), triggered: false }],
      })),

      removeRule: (id) => set(s => ({ rules: s.rules.filter(r => r.id !== id) })),

      markTriggered: (id) => set(s => ({
        rules: s.rules.map(r =>
          r.id === id ? { ...r, triggered: true, triggeredAt: new Date().toLocaleTimeString('en-IN') } : r
        ),
      })),

      resetTriggers: () => set(s => ({
        rules: s.rules.map(r => ({ ...r, triggered: false, triggeredAt: undefined })),
      })),

      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
    }),
    { name: 'optrade-alerts' }
  )
)
