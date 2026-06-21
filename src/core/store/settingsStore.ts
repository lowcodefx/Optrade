import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  capital: number
  riskPerTrade: number
  maxDailyLoss: number
  maxTradesPerDay: number
  maxConsecutiveLosses: number
  apiKey: string
  apiSecret: string
  accessToken: string
  minTradeScore: number

  // Email alert settings (credentials stored in Azure App Settings, not here)
  enableEmailAlerts: boolean
  emailAlertOnOpportunity: boolean
  emailAlertOnSLHit: boolean
  emailAlertOnProfit: boolean

  setCapital: (v: number) => void
  setRiskPerTrade: (v: number) => void
  setMaxDailyLoss: (v: number) => void
  setMaxTradesPerDay: (v: number) => void
  setMaxConsecutiveLosses: (v: number) => void
  setApiKey: (v: string) => void
  setApiSecret: (v: string) => void
  setAccessToken: (v: string) => void
  setMinTradeScore: (v: number) => void
  setEnableEmailAlerts: (v: boolean) => void
  setEmailAlertOnOpportunity: (v: boolean) => void
  setEmailAlertOnSLHit: (v: boolean) => void
  setEmailAlertOnProfit: (v: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      capital: 100000,
      riskPerTrade: 1.5,
      maxDailyLoss: 3000,
      maxTradesPerDay: 5,
      maxConsecutiveLosses: 2,
      apiKey: '',
      apiSecret: '',
      accessToken: '',
      minTradeScore: 60,
      enableEmailAlerts: false,
      emailAlertOnOpportunity: true,
      emailAlertOnSLHit: true,
      emailAlertOnProfit: true,

      setCapital: (capital) => set({ capital }),
      setRiskPerTrade: (riskPerTrade) => set({ riskPerTrade }),
      setMaxDailyLoss: (maxDailyLoss) => set({ maxDailyLoss }),
      setMaxTradesPerDay: (maxTradesPerDay) => set({ maxTradesPerDay }),
      setMaxConsecutiveLosses: (maxConsecutiveLosses) => set({ maxConsecutiveLosses }),
      setApiKey: (apiKey) => set({ apiKey }),
      setApiSecret: (apiSecret) => set({ apiSecret }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setMinTradeScore: (minTradeScore) => set({ minTradeScore }),
      setEnableEmailAlerts: (enableEmailAlerts) => set({ enableEmailAlerts }),
      setEmailAlertOnOpportunity: (emailAlertOnOpportunity) => set({ emailAlertOnOpportunity }),
      setEmailAlertOnSLHit: (emailAlertOnSLHit) => set({ emailAlertOnSLHit }),
      setEmailAlertOnProfit: (emailAlertOnProfit) => set({ emailAlertOnProfit }),
    }),
    { name: 'optrade-settings' }
  )
)
