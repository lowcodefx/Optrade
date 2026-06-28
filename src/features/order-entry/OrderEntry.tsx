import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrderStore, useMarketStore } from '@/core/store'
import { tradingService } from '@/core/services/tradingService'
import { InfoTooltip } from '@/components/InfoTooltip'
import { cn } from '@/lib/utils'
import { Minus, Plus, Zap, AlertTriangle } from 'lucide-react'

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
  why: 'MIS ensures intraday square-off. LIMIT gives price control. SL of entry−20 limits max loss per lot.',
  how: 'Select an option from the chain above, set a target, verify R:R ≥ 1.5, then click BUY.',
  bullish: 'Buy CE when score > 600 and prediction is BULLISH.',
  bearish: 'Buy PE when score > 600 and prediction is BEARISH.',
}

export function OrderEntry() {
  const qc = useQueryClient()
  const chain = useMarketStore(s => s.optionChain)
  const noTradeReason = useMarketStore(s => s.noTradeReason)
  const {
    strike, optionType, quantity, limitPrice, stopLoss,
    setOptionType, setQuantity, setStopLoss, setLimitPrice,
    lastOrderMessage, setLastOrderMessage, setIsSubmitting,
  } = useOrderStore()

  const [targetPrice, setTargetPrice] = useState<number>(0)
  const [toastVisible, setToastVisible] = useState(false)

  const currentStrikeData = chain?.strikes.find(s => s.strike === strike)
  const premium = currentStrikeData ? currentStrikeData[optionType === 'CE' ? 'ce' : 'pe'].ltp : limitPrice

  // ── Risk / Reward ─────────────────────────────────────────────────────────
  const entry = limitPrice || premium
  const risk   = stopLoss && entry ? entry - stopLoss : null
  const reward = targetPrice && entry ? targetPrice - entry : null

  // Auto-set default target at 2:1 when entry and SL are both known
  const autoTarget = risk && risk > 0 ? entry + risk * 2 : 0

  const displayTarget = targetPrice || autoTarget
  const rr = risk && risk > 0 && displayTarget ? (displayTarget - entry) / risk : null
  const rrOk = rr === null || rr >= MIN_RR
  const rrLabel = rr !== null ? `${rr.toFixed(1)}:1` : '—'
  const rrColor = rr === null ? '#64748b' : rr >= 2 ? '#22c55e' : rr >= MIN_RR ? '#f59e0b' : '#ef4444'

  const mutation = useMutation({
    mutationFn: () => tradingService.placeOrder({
      symbol: 'NIFTY',
      strike,
      optionType,
      expiry: chain?.expiry ?? '',
      quantity: quantity * 75,
      orderType: 'LIMIT',
      productType: 'MIS',
      price: limitPrice || premium,
      stopLoss: stopLoss || undefined,
    }),
    onSuccess: (res) => {
      setLastOrderMessage(res.message)
      setToastVisible(true)
      qc.invalidateQueries({ queryKey: ['positions'] })
      setTimeout(() => setToastVisible(false), 4000)
    },
    onSettled: () => setIsSubmitting(false),
  })

  const canPlace = rrOk && !mutation.isPending

  return (
    <div className="flex flex-col border-b border-[#1e293b]">
      <div className="flex items-center gap-1 px-3 pt-2.5 pb-2">
        <span className="text-[9px] text-[#64748b] uppercase tracking-widest font-medium">Order Entry</span>
        <InfoTooltip content={tooltip} />
        <span className="ml-auto text-[9px] font-bold text-[#38bdf8] bg-[#0f1f35] px-1.5 py-0.5 rounded">MIS · LIMIT</span>
      </div>

      <div className="px-3 pb-3 space-y-2">
        {/* NO TRADE banner */}
        {noTradeReason && (
          <div className="flex items-start gap-1.5 bg-[#1a1000] border border-[#f59e0b]/50 rounded px-2 py-2">
            <AlertTriangle size={11} className="text-[#f59e0b] mt-0.5 shrink-0" />
            <div className="text-[9px] text-[#f59e0b] leading-relaxed">
              <span className="font-bold">NO TRADE: </span>{noTradeReason}
            </div>
          </div>
        )}

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
          <div className="text-[9px] text-[#475569] mt-0.5">{quantity * 75} shares · 1 lot = 75</div>
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
            <div className="text-[#ef4444] text-[9px] mb-1">Stop Loss ₹ <span className="text-[#475569]">(entry−20)</span></div>
            <input type="number" value={stopLoss || ''}
              onChange={e => setStopLoss(Number(e.target.value))}
              className="w-full bg-[#060d1a] border border-[#ef4444]/40 rounded px-2 py-1.5 text-white text-xs"
              placeholder="0.00" />
          </div>
        </div>

        {/* Target Price */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-[#22c55e] text-[9px]">Target ₹</div>
            {autoTarget > 0 && !targetPrice && (
              <button onClick={() => setTargetPrice(parseFloat(autoTarget.toFixed(2)))}
                className="text-[8px] text-[#64748b] hover:text-[#38bdf8] transition-colors">
                Auto (2:1) → {autoTarget.toFixed(2)}
              </button>
            )}
          </div>
          <input type="number" value={targetPrice || ''}
            onChange={e => setTargetPrice(Number(e.target.value))}
            className="w-full bg-[#060d1a] border border-[#22c55e]/40 rounded px-2 py-1.5 text-white text-xs"
            placeholder={autoTarget > 0 ? `${autoTarget.toFixed(2)} (2:1 default)` : '0.00'} />
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
              R:R {rrLabel} is below minimum 1.5:1. Adjust your target or stop loss.
            </span>
          </div>
        )}

        {/* BUY button */}
        <button
          onClick={() => { setIsSubmitting(true); mutation.mutate() }}
          disabled={!canPlace}
          title={!rrOk ? `R:R ${rrLabel} below minimum 1.5:1` : undefined}
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

        {/* Toast */}
        {toastVisible && lastOrderMessage && (
          <div className="bg-[#0d2b0d] border border-[#22c55e] rounded p-2 text-[#22c55e] text-[10px]">
            ✓ {lastOrderMessage}
          </div>
        )}
      </div>
    </div>
  )
}
