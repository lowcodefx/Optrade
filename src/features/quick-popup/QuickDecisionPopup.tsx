import { useEffect } from 'react'
import { useMarketStore, useDisciplineStore, useOrderStore } from '@/core/store'
import { useSettingsStore } from '@/core/store'
import { X, Zap, TrendingUp, TrendingDown, Minus, ShieldOff } from 'lucide-react'
import { formatNumber, cn } from '@/lib/utils'
import type { MarketRegime } from '@/core/types/discipline'

interface Props {
  onClose: () => void
}

function deriveRegime(adx: number, trend: string, vix: number): MarketRegime {
  if (vix > 20) return 'Volatile'
  if (adx >= 25 && trend === 'bullish') return 'Trending Up'
  if (adx >= 25 && trend === 'bearish') return 'Trending Down'
  return 'Range Bound'
}

function buildReasoning(signals: Array<{ label: string; met: boolean; value?: number | string }>): string[] {
  return signals.filter(s => s.met).map(s => s.label)
}

export function QuickDecisionPopup({ onClose }: Props) {
  const quote = useMarketStore(s => s.quote)
  const tradeStrength = useMarketStore(s => s.tradeStrength)
  const trendAnalysis = useMarketStore(s => s.trendAnalysis)
  const paSetup = useMarketStore(s => s.paSetup)
  const discipline = useDisciplineStore()
  const settings = useSettingsStore()
  const applySetup = useOrderStore(s => s.applySetup)
  const setCenterTab = useMarketStore(s => s.setCenterTab)

  // Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!quote || !tradeStrength || !trendAnalysis) return null

  const score = tradeStrength.score
  const direction = paSetup?.direction ?? trendAnalysis.trend
  const regime = deriveRegime(trendAnalysis.adx, direction, quote.vix)

  // Suggested action
  const suggestedAction =
    score >= 65 && direction === 'bullish' ? 'BUY ATM CE' :
    score >= 65 && direction === 'bearish' ? 'BUY ATM PE' :
    score >= 45 ? 'WAIT' : 'NO TRADE'

  const canAct = suggestedAction === 'BUY ATM CE' || suggestedAction === 'BUY ATM PE'

  const disciplineCheck = discipline.checkCanTrade(score)

  const actionColor =
    suggestedAction === 'BUY ATM CE' ? '#22c55e' :
    suggestedAction === 'BUY ATM PE' ? '#ef4444' :
    suggestedAction === 'WAIT' ? '#f59e0b' : '#475569'

  const rsiStatus = trendAnalysis.rsi >= 70 ? 'Overbought' : trendAnalysis.rsi >= 55 ? 'Strong' : trendAnalysis.rsi >= 45 ? 'Neutral' : 'Weak'
  const adxStatus = trendAnalysis.adx >= 25 ? 'Strong Trend' : trendAnalysis.adx >= 20 ? 'Trending' : 'Weak'

  // Reasoning bullets from active signals
  const reasoningBullets = buildReasoning([
    { label: 'Price above VWAP', met: trendAnalysis.aboveVWAP },
    { label: 'EMA 9 > 20 > 50 aligned', met: trendAnalysis.emaAligned },
    { label: `RSI ${trendAnalysis.rsi.toFixed(0)} — ${rsiStatus}`, met: trendAnalysis.rsi > 50 && trendAnalysis.rsi < 70 },
    { label: `ADX ${trendAnalysis.adx.toFixed(0)} — ${adxStatus}`, met: trendAnalysis.adx > 20 },
    { label: `PCR ${quote.pcr.toFixed(2)} — Put Writing Active`, met: quote.pcr > 1.1 },
    { label: `VIX ${quote.vix.toFixed(1)} — Low Volatility`, met: quote.vix < 16 },
    { label: `Market Breadth ${quote.breadth}% Positive`, met: quote.breadth > 55 },
    { label: 'PA Pattern Detected', met: (paSetup?.patterns.length ?? 0) > 0 },
  ])

  // Best CE/PE from option chain
  const optionChain = useMarketStore.getState().optionChain
  const atm = optionChain?.strikes.find(s => s.strike === optionChain.atmStrike)
  const ceEntry = paSetup?.optionEntry ?? atm?.ce.ltp ?? 185
  const peSL = paSetup?.optionSL ?? Math.round(ceEntry * 0.84)
  const ceTgt = paSetup?.optionTarget ?? Math.round(ceEntry * 1.27)
  const rr = paSetup?.rr ?? 1.7

  function handleBuyCE() {
    if (atm) applySetup(atm.strike, 'CE', peSL, ceTgt, ceEntry)
    setCenterTab('chart')
    onClose()
  }
  function handleBuyPE() {
    if (atm) applySetup(atm.strike, 'PE', peSL, ceTgt, ceEntry)
    setCenterTab('chart')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl w-[520px] shadow-2xl shadow-black/60"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e293b]">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-[#f59e0b]" />
            <span className="text-sm font-bold text-white">Quick Decision</span>
            <span className="text-[9px] text-[#334155] bg-[#0f1f35] px-2 py-0.5 rounded">SPACE · ESC</span>
          </div>
          <button onClick={onClose} className="text-[#475569] hover:text-white transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Price row */}
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-white">{formatNumber(quote.spot, 2)}</span>
            <span className={cn('text-sm font-semibold', quote.change >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]')}>
              {quote.change >= 0 ? '+' : ''}{formatNumber(quote.change, 2)}
              <span className="text-xs ml-1">({quote.changePct >= 0 ? '+' : ''}{quote.changePct.toFixed(2)}%)</span>
            </span>
            <span className="text-xs text-[#334155] ml-auto">VIX {quote.vix.toFixed(1)} · PCR {quote.pcr.toFixed(2)}</span>
          </div>

          {/* 3 stat cards */}
          <div className="grid grid-cols-3 gap-2">
            {/* Direction */}
            <div className="bg-[#060d1a] border border-[#1e293b] rounded-lg px-3 py-2.5 text-center">
              <div className="text-[9px] text-[#475569] uppercase tracking-wider mb-1.5">Direction</div>
              <div className="flex items-center justify-center gap-1.5">
                {direction === 'bullish'
                  ? <TrendingUp size={14} className="text-[#22c55e]" />
                  : direction === 'bearish'
                  ? <TrendingDown size={14} className="text-[#ef4444]" />
                  : <Minus size={14} className="text-[#f59e0b]" />}
                <span className={cn('text-sm font-bold capitalize',
                  direction === 'bullish' ? 'text-[#22c55e]' :
                  direction === 'bearish' ? 'text-[#ef4444]' : 'text-[#f59e0b]')}>
                  {direction}
                </span>
              </div>
            </div>

            {/* Strength */}
            <div className="bg-[#060d1a] border border-[#1e293b] rounded-lg px-3 py-2.5 text-center">
              <div className="text-[9px] text-[#475569] uppercase tracking-wider mb-1.5">Strength</div>
              <div className="text-sm font-bold" style={{ color: score >= 65 ? '#22c55e' : score >= 45 ? '#f59e0b' : '#ef4444' }}>
                {score}<span className="text-[10px] text-[#475569]">/100</span>
              </div>
              <div className="mt-1 h-1 bg-[#0f1f35] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${score}%`, background: score >= 65 ? '#22c55e' : score >= 45 ? '#f59e0b' : '#ef4444' }} />
              </div>
            </div>

            {/* Regime */}
            <div className="bg-[#060d1a] border border-[#1e293b] rounded-lg px-3 py-2.5 text-center">
              <div className="text-[9px] text-[#475569] uppercase tracking-wider mb-1.5">Regime</div>
              <div className="text-[11px] font-bold text-[#38bdf8] leading-tight">{regime}</div>
            </div>
          </div>

          {/* Suggested action */}
          {canAct ? (
            <div className="rounded-lg px-4 py-3 border" style={{
              background: direction === 'bullish' ? '#0a1f0a' : '#1a0a0a',
              borderColor: `${actionColor}40`,
            }}>
              <div className="flex items-center gap-2 mb-1.5">
                <Zap size={12} style={{ color: actionColor }} />
                <span className="text-sm font-bold" style={{ color: actionColor }}>{suggestedAction}</span>
              </div>
              <div className="text-[10px] text-[#64748b]">
                Entry <span className="text-white">₹{ceEntry}</span> · SL <span className="text-[#ef4444]">₹{peSL}</span> · Target <span className="text-[#22c55e]">₹{ceTgt}</span> · RR <span className="text-[#38bdf8]">{rr}:1</span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg px-4 py-3 bg-[#0f1a2a] border border-[#1e293b] text-center">
              <span className="text-sm font-bold" style={{ color: actionColor }}>{suggestedAction}</span>
              <span className="text-[10px] text-[#475569] ml-2">Score {score} — {score < 45 ? 'avoid trading' : 'wait for better setup'}</span>
            </div>
          )}

          {/* Reasoning */}
          {reasoningBullets.length > 0 && (
            <div className="space-y-1">
              <div className="text-[9px] text-[#334155] uppercase tracking-widest">Why This Trade</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                {reasoningBullets.map(r => (
                  <div key={r} className="flex items-center gap-1.5 text-[10px] text-[#64748b]">
                    <span className="text-[#22c55e]">•</span>{r}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Discipline status */}
          {!disciplineCheck.allowed ? (
            <div className="flex items-start gap-2 bg-[#1a0a0a] border border-[#ef4444]/30 rounded-lg px-3 py-2">
              <ShieldOff size={12} className="text-[#ef4444] mt-0.5 shrink-0" />
              <div>
                <div className="text-[10px] font-semibold text-[#ef4444]">Trading Blocked</div>
                <div className="text-[9px] text-[#ef4444]/70">{disciplineCheck.reason}</div>
              </div>
            </div>
          ) : disciplineCheck.warning ? (
            <div className="flex items-start gap-2 bg-[#1a1200] border border-[#f59e0b]/30 rounded-lg px-3 py-2">
              <span className="text-[#f59e0b] text-xs mt-0.5">⚠</span>
              <div className="text-[9px] text-[#f59e0b]">{disciplineCheck.warning}</div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[9px] text-[#22c55e]">
              <span>✓</span>
              <span>Trading enabled · {settings.maxTradesPerDay - discipline.tradesToday} trades remaining today</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleBuyCE}
              disabled={!disciplineCheck.allowed}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-bold text-sm transition-colors',
                disciplineCheck.allowed
                  ? 'bg-[#22c55e] text-black hover:bg-[#16a34a]'
                  : 'bg-[#0f1f35] text-[#334155] cursor-not-allowed'
              )}>
              <Zap size={13} /> BUY CE
            </button>
            <button
              onClick={handleBuyPE}
              disabled={!disciplineCheck.allowed}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-bold text-sm transition-colors',
                disciplineCheck.allowed
                  ? 'bg-[#ef4444] text-white hover:bg-[#dc2626]'
                  : 'bg-[#0f1f35] text-[#334155] cursor-not-allowed'
              )}>
              <Zap size={13} /> BUY PE
            </button>
            <button onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-[#475569] border border-[#1e293b] hover:text-white hover:border-[#334155] text-sm font-semibold transition-colors">
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
