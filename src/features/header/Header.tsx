import { useEffect, useState } from 'react'
import { useMarketStore } from '@/core/store'
import { formatNumber, isMarketOpen } from '@/lib/utils'
import { InfoTooltip } from '@/components/InfoTooltip'
import { Settings } from 'lucide-react'

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
  const marketOpen = isMarketOpen()

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const isPositive = (quote?.change ?? 0) >= 0

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-[#0a1628] border-b border-[#1e293b]">
      {/* Brand + NIFTY */}
      <div className="flex items-center gap-4">
        <span className="text-[#38bdf8] font-bold text-sm tracking-widest">OPTRADE</span>
        <div className="flex items-center gap-2">
          <span className="text-[#64748b] text-[10px]">NIFTY</span>
          <span className="text-white font-bold text-base">
            {quote ? formatNumber(quote.spot) : '—'}
          </span>
          {quote && (
            <span className={`text-xs font-semibold ${isPositive ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {isPositive ? '▲' : '▼'} {isPositive ? '+' : ''}{formatNumber(quote.change)} ({isPositive ? '+' : ''}{quote.changePct.toFixed(2)}%)
            </span>
          )}
          <InfoTooltip content={niftyTooltip} />
        </div>

        {/* Market status */}
        <div className="flex items-center gap-1.5">
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
      </div>

      {/* Right — time + VIX + settings */}
      <div className="flex items-center gap-4">
        {quote && (
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-[#64748b]">VIX <span className="text-[#f59e0b] font-semibold">{quote.vix.toFixed(2)}</span></span>
            <span className="text-[#64748b]">PCR <span className={`font-semibold ${quote.pcr > 1 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{quote.pcr.toFixed(2)}</span></span>
          </div>
        )}
        <span className="text-[#cbd5e1] text-sm font-mono font-semibold tracking-wide">
          {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
        <button onClick={onSettingsClick} className="text-[#475569] hover:text-[#38bdf8] transition-colors">
          <Settings size={14} />
        </button>
      </div>
    </div>
  )
}
