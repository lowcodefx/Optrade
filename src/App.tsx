import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { exchangeRequestToken, fetchUserProfile, fetchUserMargins } from '@/core/services/zerodhaAuth'
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
import { TradingPlaybook } from '@/features/playbook/TradingPlaybook'
import { useNiftyQuote, useOptionChain, useCandles, useNifty50Breadth } from '@/core/hooks/useMarketData'
import { ShieldCheck, Activity, TrendingUp } from 'lucide-react'

type LeftTab = 'discipline' | 'market' | 'analysis'

const LEFT_TABS: Array<{ id: LeftTab; label: string; Icon: typeof ShieldCheck }> = [
  { id: 'discipline', label: 'Discipline', Icon: ShieldCheck },
  { id: 'market',     label: 'Market',     Icon: Activity },
  { id: 'analysis',  label: 'Analysis',   Icon: TrendingUp },
]

function LeftDockTabs() {
  const [tab, setTab] = useState<LeftTab>('analysis')
  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-[#1e293b] shrink-0">
        {LEFT_TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-[9px] font-semibold uppercase tracking-widest transition-colors ${
              tab === id
                ? 'text-[#38bdf8] border-b-2 border-[#38bdf8]'
                : 'text-[#475569] border-b-2 border-transparent hover:text-[#94a3b8]'
            }`}
          >
            <Icon size={11} />
            {label}
          </button>
        ))}
      </div>
      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'discipline' && <DisciplinePanel />}
        {tab === 'market'     && <><MarketContext /><TradeStrength /></>}
        {tab === 'analysis'   && <TrendAnalysis />}
      </div>
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

function DataBootstrap() {
  const tf = useMarketStore(s => s.activeTimeframe)
  const countMap: Record<string, number> = { '1m': 60, '5m': 40, '15m': 30, '1h': 20 }
  useNiftyQuote()
  useOptionChain()
  useCandles(tf, countMap[tf] ?? 30)
  useNifty50Breadth()
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
  const setMargins = useMarketStore(s => s.setMargins)
  const isLive = useLiveModeStore(s => s.isLive)

  function loadLiveData() {
    fetchUserProfile().then(name => { if (name) setUserName(name) })
    fetchUserMargins().then(m => setMargins(m.available, m.used, m.net))
  }

  // Load on mount if already live
  useEffect(() => {
    if (isLive) loadLiveData()
  }, [isLive]) // eslint-disable-line react-hooks/exhaustive-deps

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
          loadLiveData()
        })
        .catch(err => console.error('Zerodha token exchange failed:', err))
    }
  }, [setAccessToken]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

export default function App() {
  const [showSettings, setShowSettings] = useState(false)
  const [showQuickPopup, setShowQuickPopup] = useState(false)
  const [showPlaybook, setShowPlaybook] = useState(false)

  return (
    <QueryClientProvider client={queryClient}>
      <ZerodhaCallback />
      <DataBootstrap />
      <KeyboardShortcuts onQuickPopup={() => setShowQuickPopup(true)} />
      <DashboardLayout
        header={<Header onSettingsClick={() => setShowSettings(true)} onPlaybookClick={() => setShowPlaybook(true)} />}
        leftDock={<LeftDockTabs />}
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
      {showPlaybook && <TradingPlaybook onClose={() => setShowPlaybook(false)} />}
    </QueryClientProvider>
  )
}
