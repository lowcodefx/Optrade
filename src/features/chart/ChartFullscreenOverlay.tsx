import { useEffect } from 'react'
import { useMarketStore } from '@/core/store'
import { CandlestickChart } from './CandlestickChart'
import { SetupPanel } from './SetupPanel'
import { X, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '1D'] as const

export function ChartFullscreenOverlay() {
  const candles = useMarketStore(s => s.candles)
  const quote = useMarketStore(s => s.quote)
  const paEnabled = useMarketStore(s => s.paEnabled)
  const paSetup = useMarketStore(s => s.paSetup)
  const setPAEnabled = useMarketStore(s => s.setPAEnabled)
  const setChartFullscreen = useMarketStore(s => s.setChartFullscreen)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setChartFullscreen(false)
      if (e.key === 'p' || e.key === 'P') setPAEnabled(!paEnabled)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paEnabled, setPAEnabled, setChartFullscreen])

  const setup = paEnabled ? paSetup : null
  const isPositive = (quote?.change ?? 0) >= 0

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#060d1a]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-[#0a1628] border-b border-[#1e293b] flex-shrink-0">
        <span className="text-white font-bold text-sm">NIFTY</span>
        {quote && (
          <>
            <span className="text-white font-bold text-lg">{quote.spot.toFixed(2)}</span>
            <span className={`text-sm font-semibold ${isPositive ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {isPositive ? '▲' : '▼'} {Math.abs(quote.change).toFixed(2)} ({Math.abs(quote.changePct).toFixed(2)}%)
            </span>
            <span className="text-[#475569] text-[10px]">O: {quote.open} H: {quote.high} L: {quote.low}</span>
          </>
        )}
        {paEnabled && (
          <span className="text-[9px] font-semibold px-2 py-0.5 rounded border border-[#22c55e] bg-[#0d2b0d] text-[#22c55e]">
            ● Price Action ON
          </span>
        )}
        <button onClick={() => setChartFullscreen(false)} className="ml-auto flex items-center gap-1.5 text-[#64748b] hover:text-white transition-colors border border-[#334155] rounded px-3 py-1 text-xs">
          <X size={12} /> Exit Fullscreen
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-[#080f1a] border-b border-[#0f1f35] flex-shrink-0">
        {TIMEFRAMES.map(tf => (
          <button key={tf} className={cn('text-[10px] px-2.5 py-0.5 rounded border transition-colors',
            tf === '5m' ? 'bg-[#1e3a5f] text-[#38bdf8] border-[#1e3a5f]' : 'text-[#475569] border-transparent hover:text-[#94a3b8]'
          )}>{tf}</button>
        ))}
        <div className="h-4 w-px bg-[#1e293b] mx-2" />
        {[['EMA', true], ['VWAP', true], ['BB', false], ['Volume', false]].map(([label, active]) => (
          <button key={label as string} className={cn('text-[10px] px-2 py-0.5 rounded border',
            active ? 'bg-[#1e3a5f] text-[#38bdf8] border-[#1e3a5f]' : 'text-[#475569] border-transparent hover:text-[#94a3b8]'
          )}>{label as string}</button>
        ))}
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setPAEnabled(!paEnabled)}
            className={cn('flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1 rounded border transition-all',
              paEnabled ? 'bg-[#1a1035] border-[#7c3aed] text-[#a78bfa]' : 'bg-transparent border-[#334155] text-[#64748b] hover:text-[#94a3b8]'
            )}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full', paEnabled ? 'bg-[#7c3aed]' : 'bg-[#334155]')} />
            <TrendingUp size={11} /> Price Action Analyser
          </button>
          {/* Legend */}
          <div className="flex items-center gap-2 text-[9px]">
            {[['EMA9', '#22c55e'], ['EMA20', '#38bdf8'], ['EMA50', '#f59e0b'], ['VWAP', '#a855f7']].map(([n, c]) => (
              <span key={n} className="flex items-center gap-1">
                <span className="w-3 h-0.5 inline-block rounded" style={{ background: c }} />
                <span style={{ color: c }}>{n}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Chart body — fills remaining space */}
      <div className="flex-1 overflow-hidden px-2 pt-2 bg-[#060d1a]">
        <CandlestickChart
          candles={candles}
          entry={setup?.entry}
          sl={setup?.sl}
          target={setup?.target}
          height={undefined}
        />
      </div>

      {/* Setup panel */}
      {paEnabled && paSetup && paSetup.direction !== 'neutral' && (
        <div className="flex-shrink-0">
          <SetupPanel setup={paSetup} onDismiss={() => setPAEnabled(false)} />
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center px-4 py-1.5 bg-[#0a1628] border-t border-[#1e293b] flex-shrink-0">
        <span className="text-[#475569] text-[10px]">
          {paEnabled && paSetup ? `▲ ${paSetup.patterns[0]?.label ?? 'Pattern detected'} · Entry ${paSetup.entry} · SL ${paSetup.sl} · Target ${paSetup.target}` : 'EMA 9 · EMA 20 · EMA 50 · VWAP — 5 min candles'}
        </span>
        <span className="ml-auto text-[#1e293b] text-[9px]">Press Esc to exit · P to toggle Price Action</span>
      </div>
    </div>
  )
}
