import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { exchangeRequestToken, fetchUserProfile, fetchUserMargins } from '@/core/services/zerodhaAuth'
import { API_BASE, vmHeaders } from '@/core/services/apiClient'
import { activateLiveService, useLiveModeStore } from '@/core/services/tradingService'
import { prefetchInstruments } from '@/core/services/instrumentsCache'
import { useSettingsStore, useMarketStore, useOrderStore } from '@/core/store'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Header } from '@/features/header/Header'
import { MarketContext } from '@/features/market-context/MarketContext'
import { TradeStrength } from '@/features/trade-strength/TradeStrength'
import { TrendAnalysis } from '@/features/trend-analysis/TrendAnalysis'
import { DisciplinePanel } from '@/features/discipline/DisciplinePanel'
import { CenterPanel } from '@/features/chart/CenterPanel'
import { OrderEntry } from '@/features/order-entry/OrderEntry'
import { Settings } from '@/features/settings/Settings'
import { QuickDecisionPopup } from '@/features/quick-popup/QuickDecisionPopup'
import { TradingPlaybook } from '@/features/playbook/TradingPlaybook'
import { useNiftyQuote, useOptionChain, useCandles, useNifty50Breadth, usePivotPoints, useOrders, useGlobalMarkets, useFiiDii } from '@/core/hooks/useMarketData'
import { ShieldCheck, Activity, TrendingUp } from 'lucide-react'
import { MarketSummary } from '@/features/market-summary/MarketSummary'
import { AlertMonitor } from '@/features/alerts/AlertMonitor'
import { SquareOffReminder } from '@/features/square-off/SquareOffReminder'
import { AlertsPanel } from '@/features/alerts/AlertsPanel'
import { TradeEntryWizard } from '@/features/trade-entry/TradeEntryWizard'

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
      {/* AI Market Alerts — always visible regardless of active tab */}
      <div className="shrink-0">
        <MarketSummary />
      </div>
      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'discipline' && <><DisciplinePanel /><AlertsPanel /></>}
        {tab === 'market'     && <><MarketContext /><TradeStrength /></>}
        {tab === 'analysis'   && <TrendAnalysis />}
      </div>
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

// Sets order-entry strike to current ATM on first quote load so the
// user sees the relevant strike immediately instead of a stale default.
function AutoSelectATM() {
  const spot = useMarketStore(s => s.quote?.spot)
  const setStrike = useOrderStore(s => s.setStrike)
  const optionType = useOrderStore(s => s.optionType)
  useEffect(() => {
    if (!spot) return
    const atm = Math.round(spot / 50) * 50
    setStrike(atm, optionType, 0)
  // Run only once when spot first becomes available
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spot !== undefined && spot > 0 ? true : false])
  return null
}

function DataBootstrap() {
  const tf = useMarketStore(s => s.activeTimeframe)
  const countMap: Record<string, number> = { '1m': 60, '5m': 80, '15m': 30, '1h': 20 }
  useNiftyQuote()
  useOptionChain()
  useCandles(tf, countMap[tf] ?? 30)
  useNifty50Breadth()
  usePivotPoints()
  useOrders()
  useGlobalMarkets()
  useFiiDii()
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

// Handles /login?api_key=xxx&v=3 — saves api_key then bounces to Zerodha.
// After login Zerodha redirects back with ?request_token=xxx&status=success
// which ZerodhaCallback picks up automatically.
function LoginRedirect() {
  const apiKey = useSettingsStore(s => s.apiKey)
  const setApiKey = useSettingsStore(s => s.setApiKey)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlKey = params.get('api_key')
    const key = urlKey || apiKey
    if (urlKey && urlKey !== apiKey) setApiKey(urlKey)
    if (key) {
      window.location.href = `https://kite.zerodha.com/connect/login?api_key=${key}&v=3`
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[#060d1a] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-[#38bdf8] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-[#64748b] text-sm">Connecting to Zerodha…</p>
      </div>
    </div>
  )
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

  // Load on mount if already live (stored credentials)
  useEffect(() => {
    if (isLive) {
      loadLiveData()
      prefetchInstruments() // start downloading NFO instruments in background
    }
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
          prefetchInstruments() // start downloading NFO instruments in background
          loadLiveData()
          // Push session to background monitor (fire-and-forget)
          const { apiKey } = useSettingsStore.getState()
          fetch(`${API_BASE}/api/set-token`, {
            method: 'POST',
            headers: vmHeaders({ 'Content-Type': 'application/json', 'X-Requested-With': 'Optrade' }),
            body: JSON.stringify({ apiKey, accessToken }),
          }).catch(() => { /* non-critical */ })
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
  const [showWizard, setShowWizard] = useState(false)

  if (window.location.pathname === '/login') {
    return (
      <QueryClientProvider client={queryClient}>
        <LoginRedirect />
      </QueryClientProvider>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ZerodhaCallback />
      <DataBootstrap />
      <AutoSelectATM />
      <AlertMonitor />
      <SquareOffReminder />
      <KeyboardShortcuts onQuickPopup={() => setShowQuickPopup(true)} />
      <DashboardLayout
        header={<Header onSettingsClick={() => setShowSettings(true)} onPlaybookClick={() => setShowPlaybook(true)} />}
        leftDock={<LeftDockTabs />}
        center={<CenterPanel />}
        rightDock={
          <>
            <div className="p-2 border-b border-[#1e293b]">
              <button
                onClick={() => setShowWizard(true)}
                className="w-full flex items-center justify-center gap-1.5 bg-[#7c3aed] text-white text-[10px] font-bold px-3 py-1.5 rounded hover:bg-[#6d28d9] transition-colors"
              >
                <ShieldCheck size={11} />
                Guided Trade Entry
              </button>
            </div>
            <OrderEntry />
          </>
        }
      />
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      {showQuickPopup && <QuickDecisionPopup onClose={() => setShowQuickPopup(false)} />}
      {showPlaybook && <TradingPlaybook onClose={() => setShowPlaybook(false)} />}
      {showWizard && <TradeEntryWizard onClose={() => setShowWizard(false)} />}
    </QueryClientProvider>
  )
}
