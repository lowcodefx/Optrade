import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useOrderStore, useMarketStore, useDisciplineStore } from '@/core/store'
import { tradingService } from '@/core/services/tradingService'
import { API_BASE, kiteAuthHeaders } from '@/core/services/apiClient'
import { InfoTooltip } from '@/components/InfoTooltip'
import { cn } from '@/lib/utils'
import { Minus, Plus, Zap, AlertTriangle, CheckCircle2, XCircle, ChevronDown } from 'lucide-react'
import { calculateRiskScore } from '@/core/utils/riskScore'

function formatExpiry(expiry: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
    const d = new Date(expiry + 'T00:00:00')
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  return expiry
}

const MIN_RR = 1.5

const tooltip = {
  title: 'Order Entry',
  what: 'Place MIS LIMIT orders for NIFTY options with auto Stop Loss.',
  why: 'MIS ensures intraday square-off. LIMIT gives price control.',
  how: 'Select a strike from the chain, set SL and target, verify all four scores are green, then BUY.',
  bullish: 'Buy CE when Market Score > 600 and prediction is BULLISH.',
  bearish: 'Buy PE when Market Score > 600 and prediction is BEARISH.',
}

// ── Score breakdown row ───────────────────────────────────────────────────────
function BreakdownRow({ label, val, max, passed }: { label: string; val: number; max: number; passed?: boolean }) {
  const pct = max > 0 ? Math.round((val / max) * 100) : 0
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${passed !== false ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`} />
      <span className="flex-1 text-[8px] text-[#94a3b8] truncate">{label}</span>
      <span className="text-[8px] font-semibold text-white">{val}/{max}</span>
      <div className="w-10 h-1 bg-[#1e293b] rounded-full overflow-hidden">
        <div className="h-full bg-[#38bdf8] rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Score badge ───────────────────────────────────────────────────────────────
function ScoreBadge({ label, score, max, sublabel }: { label: string; score: number; max: number; sublabel: string }) {
  const pct   = score / max
  const color = pct >= 0.75 ? '#22c55e' : pct >= 0.55 ? '#f59e0b' : '#ef4444'
  const icon  = pct >= 0.55
    ? <CheckCircle2 size={9} style={{ color }} />
    : <XCircle size={9} style={{ color }} />

  return (
    <div className="bg-[#060d1a] border border-[#1e293b] rounded p-1.5 text-center">
      <div className="flex items-center justify-center gap-1 mb-0.5">
        {icon}
        <span className="text-[8px] text-[#64748b] uppercase tracking-wide">{label}</span>
      </div>
      <div className="font-bold text-xs" style={{ color }}>
        {score}<span className="text-[8px] text-[#475569]">/{max}</span>
      </div>
      <div className="text-[8px] mt-0.5" style={{ color }}>{sublabel}</div>
    </div>
  )
}

export function OrderEntry() {
  const qc            = useQueryClient()
  const chain         = useMarketStore(s => s.optionChain)
  const noTradeReason = useMarketStore(s => s.noTradeReason)
  const ceScore       = useMarketStore(s => s.ceScore)
  const peScore       = useMarketStore(s => s.peScore)
  const tradeStrength  = useMarketStore(s => s.tradeStrength)
  const scoreBreakdown = useMarketStore(s => s.scoreBreakdown)
  const pivotPoints    = useMarketStore(s => s.pivotPoints)

  const {
    strike, optionType, quantity, limitPrice, stopLoss,
    setOptionType, setQuantity, setStopLoss, setLimitPrice,
    lastOrderMessage, setLastOrderMessage, setIsSubmitting,
  } = useOrderStore()

  const [toastVisible, setToastVisible] = useState(false)
  const [expandedBadge, setExpandedBadge] = useState<'ce' | 'pe' | 'strength' | 'risk' | null>(null)

  const currentStrikeData = chain?.strikes.find(s => s.strike === strike)
  const premium           = currentStrikeData ? currentStrikeData[optionType === 'CE' ? 'ce' : 'pe'].ltp : limitPrice
  const strikeOI          = currentStrikeData ? currentStrikeData[optionType === 'CE' ? 'ce' : 'pe'].oi : 0

  // ── R:R ──────────────────────────────────────────────────────────────────
  const entry     = limitPrice || premium
  const risk      = stopLoss && entry ? entry - stopLoss : null
  const autoTarget = risk && risk > 0 ? entry + risk * 2 : 0
  const rr        = risk && risk > 0 && autoTarget ? (autoTarget - entry) / risk : null
  const rrOk      = rr === null || rr >= MIN_RR
  const rrLabel   = rr !== null ? `${rr.toFixed(1)}:1` : '—'
  const rrColor   = rr === null ? '#64748b' : rr >= 2 ? '#22c55e' : rr >= MIN_RR ? '#f59e0b' : '#ef4444'

  // ── Distance to next level for Risk Score ─────────────────────────────────
  const distToResistancePct = useMemo(() => {
    const levels = [pivotPoints?.r1, pivotPoints?.r2, chain?.maxPainStrike].filter(Boolean) as number[]
    const above  = levels.filter(l => l > entry).sort((a, b) => a - b)
    return above.length && entry > 0 ? ((above[0] - entry) / entry * 100) : undefined
  }, [pivotPoints, chain, entry])

  const distToSupportPct = useMemo(() => {
    const levels = [pivotPoints?.s1, pivotPoints?.s2].filter(Boolean) as number[]
    const below  = levels.filter(l => l < entry).sort((a, b) => b - a)
    return below.length && entry > 0 ? ((entry - below[0]) / entry * 100) : undefined
  }, [pivotPoints, chain, entry])

  // ── Risk Score (computed from current trade params) ────────────────────────
  const { hour, minute } = useMemo(() => {
    const ist = new Date(Date.now() + 5.5 * 3600000)
    return { hour: ist.getUTCHours(), minute: ist.getUTCMinutes() }
  }, [])

  const riskScore = useMemo(() => calculateRiskScore({
    entry, stopLoss: stopLoss || null,
    target: autoTarget || null,
    optionType, oi: strikeOI,
    hour, minute,
    distToResistancePct, distToSupportPct,
  }), [entry, stopLoss, autoTarget, optionType, strikeOI, hour, minute, distToResistancePct, distToSupportPct])

  const strengthScore = tradeStrength?.score ?? 0

  const { isLocked, lockReason, checkCanTrade } = useDisciplineStore()
  const canTrade = checkCanTrade(strengthScore)

  // ── NIFTY 15min trend filter ───────────────────────────────────────────────
  const { data: trendData } = useQuery({
    queryKey: ['niftyTrend'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/nifty-trend`, { headers: kiteAuthHeaders() })
      if (!res.ok) return { bias: 'NEUTRAL' as const, note: '' }
      return res.json() as Promise<{ bias: 'UP' | 'DOWN' | 'NEUTRAL'; ema20: number | null; spot: number | null; note: string }>
    },
    refetchInterval: 5 * 60 * 1000,   // refresh every 5 min
    staleTime: 4 * 60 * 1000,
    retry: false,
  })
  const trendBias = trendData?.bias ?? 'NEUTRAL'
  // CE blocked if NIFTY trend is DOWN; PE blocked if NIFTY trend is UP
  const trendBlocksCE = trendBias === 'DOWN'
  const trendBlocksPE = trendBias === 'UP'
  const trendBlocks = (optionType === 'CE' && trendBlocksCE) || (optionType === 'PE' && trendBlocksPE)

  const [orderError, setOrderError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => tradingService.placeOrder({
      symbol: 'NIFTY', strike, optionType,
      expiry: chain?.expiry ?? '',
      quantity: quantity * 65,
      orderType: 'LIMIT', productType: 'MIS',
      price: limitPrice || premium,
      stopLoss: stopLoss || undefined,
    }),
    onSuccess: (res) => {
      setOrderError(null)
      setLastOrderMessage(res.message)
      setToastVisible(true)
      qc.invalidateQueries({ queryKey: ['positions'] })
      setTimeout(() => setToastVisible(false), 4000)
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Order failed'
      const is403 = msg.includes('403') || msg.includes('Forbidden')
      setOrderError(is403 ? 'Session expired — go to Settings and re-authenticate with Zerodha.' : msg)
    },
    onSettled: () => setIsSubmitting(false),
  })

  const canPlace = rrOk && !mutation.isPending && canTrade.allowed && !trendBlocks

  return (
    <div className="flex flex-col border-b border-[#1e293b]">
      <div className="flex items-center gap-1 px-3 pt-2.5 pb-2">
        <span className="text-[9px] text-[#64748b] uppercase tracking-widest font-medium">Order Entry</span>
        <InfoTooltip content={tooltip} />
        <span className="ml-auto text-[9px] font-bold text-[#38bdf8] bg-[#0f1f35] px-1.5 py-0.5 rounded">MIS · LIMIT</span>
      </div>

      {/* NIFTY trend indicator */}
      <div className="flex items-center gap-1.5 px-3 py-1 border-b border-[#1e293b] bg-[#0a1628]">
        <span className="text-[8px] text-[#475569] uppercase tracking-wider">NIFTY 15m Trend</span>
        {trendBias === 'UP' && <span className="text-[9px] font-bold text-[#22c55e]">↑ Uptrend</span>}
        {trendBias === 'DOWN' && <span className="text-[9px] font-bold text-[#ef4444]">↓ Downtrend</span>}
        {trendBias === 'NEUTRAL' && <span className="text-[9px] font-bold text-[#475569]">→ Neutral</span>}
        {trendData?.note && <span className="text-[7px] text-[#334155] ml-auto truncate max-w-[110px]" title={trendData.note}>{trendData.note}</span>}
      </div>

      <div className="px-3 pb-3 space-y-2">
        {/* Trend block banner */}
        {trendBlocks && (
          <div className="mx-2 mb-1 px-3 py-1.5 rounded bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[9px] text-[#f59e0b]">
            ⚠️ NIFTY trend opposes this trade direction ({trendBias === 'DOWN' ? 'Downtrend — avoid CE' : 'Uptrend — avoid PE'})
          </div>
        )}

        {/* NO TRADE banner */}
        {noTradeReason && (
          <div className="flex items-start gap-1.5 bg-[#1a1000] border border-[#f59e0b]/50 rounded px-2 py-2">
            <AlertTriangle size={11} className="text-[#f59e0b] mt-0.5 shrink-0" />
            <div className="text-[9px] text-[#f59e0b] leading-relaxed">
              <span className="font-bold">NO TRADE: </span>{noTradeReason}
            </div>
          </div>
        )}

        {/* 4-score panel */}
        <div className="grid grid-cols-4 gap-1">
          {/* CE Score */}
          <div>
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedBadge(expandedBadge === 'ce' ? null : 'ce')}>
              <ScoreBadge label="CE" score={ceScore} max={1000}
                sublabel={ceScore >= 700 ? 'Strong' : ceScore >= 500 ? 'Moderate' : 'Weak'} />
              <ChevronDown size={8} className={`text-[#475569] transition-transform ${expandedBadge === 'ce' ? 'rotate-180' : ''}`} />
            </div>
            {expandedBadge === 'ce' && scoreBreakdown.length > 0 && (
              <div className="mt-1 px-2 py-1.5 bg-[#0a1628] rounded border border-[#1e293b] space-y-0.5">
                {scoreBreakdown.map(b => (
                  <BreakdownRow key={b.factor} label={b.factor} val={b.cePoints} max={b.maxPoints} passed={b.cePoints > 0} />
                ))}
              </div>
            )}
          </div>

          {/* PE Score */}
          <div>
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedBadge(expandedBadge === 'pe' ? null : 'pe')}>
              <ScoreBadge label="PE" score={peScore} max={1000}
                sublabel={peScore >= 700 ? 'Strong' : peScore >= 500 ? 'Moderate' : 'Weak'} />
              <ChevronDown size={8} className={`text-[#475569] transition-transform ${expandedBadge === 'pe' ? 'rotate-180' : ''}`} />
            </div>
            {expandedBadge === 'pe' && scoreBreakdown.length > 0 && (
              <div className="mt-1 px-2 py-1.5 bg-[#0a1628] rounded border border-[#1e293b] space-y-0.5">
                {scoreBreakdown.map(b => (
                  <BreakdownRow key={b.factor} label={b.factor} val={b.pePoints} max={b.maxPoints} passed={b.pePoints > 0} />
                ))}
              </div>
            )}
          </div>

          {/* Trade Strength */}
          <div>
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedBadge(expandedBadge === 'strength' ? null : 'strength')}>
              <ScoreBadge label="Strength" score={strengthScore} max={100}
                sublabel={tradeStrength?.label ?? '—'} />
              <ChevronDown size={8} className={`text-[#475569] transition-transform ${expandedBadge === 'strength' ? 'rotate-180' : ''}`} />
            </div>
            {expandedBadge === 'strength' && tradeStrength?.signals && tradeStrength.signals.length > 0 && (
              <div className="mt-1 px-2 py-1.5 bg-[#0a1628] rounded border border-[#1e293b] space-y-0.5">
                {tradeStrength.signals.map(s => (
                  <BreakdownRow key={s.name} label={s.name} val={s.passed ? s.weight : 0} max={s.weight} passed={s.passed} />
                ))}
              </div>
            )}
          </div>

          {/* Risk Score */}
          <div>
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedBadge(expandedBadge === 'risk' ? null : 'risk')}>
              <ScoreBadge label="Risk" score={riskScore.score} max={100}
                sublabel={riskScore.label} />
              <ChevronDown size={8} className={`text-[#475569] transition-transform ${expandedBadge === 'risk' ? 'rotate-180' : ''}`} />
            </div>
            {expandedBadge === 'risk' && riskScore.signals.length > 0 && (
              <div className="mt-1 px-2 py-1.5 bg-[#0a1628] rounded border border-[#1e293b] space-y-0.5">
                {riskScore.signals.map(s => (
                  <BreakdownRow key={s.name} label={s.name} val={s.points} max={s.maxPoints} passed={s.passed} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Instrument display */}
        <div className="bg-[#060d1a] border border-[#1e3a5f] rounded px-3 py-2 text-[#38bdf8] text-xs font-semibold">
          NIFTY {strike} {optionType} — {chain?.expiry ? formatExpiry(chain.expiry) : '—'}
        </div>

        {/* CE / PE toggle */}
        <div className="flex rounded overflow-hidden border border-[#1e3a5f]">
          {(['CE', 'PE'] as const).map(t => (
            <button key={t} onClick={() => setOptionType(t)}
              className={cn('flex-1 py-1.5 text-xs font-bold transition-colors',
                optionType === t
                  ? t === 'CE' ? 'bg-[#22c55e] text-black' : 'bg-[#ef4444] text-white'
                  : 'bg-transparent text-[#475569] hover:text-white'
              )}>
              {t}
            </button>
          ))}
        </div>

        {/* Qty */}
        <div>
          <div className="text-[#64748b] text-[9px] mb-1">Qty (Lots)</div>
          <div className="flex items-center bg-[#060d1a] border border-[#1e3a5f] rounded">
            <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-2 py-1.5 text-[#64748b] hover:text-white"><Minus size={10} /></button>
            <span className="flex-1 text-center text-white font-bold text-sm">{quantity}</span>
            <button onClick={() => setQuantity(quantity + 1)} className="px-2 py-1.5 text-[#64748b] hover:text-white"><Plus size={10} /></button>
          </div>
          <div className="text-[9px] text-[#475569] mt-0.5">{quantity * 65} shares · 1 lot = 65</div>
        </div>

        {/* Limit Price + SL */}
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="text-[#38bdf8] text-[9px] mb-1">Limit Price ₹</div>
            <input type="number" value={limitPrice || premium || ''}
              onChange={e => setLimitPrice(Number(e.target.value))}
              className="w-full bg-[#060d1a] border border-[#1e3a5f] rounded px-2 py-1.5 text-white text-xs"
              placeholder="0.00" />
          </div>
          <div className="flex-1">
            <div className="text-[#ef4444] text-[9px] mb-1">Stop Loss ₹</div>
            <input type="number" value={stopLoss || ''}
              onChange={e => setStopLoss(Number(e.target.value))}
              className="w-full bg-[#060d1a] border border-[#ef4444]/40 rounded px-2 py-1.5 text-white text-xs"
              placeholder="0.00" />
          </div>
        </div>

        {/* Premium + R:R summary */}
        <div className="bg-[#132036] rounded px-3 py-2 flex justify-between items-center">
          <div>
            <span className="text-[#64748b] text-[9px]">Premium</span>
            <span className="ml-2 text-[#38bdf8] text-base font-bold">₹{premium.toFixed(2)}</span>
          </div>
          <div className="text-right">
            <span className="text-[#64748b] text-[9px]">R:R</span>
            <span className="ml-2 text-xs font-bold" style={{ color: rrColor }}>{rrLabel}</span>
          </div>
        </div>

        {/* RR gate warning */}
        {rr !== null && rr < MIN_RR && (
          <div className="flex items-center gap-1.5 bg-[#2b1000] border border-[#ef4444]/50 rounded px-2 py-1.5">
            <AlertTriangle size={11} className="text-[#ef4444] shrink-0" />
            <span className="text-[9px] text-[#ef4444]">
              R:R {rrLabel} below minimum 1.5:1. Adjust target or stop loss.
            </span>
          </div>
        )}

        {/* Discipline lock banner */}
        {(isLocked || !canTrade.allowed) && (
          <div className="mx-2 mb-2 px-3 py-2 rounded bg-[#ef4444]/10 border border-[#ef4444]/30 text-[9px] text-[#ef4444] leading-relaxed">
            🔒 {lockReason || canTrade.reason || 'Trading locked by discipline rules'}
          </div>
        )}
        {/* Discipline warning banner */}
        {!isLocked && canTrade.allowed && canTrade.warning && (
          <div className="mx-2 mb-2 px-3 py-2 rounded bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[9px] text-[#f59e0b] leading-relaxed">
            ⚠️ {canTrade.warning}
          </div>
        )}

        {/* BUY button */}
        <button
          onClick={() => { setIsSubmitting(true); mutation.mutate() }}
          disabled={!canPlace}
          className={cn(
            'w-full font-bold py-3 rounded text-sm transition-colors flex items-center justify-center gap-2',
            canPlace
              ? 'bg-[#22c55e] text-black hover:bg-[#16a34a]'
              : 'bg-[#1a2a1a] text-[#4a6a4a] cursor-not-allowed'
          )}
        >
          <Zap size={14} />
          {mutation.isPending ? 'Placing…' : `BUY ${optionType} MIS LIMIT`}
        </button>

        {toastVisible && lastOrderMessage && (
          <div className="bg-[#0d2b0d] border border-[#22c55e] rounded p-2 text-[#22c55e] text-[10px]">
            ✓ {lastOrderMessage}
          </div>
        )}

        {orderError && (
          <div className="flex items-start gap-1.5 bg-[#2b0d0d] border border-[#ef4444]/60 rounded px-2 py-2">
            <XCircle size={11} className="text-[#ef4444] mt-0.5 shrink-0" />
            <span className="text-[9px] text-[#ef4444]">{orderError}</span>
          </div>
        )}
      </div>
    </div>
  )
}
