import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrderStore, useMarketStore } from '@/core/store'
import { tradingService } from '@/core/services/tradingService'
import { useRiskCalc } from '@/core/hooks/useRiskCalc'
import { InfoTooltip } from '@/components/InfoTooltip'
import { cn } from '@/lib/utils'
import { Minus, Plus } from 'lucide-react'

const tooltip = {
  title: 'Order Entry',
  what: 'Place buy orders for NIFTY options. Supports Market and Limit orders with optional Stop Loss and Target.',
  why: 'Fast, one-click order placement during fast-moving markets. SL and Target auto-filled from PA Analyser.',
  how: 'Select an option from the chain or option selection panel, set quantity, choose order type, and click Buy.',
  bullish: 'Buy CE when Trade Strength > 60 and setup is bullish. Always set a Stop Loss.',
  bearish: 'Buy PE when Trade Strength > 60 and setup is bearish. Always set a Stop Loss.',
}

export function OrderEntry() {
  const qc = useQueryClient()
  const chain = useMarketStore(s => s.optionChain)
  const {
    strike, optionType, quantity, orderType, productType, limitPrice,
    stopLoss, target, showSL, showTarget,
    setOptionType, setQuantity, setOrderType, setProductType, setStopLoss, setTarget,
    setShowSL, setShowTarget, lastOrderMessage, setLastOrderMessage,
  } = useOrderStore()

  // Find current premium from option chain
  const currentStrikeData = chain?.strikes.find(s => s.strike === strike)
  const premium = currentStrikeData ? currentStrikeData[optionType === 'CE' ? 'ce' : 'pe'].ltp : limitPrice
  const risk = useRiskCalc(premium, showSL ? stopLoss : undefined)
  const [toastVisible, setToastVisible] = useState(false)

  const mutation = useMutation({
    mutationFn: () => tradingService.placeOrder({
      symbol: 'NIFTY',
      strike,
      optionType,
      expiry: chain?.expiry ?? '26 Jun 2025',
      quantity: quantity * 50,
      orderType,
      productType,
      price: orderType === 'LIMIT' ? limitPrice : undefined,
      stopLoss: showSL ? stopLoss : undefined,
      target: showTarget ? target : undefined,
    }),
    onSuccess: (res) => {
      setLastOrderMessage(res.message)
      setToastVisible(true)
      qc.invalidateQueries({ queryKey: ['positions'] })
      setTimeout(() => setToastVisible(false), 4000)
    },
  })

  function handleBuy(mode: 'simple' | 'sl' | 'sl-tgt') {
    if (mode === 'simple') { setShowSL(false); setShowTarget(false) }
    if (mode === 'sl') { setShowSL(true); setShowTarget(false) }
    if (mode === 'sl-tgt') { setShowSL(true); setShowTarget(true) }
    mutation.mutate()
  }

  return (
    <div className="flex flex-col border-b border-[#1e293b]">
      <div className="flex items-center gap-1 px-3 pt-2.5 pb-2">
        <span className="text-[9px] text-[#64748b] uppercase tracking-widest font-medium">Order Entry</span>
        <InfoTooltip content={tooltip} />
      </div>

      <div className="px-3 pb-3 space-y-2">
        {/* Instrument display */}
        <div className="bg-[#060d1a] border border-[#1e3a5f] rounded px-3 py-2 text-[#38bdf8] text-xs font-semibold">
          NIFTY {strike} {optionType} — {chain?.expiry ?? '—'}
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

        {/* Qty + Order Type */}
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="text-[#64748b] text-[9px] mb-1">Qty (Lots)</div>
            <div className="flex items-center bg-[#060d1a] border border-[#1e3a5f] rounded">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-2 py-1.5 text-[#64748b] hover:text-white"><Minus size={10} /></button>
              <span className="flex-1 text-center text-white font-bold text-sm">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="px-2 py-1.5 text-[#64748b] hover:text-white"><Plus size={10} /></button>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-[#64748b] text-[9px] mb-1">Order Type</div>
            <select value={orderType} onChange={e => setOrderType(e.target.value as 'MARKET' | 'LIMIT')}
              className="w-full bg-[#060d1a] border border-[#1e3a5f] rounded px-2 py-1.5 text-white text-xs appearance-none cursor-pointer">
              <option value="MARKET">Market</option>
              <option value="LIMIT">Limit</option>
            </select>
          </div>
        </div>

        {/* Product type */}
        <div className="flex rounded overflow-hidden border border-[#1e3a5f]">
          {(['MIS', 'NRML'] as const).map(t => (
            <button key={t} onClick={() => setProductType(t)}
              className={cn('flex-1 py-1 text-[10px] font-bold transition-colors',
                productType === t ? 'bg-[#1e3a5f] text-[#38bdf8]' : 'bg-transparent text-[#475569] hover:text-white'
              )}>
              {t}
            </button>
          ))}
        </div>

        {/* SL / Target inputs (conditional) */}
        {showSL && (
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="text-[#ef4444] text-[9px] mb-1">Stop Loss ₹</div>
              <input type="number" value={stopLoss || ''} onChange={e => setStopLoss(Number(e.target.value))}
                className="w-full bg-[#060d1a] border border-[#ef4444]/40 rounded px-2 py-1.5 text-white text-xs" placeholder="0.00" />
            </div>
            {showTarget && (
              <div className="flex-1">
                <div className="text-[#38bdf8] text-[9px] mb-1">Target ₹</div>
                <input type="number" value={target || ''} onChange={e => setTarget(Number(e.target.value))}
                  className="w-full bg-[#060d1a] border border-[#38bdf8]/40 rounded px-2 py-1.5 text-white text-xs" placeholder="0.00" />
              </div>
            )}
          </div>
        )}

        {/* Premium */}
        <div className="bg-[#132036] rounded px-3 py-2 flex justify-between items-center">
          <span className="text-[#64748b] text-[10px]">Premium</span>
          <span className="text-[#38bdf8] text-base font-bold">₹{premium.toFixed(2)}</span>
        </div>

        {/* Risk hint */}
        <div className="text-[9px] text-[#475569]">
          Suggested: {risk.suggestedLots} lot{risk.suggestedLots > 1 ? 's' : ''} · Risk ₹{risk.riskAmount}
        </div>

        {/* Buy buttons */}
        <div className="space-y-1.5">
          <button onClick={() => handleBuy('simple')} disabled={mutation.isPending}
            className="w-full bg-[#22c55e] text-black font-bold py-2.5 rounded text-sm hover:bg-[#16a34a] transition-colors disabled:opacity-50">
            {mutation.isPending ? 'Placing…' : '⚡ BUY'}
          </button>
          <button onClick={() => handleBuy('sl')}
            className="w-full bg-transparent border border-[#22c55e] text-[#22c55e] font-semibold py-2 rounded text-xs hover:bg-[#0d2b0d] transition-colors">
            BUY + STOP LOSS
          </button>
          <button onClick={() => handleBuy('sl-tgt')}
            className="w-full bg-transparent border border-[#22c55e] text-[#22c55e] font-semibold py-2 rounded text-xs hover:bg-[#0d2b0d] transition-colors">
            BUY + SL + TARGET
          </button>
        </div>

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
