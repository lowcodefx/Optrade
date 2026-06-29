import type { PriceActionSetup } from '@/core/types'
import { useOrderStore } from '@/core/store'
import { formatNumber } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'

interface Props {
  setup: PriceActionSetup
  onDismiss: () => void
}

export function SetupPanel({ setup, onDismiss }: Props) {
  const applySetup = useOrderStore(s => s.applySetup)

  function handleUse() {
    applySetup(
      Math.round(setup.entry / 50) * 50,
      setup.direction === 'bullish' ? 'CE' : 'PE',
      setup.optionSL,
      setup.optionTarget,
      setup.optionEntry,
    )
  }

  // Counter-trend or neutral — show a warning instead of a tradeable setup
  if (setup.direction === 'neutral' || setup.isCounterTrend) {
    const topPattern = setup.patterns[0]
    return (
      <div className="border-t border-[#1e293b] bg-[#060d1a] p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle size={13} className="text-[#f59e0b] mt-0.5 shrink-0" />
          <div>
            <div className="text-[#f59e0b] text-[10px] font-bold mb-0.5">
              Counter-trend signal — no setup generated
            </div>
            <div className="text-[#64748b] text-[9px]">
              {topPattern ? `Pattern detected: ${topPattern.label}. ` : ''}
              This signal opposes the current market bias (PE score significantly higher). Trading counter-trend setups is high risk — wait for the market bias to change or skip this trade.
            </div>
          </div>
          <button onClick={onDismiss} className="ml-auto text-[#475569] text-[9px] border border-[#334155] px-2 py-0.5 rounded hover:text-white transition-colors shrink-0">
            Dismiss
          </button>
        </div>
      </div>
    )
  }

  const dirColor = setup.direction === 'bullish' ? '#22c55e' : '#ef4444'
  const dirLabel = setup.direction === 'bullish' ? '▲ BULLISH SETUP' : '▼ BEARISH SETUP'
  const topPattern = setup.patterns[0]

  return (
    <div className="border-t border-[#1e293b] bg-[#060d1a] p-3">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-[9px] font-bold px-2 py-0.5 rounded border" style={{ color: dirColor, borderColor: dirColor, background: setup.direction === 'bullish' ? '#0d2b0d' : '#2d0a0a' }}>
          {dirLabel}
        </span>
        {topPattern && <span className="text-[#a78bfa] text-[9px] border border-[#7c3aed] px-2 py-0.5 rounded bg-[#1a1035]">{topPattern.label}</span>}
        <span className="text-[#64748b] text-[10px]">Confidence: <span style={{ color: dirColor }}>{setup.confidence}%</span></span>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-2">
        {[
          { label: 'Entry (NIFTY)', value: formatNumber(setup.entry, 0), sub: `Option: ₹${setup.optionEntry}`, color: '#22c55e', border: '#22c55e' },
          { label: 'Stop Loss',    value: formatNumber(setup.sl, 0),    sub: `Option SL: ₹${setup.optionSL}`,    color: '#ef4444', border: '#ef4444' },
          { label: 'Target',       value: formatNumber(setup.target, 0), sub: `Option TGT: ₹${setup.optionTarget}`, color: '#38bdf8', border: '#38bdf8' },
          { label: 'Risk : Reward', value: `1 : ${setup.rr}`, sub: `Risk ₹1,500 → ₹${Math.round(1500 * setup.rr)}`, color: '#a855f7', border: '#a855f7' },
        ].map(card => (
          <div key={card.label} className="bg-[#0a1628] rounded p-2" style={{ borderLeft: `2px solid ${card.border}` }}>
            <div className="text-[#64748b] text-[8px] uppercase tracking-wider mb-0.5">{card.label}</div>
            <div className="font-bold text-xs" style={{ color: card.color }}>{card.value}</div>
            <div className="text-[#64748b] text-[9px] mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleUse}
          className="text-xs font-bold px-3 py-1.5 rounded transition-colors"
          style={{ background: dirColor, color: setup.direction === 'bullish' ? '#000' : '#fff' }}
        >
          ⚡ Use This Setup in Order Entry
        </button>
        <button onClick={onDismiss} className="text-[#64748b] text-xs border border-[#334155] px-3 py-1.5 rounded hover:text-white transition-colors">
          Dismiss
        </button>
        <div className="ml-auto bg-[#132036] border border-[#1e3a5f] text-[#38bdf8] text-[10px] px-2 py-1 rounded">
          Suggested: 1 Lot (75 qty) · MIS
        </div>
      </div>
    </div>
  )
}
