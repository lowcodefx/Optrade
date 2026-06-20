import { useEffect, useState } from 'react'
import { useMarketStore } from '@/core/store'
import { useSettingsStore } from '@/core/store'
import { formatNumber, isMarketOpen } from '@/lib/utils'
import { InfoTooltip } from '@/components/InfoTooltip'
import { Settings, Plug, PlugZap } from 'lucide-react'
import { getLoginURL, isTokenValid } from '@/core/services/zerodhaAuth'
import { activateLiveService, activateMockService, useLiveModeStore } from '@/core/services/tradingService'

const niftyTooltip = {
  title: 'NIFTY 50 Index',
  what: 'NIFTY 50 is the benchmark index of NSE representing the weighted average of 50 large-cap Indian companies.',
  why: 'All NIFTY options are priced relative to this underlying. Its direction determines which options gain value.',
  how: 'Traders watch NIFTY spot vs key levels (VWAP, EMA, support/resistance) to decide CE or PE buys.',
  bullish: 'Spot rising above VWAP + EMA stack → Buy CE options.',
  bearish: 'Spot falling below VWAP + EMA stack → Buy PE options.',
}

interface Props {
  onSettingsClick: () => void
}

export function Header({ onSettingsClick }: Props) {
  const quote = useMarketStore(s => s.quote)
  const [time, setTime] = useState(new Date())
  const live = useLiveModeStore(s => s.isLive)
  const marketOpen = isMarketOpen()
  const apiKey = useSettingsStore(s => s.apiKey)

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  function handleConnect() {
    if (!apiKey) { onSettingsClick(); return }
    if (live) {
      activateMockService()
    } else if (isTokenValid()) {
      activateLiveService()
    } else {
      window.location.href = getLoginURL()
    }
  }

  const isPositive = (quote?.change ?? 0) >= 0

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-[#0a1628] border-b border-[#1e293b]">

      {/* Left: Brand + NIFTY */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <span className="text-[#38bdf8] font-bold text-xs sm:text-sm tracking-widest shrink-0">OPTRADE</span>

        <div className="flex items-center gap-1 sm:gap-2 min-w-0">
          <span className="text-[#64748b] text-[9px] sm:text-[10px] shrink-0">NIFTY</span>
          <span className="text-white font-bold text-sm sm:text-base shrink-0">
            {quote ? formatNumber(quote.spot) : '—'}
          </span>
          {quote && (
            <span className={`text-[10px] sm:text-xs font-semibold shrink-0 ${isPositive ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {isPositive ? '▲' : '▼'} {isPositive ? '+' : ''}{formatNumber(quote.change)}
              <span className="hidden sm:inline"> ({isPositive ? '+' : ''}{quote.changePct.toFixed(2)}%)</span>
            </span>
          )}
          {/* Tooltip hidden on mobile to save space */}
          <span className="hidden sm:block">
            <InfoTooltip content={niftyTooltip} />
          </span>
        </div>

        {/* Market status — hidden on mobile */}
        <div className="hidden sm:flex items-center gap-1.5">
          {marketOpen ? (
            <>
              <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-live" />
              <span className="text-[#22c55e] text-[10px] font-semibold">LIVE</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-[#475569]" />
              <span className="text-[#475569] text-[10px]">MARKET CLOSED</span>
            </>
          )}
        </div>

        {/* Market status dot on mobile — icon only */}
        <div className="sm:hidden flex items-center">
          <span className={`w-2 h-2 rounded-full ${marketOpen ? 'bg-[#22c55e]' : 'bg-[#475569]'}`} />
        </div>
      </div>

      {/* Right: VIX + PCR + clock + connect + settings */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">

        {/* VIX + PCR — hidden on mobile */}
        {quote && (
          <div className="hidden sm:flex items-center gap-3 text-[10px]">
            <span className="text-[#64748b]">VIX <span className="text-[#f59e0b] font-semibold">{quote.vix.toFixed(2)}</span></span>
            <span className="text-[#64748b]">PCR <span className={`font-semibold ${quote.pcr > 1 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{quote.pcr.toFixed(2)}</span></span>
          </div>
        )}

        {/* Clock — hidden on mobile */}
        <span className="hidden sm:block text-[#cbd5e1] text-sm font-mono font-semibold tracking-wide">
          {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>

        {/* Connect button — full text on desktop, icon-only on mobile */}
        <button
          onClick={handleConnect}
          className={`flex items-center gap-1 sm:gap-1.5 text-[10px] font-semibold px-2 sm:px-2.5 py-1 rounded border transition-colors ${
            live
              ? 'bg-[#22c55e]/10 border-[#22c55e]/40 text-[#22c55e] hover:bg-[#22c55e]/20'
              : 'bg-[#0f1f35] border-[#1e3a5f] text-[#475569] hover:text-[#38bdf8] hover:border-[#38bdf8]/40'
          }`}
        >
          {live ? <PlugZap size={12} /> : <Plug size={12} />}
          <span className="hidden sm:inline">{live ? 'Live' : 'Connect Zerodha'}</span>
        </button>

        <button onClick={onSettingsClick} className="text-[#475569] hover:text-[#38bdf8] transition-colors p-0.5">
          <Settings size={15} />
        </button>
      </div>
    </div>
  )
}
