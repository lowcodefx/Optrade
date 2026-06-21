import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { exchangeRequestToken, fetchUserProfile } from '@/core/services/zerodhaAuth'
import { activateLiveService, useLiveModeStore } from '@/core/services/tradingService'
import { useSettingsStore, useMarketStore } from '@/core/store'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Header } from '@/features/header/Header'
import { MarketContext } from '@/features/market-context/MarketContext'
import { TradeStrength } from '@/features/trade-strength/TradeStrength'
import { TrendAnalysis } from '@/features/trend-analysis/TrendAnalysis'
import { DisciplinePanel } from '@/features/discipline/DisciplinePanel'
import { CenterPanel } from '@/features/chart/CenterPanel'
import { OrderEntry } from '@/features/order-entry/OrderEntry'
import { RiskManagement } from '@/features/risk-management/RiskManagement'
import { Settings } from '@/features/settings/Settings'
import { QuickDecisionPopup } from '@/features/quick-popup/QuickDecisionPopup'
import { useNiftyQuote, useOptionChain, useCandles } from '@/core/hooks/useMarketData'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

function DataBootstrap() {
  useNiftyQuote()
  useOptionChain()
  useCandles('5m', 30)
  return null
}

function KeyboardShortcuts({ onQuickPopup }: { onQuickPopup: () => void }) {
  const setCenterTab = useMarketStore(s => s.setCenterTab)
  const setPAEnabled = useMarketStore(s => s.setPAEnabled)
  const paEnabled = useMarketStore(s => s.paEnabled)
  const setChartFullscreen = useMarketStore(s => s.setChartFullscreen)
  const chartFullscreen = useMarketStore(s => s.chartFullscreen)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === '1') setCenterTab('chart')
      if (e.key === '2') setCenterTab('chain')
      if (e.key === '3') setCenterTab('chain') // journal via store extension later
      if (e.key === 'f' || e.key === 'F') setChartFullscreen(!chartFullscreen)
      if (e.key === 'p' || e.key === 'P') setPAEnabled(!paEnabled)
      if (e.key === ' ' || (e.ctrlKey && e.key === 'q')) {
        e.preventDefault()
        onQuickPopup()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paEnabled, chartFullscreen, setCenterTab, setPAEnabled, setChartFullscreen, onQuickPopup])

  return null
}

function ZerodhaCallback() {
  const setAccessToken = useSettingsStore(s => s.setAccessToken)
  const setUserName = useMarketStore(s => s.setUserName)
  const isLive = useLiveModeStore(s => s.isLive)

  // Fetch profile once on mount if already live (stored credentials)
  useEffect(() => {
    if (isLive) {
      fetchUserProfile().then(name => { if (name) setUserName(name) })
    }
  }, [isLive, setUserName])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requestToken = params.get('request_token')
    const status = params.get('status')

    if (requestToken && status === 'success') {
      window.history.replaceState({}, '', window.location.pathname)
      exchangeRequestToken(requestToken)
        .then(accessToken => {
          setAccessToken(accessToken)
          activateLiveService()
          fetchUserProfile().then(name => { if (name) setUserName(name) })
        })
        .catch(err => console.error('Zerodha token exchange failed:', err))
    }
  }, [setAccessToken, setUserName])

  return null
}

export default function App() {
  const [showSettings, setShowSettings] = useState(false)
  const [showQuickPopup, setShowQuickPopup] = useState(false)

  return (
    <QueryClientProvider client={queryClient}>
      <ZerodhaCallback />
      <DataBootstrap />
      <KeyboardShortcuts onQuickPopup={() => setShowQuickPopup(true)} />
      <DashboardLayout
        header={<Header onSettingsClick={() => setShowSettings(true)} />}
        leftDock={
          <>
            <DisciplinePanel />
            <MarketContext />
            <TradeStrength />
            <TrendAnalysis />
          </>
        }
        center={<CenterPanel />}
        rightDock={
          <>
            <OrderEntry />
            <RiskManagement />
          </>
        }
      />
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      {showQuickPopup && <QuickDecisionPopup onClose={() => setShowQuickPopup(false)} />}
    </QueryClientProvider>
  )
}
