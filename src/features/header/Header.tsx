import { useEffect, useState } from 'react'
import { useMarketStore } from '@/core/store'
import { useSettingsStore } from '@/core/store'
import { formatNumber, isMarketOpen } from '@/lib/utils'
import { InfoTooltip } from '@/components/InfoTooltip'
import { Settings, Plug, PlugZap, User, BookOpen } from 'lucide-react'
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
  BULLISH:  { bg: 'bg-[#22c55e]/15', text: 'text-[#22c55e]', border: 'border-[#22c55e]/40' },
  BEARISH:  { bg: 'bg-[#ef4444]/15', text: 'text-[#ef4444]', border: 'border-[#ef4444]/40' },
  SIDEWAYS: { bg: 'bg-[#f59e0b]/15', text: 'text-[#f59e0b]', border: 'border-[#f59e0b]/40' },
  NEUTRAL:  { bg: 'bg-[#475569]/15', text: 'text-[#475569]', border: 'border-[#475569]/40' },
  NO_TRADE: { bg: 'bg-[#f59e0b]/15', text: 'text-[#f59e0b]', border: 'border-[#f59e0b]/40' },
}

interface Props {
  onSettingsClick: () => void
  onPlaybookClick: () => void
}

export function Header({ onSettingsClick, onPlaybookClick }: Props) {
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
    if (live) activateMockService()
    else if (isTokenValid()) activateLiveService()
    else window.location.href = getLoginURL()
  }

  const isPositive = (quote?.change ?? 0) >= 0
  const pred = predictionColors[prediction1h]
  const hasScores = ceScore > 0 || peScore > 0

  return (
    <div className="flex-shrink-0 bg-[#0a1628] border-b border-[#1e293b]">

      {/* ── Row 1: Brand · Clock · User · Connect · Settings ── */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1e293b]/60">

        {/* Left: Logo + name */}
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="Optrade" className="h-5 w-auto shrink-0" />
          <span className="text-white font-bold text-sm tracking-wide">Optrade</span>
        </div>

        {/* Right: clock · balance · user · playbook · connect · settings */}
        <div className="flex items-center gap-3">
          <span className="text-[#cbd5e1] text-xs font-mono font-semibold tracking-wide">
            {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>

{userName && (
            <div className="hidden sm:flex items-center gap-1">
              <User size={11} className="text-[#38bdf8]" />
              <span className="text-[#38bdf8] text-[10px] font-semibold">{userName}</span>
            </div>
          )}

          <button onClick={onPlaybookClick} title="Trading Playbook" className="text-[#475569] hover:text-[#f59e0b] transition-colors">
            <BookOpen size={14} />
          </button>

          <button
            onClick={handleConnect}
            className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors ${
              live
                ? 'bg-[#22c55e]/10 border-[#22c55e]/40 text-[#22c55e] hover:bg-[#22c55e]/20'
                : 'bg-[#0f1f35] border-[#1e3a5f] text-[#475569] hover:text-[#38bdf8] hover:border-[#38bdf8]/40'
            }`}
          >
            {live ? <PlugZap size={11} /> : <Plug size={11} />}
            <span className="hidden sm:inline">{live ? 'Live' : 'Connect Zerodha'}</span>
          </button>

          <button onClick={onSettingsClick} className="text-[#475569] hover:text-[#38bdf8] transition-colors">
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* ── Row 2: NIFTY · market status · CE/PE scores · prediction ── */}
      <div className="flex items-center gap-3 px-3 py-1.5">

        {/* NIFTY price + change */}
        <div className="flex items-center gap-1.5">
          <span className="text-[#64748b] text-[9px] uppercase tracking-widest">NIFTY</span>
          <span className="text-white font-bold text-sm">
            {quote ? formatNumber(quote.spot) : '—'}
          </span>
          {quote && (
            <span className={`text-[10px] font-semibold ${isPositive ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {isPositive ? '▲' : '▼'} {isPositive ? '+' : ''}{formatNumber(quote.change)}
              <span className="hidden sm:inline"> ({isPositive ? '+' : ''}{quote.changePct.toFixed(2)}%)</span>
            </span>
          )}
          <InfoTooltip content={niftyTooltip} />
        </div>

        {/* Market status */}
        <div className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${marketOpen ? 'bg-[#22c55e] animate-live' : 'bg-[#475569]'}`} />
          <span className={`text-[9px] font-semibold ${marketOpen ? 'text-[#22c55e]' : 'text-[#475569]'}`}>
            {marketOpen ? 'LIVE' : 'CLOSED'}
          </span>
        </div>

        <div className="w-px h-3 bg-[#1e293b]" />

        {/* CE / PE scores + prediction — fixed-width badges so layout never shifts */}
        {hasScores && (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center justify-between w-[68px] bg-[#0d2b0d] border border-[#22c55e]/30 rounded px-1.5 py-0.5">
              <span className="text-[#22c55e] text-[9px] font-bold">CE</span>
              <span className="text-[#22c55e] text-xs font-bold tabular-nums">{ceScore}</span>
            </div>
            <div className="flex items-center justify-between w-[68px] bg-[#2b0d0d] border border-[#ef4444]/30 rounded px-1.5 py-0.5">
              <span className="text-[#ef4444] text-[9px] font-bold">PE</span>
              <span className="text-[#ef4444] text-xs font-bold tabular-nums">{peScore}</span>
            </div>
            <div className={`${pred.bg} border ${pred.border} rounded px-1.5 py-0.5 flex items-center justify-between w-[88px]`}>
              <span className={`${pred.text} text-[9px] font-bold`}>
                {prediction1h === 'BULLISH' ? '↑' : prediction1h === 'BEARISH' ? '↓' : prediction1h === 'SIDEWAYS' ? '↔' : prediction1h === 'NO_TRADE' ? '⊘' : '?'}
              </span>
              <span className={`${pred.text} text-[9px] font-bold hidden sm:inline`}>{prediction1h}</span>
              <span className="text-[#475569] text-[8px]">1h</span>
            </div>
          </div>
        )}

        {/* VIX + PCR + Balance — desktop only, far right */}
        <div className="hidden sm:flex items-center gap-3 ml-auto text-[10px]">
          {quote && (
            <>
              <span className="text-[#64748b]">VIX <span className="text-[#f59e0b] font-semibold">{quote.vix.toFixed(2)}</span></span>
              <span className="text-[#64748b]">PCR <span className={`font-semibold ${quote.pcr > 1 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{quote.pcr.toFixed(2)}</span></span>
            </>
          )}
        </div>
      </div>

    </div>
  )
}
