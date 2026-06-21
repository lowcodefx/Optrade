import { useMarketStore } from '@/core/store'
import { CandlestickChart } from './CandlestickChart'
import { SetupPanel } from './SetupPanel'
import { Maximize2, Minimize2, TrendingUp, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

const TIMEFRAMES = ['1m', '5m', '15m', '1h'] as const

export function ChartPanel() {
  const candles = useMarketStore(s => s.candles)
  const paEnabled = useMarketStore(s => s.paEnabled)
  const paSetup = useMarketStore(s => s.paSetup)
  const chartFullscreen = useMarketStore(s => s.chartFullscreen)
  const activeTimeframe = useMarketStore(s => s.activeTimeframe)
  const pivotPoints = useMarketStore(s => s.pivotPoints)
  const showPivots = useMarketStore(s => s.showPivots)
  const setPAEnabled = useMarketStore(s => s.setPAEnabled)
  const setChartFullscreen = useMarketStore(s => s.setChartFullscreen)
  const setActiveTimeframe = useMarketStore(s => s.setActiveTimeframe)
  const setShowPivots = useMarketStore(s => s.setShowPivots)

  const setup = paEnabled ? paSetup : null

  return (
    <div className="border-b border-[#1e293b]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-2 bg-[#0a1628] border-b border-[#1e293b]">
        {/* Timeframes */}
        <div className="flex gap-1">
          {TIMEFRAMES.map(tf => (
            <button
              key={tf}
              onClick={() => setActiveTimeframe(tf)}
              className={cn('text-[9px] px-2 py-0.5 rounded border transition-colors',
                tf === activeTimeframe
                  ? 'bg-[#1e3a5f] text-[#38bdf8] border-[#1e3a5f]'
                  : 'text-[#475569] border-transparent hover:text-[#94a3b8]'
              )}
            >{tf}</button>
          ))}
        </div>

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-2 text-[9px]">
          {[['EMA9', '#22c55e'], ['EMA20', '#38bdf8'], ['EMA50', '#f59e0b'], ['VWAP', '#a855f7']].map(([name, color]) => (
            <span key={name} className="flex items-center gap-1">
              <span className="w-3 h-0.5 inline-block rounded" style={{ background: color }} />
              <span style={{ color }}>{name}</span>
            </span>
          ))}
          {/* Pivot legend */}
          {showPivots && pivotPoints && (
            <>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block rounded bg-[#ef4444]" /><span className="text-[#ef4444]">S2</span></span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block rounded bg-[#f59e0b]" /><span className="text-[#f59e0b]">PP</span></span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block rounded bg-[#22c55e]" /><span className="text-[#22c55e]">R2</span></span>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Pivot toggle */}
          <button
            onClick={() => setShowPivots(!showPivots)}
            title="Toggle Pivot Points (S1/S2/R1/R2)"
            className={cn('flex items-center gap-1 text-[9px] px-2 py-0.5 rounded border transition-colors',
              showPivots && pivotPoints
                ? 'bg-[#1a1400] border-[#f59e0b]/50 text-[#f59e0b]'
                : 'border-transparent text-[#475569] hover:text-[#94a3b8]'
            )}
          >
            <Target size={10} />
            <span className="hidden sm:inline">Pivots</span>
          </button>

          {/* PA Analyser toggle */}
          <button
            onClick={() => setPAEnabled(!paEnabled)}
            className={cn('flex items-center gap-1.5 text-[10px] font-semibold px-2 sm:px-3 py-1 rounded border transition-all',
              paEnabled
                ? 'bg-[#1a1035] border-[#7c3aed] text-[#a78bfa]'
                : 'bg-transparent border-[#334155] text-[#64748b] hover:text-[#94a3b8]'
            )}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full', paEnabled ? 'bg-[#7c3aed]' : 'bg-[#334155]')} />
            <TrendingUp size={11} />
            <span className="hidden sm:inline">Price Action Analyser</span>
            <span className="sm:hidden">PA</span>
          </button>

          <button
            onClick={() => setChartFullscreen(!chartFullscreen)}
            className="hidden sm:block text-[#475569] hover:text-[#38bdf8] transition-colors p-1"
            title="Toggle fullscreen"
          >
            {chartFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-[#060d1a] px-2 pt-2">
        <CandlestickChart
          candles={candles}
          entry={setup?.entry}
          sl={setup?.sl}
          target={setup?.target}
          pivotPoints={showPivots ? pivotPoints : null}
          height={typeof window !== 'undefined' && window.innerWidth < 768 ? 280 : 220}
        />
      </div>

      {/* Pattern badges */}
      {paEnabled && paSetup && paSetup.patterns.length > 0 && (
        <div className="flex gap-2 px-3 py-1.5 bg-[#060d1a] flex-wrap">
          {paSetup.patterns.slice(0, 3).map((p, i) => (
            <span key={i} className="text-[9px] font-semibold px-2 py-0.5 rounded border border-[#7c3aed] bg-[#1a1035] text-[#a78bfa]">
              {p.label}
            </span>
          ))}
        </div>
      )}

      {/* Pivot point values bar */}
      {showPivots && pivotPoints && (
        <div className="flex items-center gap-3 px-3 py-1.5 bg-[#060d1a] border-t border-[#0f1f35] text-[9px] font-mono overflow-x-auto">
          <span className="text-[#ef4444] shrink-0">S2 {pivotPoints.s2.toFixed(0)}</span>
          <span className="text-[#fca5a5] shrink-0">S1 {pivotPoints.s1.toFixed(0)}</span>
          <span className="text-[#f59e0b] font-bold shrink-0">PP {pivotPoints.pp.toFixed(0)}</span>
          <span className="text-[#86efac] shrink-0">R1 {pivotPoints.r1.toFixed(0)}</span>
          <span className="text-[#22c55e] shrink-0">R2 {pivotPoints.r2.toFixed(0)}</span>
          <span className="text-[#475569] ml-auto shrink-0">Prev H:{pivotPoints.prevHigh.toFixed(0)} L:{pivotPoints.prevLow.toFixed(0)} C:{pivotPoints.prevClose.toFixed(0)}</span>
        </div>
      )}

      {/* Setup recommendation panel */}
      {paEnabled && paSetup && paSetup.direction !== 'neutral' && (
        <SetupPanel setup={paSetup} onDismiss={() => setPAEnabled(false)} />
      )}
    </div>
  )
}
