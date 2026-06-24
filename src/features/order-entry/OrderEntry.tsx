import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrderStore, useMarketStore } from '@/core/store'
import { tradingService } from '@/core/services/tradingService'
import { InfoTooltip } from '@/components/InfoTooltip'
import { cn } from '@/lib/utils'
import { Minus, Plus, Zap } from 'lucide-react'

function formatExpiry(expiry: string): string {
  // Live chain returns YYYY-MM-DD; mock returns human-readable — handle both
  if (/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
    const d = new Date(expiry + 'T00:00:00')
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  return expiry
}

const tooltip = {
  title: 'Order Entry',
  what: 'Place MIS LIMIT orders for NIFTY options with auto Stop Loss.',
  why: 'MIS ensures intraday square-off. LIMIT gives price control. SL of entry−20 limits max loss per lot.',
  how: 'Select an option (₹180–200 range) from the panel above, adjust qty, and click BUY.',
  bullish: 'Buy CE when score > 600 and prediction is BULLISH.',
  bearish: 'Buy PE when score > 600 and prediction is BEARISH.',
}

export function OrderEntry() {
  const qc = useQueryClient()
  const chain = useMarketStore(s => s.optionChain)
  const {
    strike, optionType, quantity, limitPrice, stopLoss,
    setOptionType, setQuantity, setStopLoss, setLimitPrice,
    lastOrderMessage, setLastOrderMessage, setIsSubmitting,
  } = useOrderStore()

  const currentStrikeData = chain?.strikes.find(s => s.strike === strike)
  const premium = currentStrikeData ? currentStrikeData[optionType === 'CE' ? 'ce' : 'pe'].ltp : limitPrice

  const [toastVisible, setToastVisible] = useState(false)

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

  return (
    <div className="flex flex-col border-b border-[#1e293b]">
      <div className="flex items-center gap-1 px-3 pt-2.5 pb-2">
        <span className="text-[9px] text-[#64748b] uppercase tracking-widest font-medium">Order Entry</span>
        <InfoTooltip content={tooltip} />
        <span className="ml-auto text-[9px] font-bold text-[#38bdf8] bg-[#0f1f35] px-1.5 py-0.5 rounded">MIS · LIMIT</span>
      </div>

      <div className="px-3 pb-3 space-y-2">
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

        {/* Limit Price + SL side by side */}
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="text-[#38bdf8] text-[9px] mb-1">Limit Price ₹</div>
            <input
              type="number"
              value={limitPrice || premium || ''}
              onChange={e => setLimitPrice(Number(e.target.value))}
              className="w-full bg-[#060d1a] border border-[#1e3a5f] rounded px-2 py-1.5 text-white text-xs"
              placeholder="0.00"
            />
          </div>
          <div className="flex-1">
            <div className="text-[#ef4444] text-[9px] mb-1">Stop Loss ₹ <span className="text-[#475569]">(entry−20)</span></div>
            <input
              type="number"
              value={stopLoss || ''}
              onChange={e => setStopLoss(Number(e.target.value))}
              className="w-full bg-[#060d1a] border border-[#ef4444]/40 rounded px-2 py-1.5 text-white text-xs"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Premium summary */}
        <div className="bg-[#132036] rounded px-3 py-2 flex justify-between items-center">
          <div>
            <span className="text-[#64748b] text-[9px]">Premium</span>
            <span className="ml-2 text-[#38bdf8] text-base font-bold">₹{premium.toFixed(2)}</span>
          </div>
          <div className="text-right">
            <span className="text-[#64748b] text-[9px]">Max loss/lot</span>
            <span className="ml-2 text-[#ef4444] text-xs font-bold">
              ₹{stopLoss ? ((premium - stopLoss) * 75).toFixed(0) : '—'}
            </span>
          </div>
        </div>

        {/* Single BUY button */}
        <button
          onClick={() => { setIsSubmitting(true); mutation.mutate() }}
          disabled={mutation.isPending}
          className="w-full bg-[#22c55e] text-black font-bold py-3 rounded text-sm hover:bg-[#16a34a] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
