import { useEffect, useState } from 'react'
import { useSettingsStore } from '@/core/store'
import { exchangeRequestToken } from '@/core/services/zerodhaAuth'
import { activateLiveService } from '@/core/services/tradingService'
import { API_BASE, vmHeaders } from '@/core/services/apiClient'
import { TrendingUp, BarChart2, ArrowRight, Loader2 } from 'lucide-react'

function navigate(path: string) {
  window.location.href = path
}

// Handles Zerodha OAuth redirect that lands back on '/'
function useOAuthCallback() {
  const { setAccessToken } = useSettingsStore()
  const [exchanging, setExchanging] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requestToken = params.get('request_token')
    const status = params.get('status')
    if (!requestToken || status !== 'success') return

    window.history.replaceState({}, '', '/')
    setExchanging(true)

    exchangeRequestToken(requestToken)
      .then(accessToken => {
        setAccessToken(accessToken)
        activateLiveService()
        const { apiKey: key } = useSettingsStore.getState()
        fetch(`${API_BASE}/api/set-token`, {
          method: 'POST',
          headers: vmHeaders({ 'Content-Type': 'application/json', 'X-Requested-With': 'Optrade' }),
          body: JSON.stringify({ apiKey: key, accessToken }),
        }).catch(() => {})
        navigate('/dashboard')
      })
      .catch(() => setExchanging(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return exchanging
}

export function Home() {
  const exchanging = useOAuthCallback()
  const { apiKey } = useSettingsStore()

  if (exchanging) {
    return (
      <div className="min-h-screen bg-[#060d1a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="text-[#38bdf8] animate-spin" />
          <p className="text-[#64748b] text-sm">Connecting to Zerodha…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#060d1a] flex flex-col items-center justify-center p-6">

      {/* Logo + brand */}
      <div className="flex items-center gap-3 mb-3">
        <img src="/favicon.svg" alt="Optrade" className="h-10 w-auto" />
        <span className="text-white font-bold text-3xl tracking-tight">Optrade</span>
      </div>
      <p className="text-[#475569] text-sm mb-14 text-center max-w-xs">
        Your personal trading and investment platform
      </p>

      {/* Navigation cards */}
      <div className="flex flex-col sm:flex-row gap-5 w-full max-w-2xl">

        {/* Options Trading */}
        <button
          onClick={() => navigate('/dashboard')}
          className="group flex-1 bg-[#0a1628] border border-[#1e3a5f] hover:border-[#38bdf8]/60 rounded-2xl p-7 text-left transition-all duration-200 hover:bg-[#0d1f3c] hover:shadow-[0_0_40px_rgba(56,189,248,0.08)]"
        >
          <div className="w-11 h-11 rounded-xl bg-[#38bdf8]/10 border border-[#38bdf8]/20 flex items-center justify-center mb-5">
            <TrendingUp size={22} className="text-[#38bdf8]" />
          </div>
          <h2 className="text-white font-bold text-lg mb-2">Options Trading</h2>
          <p className="text-[#475569] text-sm leading-relaxed mb-6">
            Live NIFTY options analysis, CE/PE scoring, order entry, and market alerts.
          </p>
          <div className="flex items-center gap-2 text-[#38bdf8] text-sm font-semibold">
            <span>Open Dashboard</span>
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
          </div>
          {apiKey && (
            <div className="mt-3 inline-flex items-center gap-1.5 bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-full px-2.5 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
              <span className="text-[#22c55e] text-[10px] font-semibold">Zerodha configured</span>
            </div>
          )}
        </button>

        {/* Stock Investments */}
        <button
          onClick={() => navigate('/stocks')}
          className="group flex-1 bg-[#0a1628] border border-[#1e3a5f] hover:border-[#a78bfa]/60 rounded-2xl p-7 text-left transition-all duration-200 hover:bg-[#0d1a2e] hover:shadow-[0_0_40px_rgba(167,139,250,0.08)]"
        >
          <div className="w-11 h-11 rounded-xl bg-[#7c3aed]/10 border border-[#7c3aed]/20 flex items-center justify-center mb-5">
            <BarChart2 size={22} className="text-[#a78bfa]" />
          </div>
          <h2 className="text-white font-bold text-lg mb-2">Stock Investments</h2>
          <p className="text-[#475569] text-sm leading-relaxed mb-6">
            Track your equity portfolio, analyse fundamentals, and plan long-term investments.
          </p>
          <div className="flex items-center gap-2 text-[#a78bfa] text-sm font-semibold">
            <span>Open Portfolio</span>
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
          </div>
          <div className="mt-3 inline-flex items-center gap-1.5 bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-full px-2.5 py-0.5">
            <span className="text-[#f59e0b] text-[10px] font-semibold">Coming soon</span>
          </div>
        </button>

      </div>

      <p className="text-[#1e293b] text-[10px] mt-14 select-none">
        Optrade · Built for Indian markets
      </p>
    </div>
  )
}
