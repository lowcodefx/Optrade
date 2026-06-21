import { useEffect, useState } from 'react'
import { useMarketStore } from '@/core/store'
import { useSettingsStore } from '@/core/store'
import { formatNumber, isMarketOpen } from '@/lib/utils'
import { InfoTooltip } from '@/components/InfoTooltip'
import { Settings, Plug, PlugZap, User } from 'lucide-react'
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

const predictionColors = {
  BULLISH:  { bg: 'bg-[#22c55e]/15', text: 'text-[#22c55e]', border: 'border-[#22c55e]/30' },
  BEARISH:  { bg: 'bg-[#ef4444]/15', text: 'text-[#ef4444]', border: 'border-[#ef4444]/30' },
  SIDEWAYS: { bg: 'bg-[#f59e0b]/15', text: 'text-[#f59e0b]', border: 'border-[#f59e0b]/30' },
  NEUTRAL:  { bg: 'bg-[#475569]/15', text: 'text-[#475569]', border: 'border-[#475569]/30' },
}

interface Props {
  onSettingsClick: () => void
}

export function Header({ onSettingsClick }: Props) {
  const quote = useMarketStore(s => s.quote)
  const ceScore = useMarketStore(s => s.ceScore)
  const peScore = useMarketStore(s => s.peScore)
  const prediction1h = useMarketStore(s => s.prediction1h)
  const userName = useMarketStore(s => s.userName)
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
  const pred = predictionColors[prediction1h]
  const hasScores = ceScore > 0 || peScore > 0

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-[#0a1628] border-b border-[#1e293b] min-h-[44px]">

      {/* Left: Brand + NIFTY + Market status */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
        <img src="/favicon.svg" alt="Optrade" className="h-6 w-auto shrink-0" />

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
          <span className="hidden sm:block">
            <InfoTooltip content={niftyTooltip} />
          </span>
        </div>

        {/* Market status dot */}
        <div className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full shrink-0 ${marketOpen ? 'bg-[#22c55e] animate-live' : 'bg-[#475569]'}`} />
          <span className={`hidden sm:block text-[10px] ${marketOpen ? 'text-[#22c55e] font-semibold' : 'text-[#475569]'}`}>
            {marketOpen ? 'LIVE' : 'CLOSED'}
          </span>
        </div>
      </div>

      {/* Center: CE / PE scores + 1h prediction */}
      {hasScores && (
        <div className="flex items-center gap-1.5 sm:gap-2 mx-2">
          {/* CE score */}
          <div className="flex items-center gap-1 bg-[#0d2b0d] border border-[#22c55e]/30 rounded px-1.5 py-0.5">
            <span className="text-[#22c55e] text-[9px] font-bold">CE</span>
            <span className="text-[#22c55e] text-[10px] sm:text-xs font-bold">{ceScore}</span>
          </div>

          {/* PE score */}
          <div className="flex items-center gap-1 bg-[#2b0d0d] border border-[#ef4444]/30 rounded px-1.5 py-0.5">
            <span className="text-[#ef4444] text-[9px] font-bold">PE</span>
            <span className="text-[#ef4444] text-[10px] sm:text-xs font-bold">{peScore}</span>
          </div>

          {/* 1h prediction */}
          <div className={`${pred.bg} border ${pred.border} rounded px-1.5 py-0.5`}>
            <span className={`${pred.text} text-[9px] sm:text-[10px] font-bold`}>
              {prediction1h === 'BULLISH' ? '↑' : prediction1h === 'BEARISH' ? '↓' : prediction1h === 'SIDEWAYS' ? '↔' : '?'}
              <span className="hidden sm:inline ml-0.5">{prediction1h}</span>
            </span>
          </div>

          <span className="hidden sm:block text-[#475569] text-[9px]">1h</span>
        </div>
      )}

      {/* Right: VIX + PCR + clock + user + connect + settings */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">

        {/* Clock — hidden on mobile */}
        <span className="hidden sm:block text-[#cbd5e1] text-sm font-mono font-semibold tracking-wide">
          {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>

        {/* Username — show if logged in */}
        {userName && (
          <div className="hidden sm:flex items-center gap-1 text-[10px] text-[#64748b]">
            <User size={10} className="text-[#38bdf8]" />
            <span className="text-[#38bdf8] font-semibold">{userName}</span>
          </div>
        )}

        {/* Connect button */}
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
