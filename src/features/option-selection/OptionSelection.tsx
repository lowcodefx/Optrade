import { useMarketStore, useOrderStore } from '@/core/store'
import { SectionCard } from '@/components/SectionCard'
import type { OptionStrike } from '@/core/types'

const tooltip = {
  title: 'Smart Option Selection',
  what: 'Automatically ranks and recommends the best options to buy based on volume, OI, momentum, and delta.',
  why: 'Not all options are equal. Best buy = high volume + OI building + favorable delta + momentum alignment.',
  how: 'Click any card to auto-fill the Order Entry panel. Green border = best setup right now.',
  bullish: 'High delta CE (0.4-0.6) with volume surge and OI addition = best CE buy candidate.',
  bearish: 'High delta PE (-0.4 to -0.6) with volume surge and OI addition = best PE buy candidate.',
}

type Rec = 'best' | 'moderate' | 'avoid'

function score(strike: OptionStrike, side: 'ce' | 'pe', atmStrike: number): Rec {
  const data = strike[side]
  const distFromATM = Math.abs(strike.strike - atmStrike) / 50
  const deltaOk = side === 'ce' ? (data.delta >= 0.35 && data.delta <= 0.65) : (data.delta <= -0.35 && data.delta >= -0.65)
  const volOk = data.volume > 50000
  const oiAdding = data.oiChange > 0
  const pts = (deltaOk ? 2 : 0) + (volOk ? 2 : 0) + (oiAdding ? 1 : 0) - distFromATM
  if (pts >= 4) return 'best'
  if (pts >= 2) return 'moderate'
  return 'avoid'
}

interface CardProps { strike: OptionStrike; side: 'ce' | 'pe'; rec: Rec }

function OptionCard({ strike, side, rec }: CardProps) {
  const setStrike = useOrderStore(s => s.setStrike)
  const data = strike[side]
  const borderColor = rec === 'best' ? '#22c55e' : rec === 'moderate' ? '#f59e0b' : '#334155'
  const recLabel = rec === 'best' ? '★ Best Buy' : rec === 'moderate' ? '◆ Moderate' : '✗ Avoid'
  const recColor = rec === 'best' ? 'text-[#22c55e]' : rec === 'moderate' ? 'text-[#f59e0b]' : 'text-[#475569]'

  return (
    <div
      className="bg-[#0a1628] rounded p-2 cursor-pointer hover:bg-[#0f1f35] transition-colors"
      style={{ border: `1px solid ${borderColor}` }}
      onClick={() => setStrike(strike.strike, side.toUpperCase() as 'CE' | 'PE', data.ltp)}
    >
      <div className={`text-[9px] font-bold mb-1 ${recColor}`}>{recLabel}</div>
      <div className="text-white text-xs font-bold">{strike.strike} {side.toUpperCase()}</div>
      <div className="text-[#38bdf8] text-sm font-bold">₹{data.ltp.toFixed(2)}</div>
      <div className="grid grid-cols-2 gap-x-2 mt-1.5 text-[9px] text-[#64748b]">
        <span>Δ {data.delta.toFixed(2)}</span>
        <span>Γ {data.gamma.toFixed(3)}</span>
        <span>θ {data.theta.toFixed(1)}</span>
        <span>IV {data.iv}%</span>
      </div>
    </div>
  )
}

export function OptionSelection() {
  const chain = useMarketStore(s => s.optionChain)
  if (!chain) return null

  const atm = chain.strikes.find(s => s.strike === chain.atmStrike)
  const atmPlus1 = chain.strikes.find(s => s.strike === chain.atmStrike + 50)
  const atmMinus1 = chain.strikes.find(s => s.strike === chain.atmStrike - 50)

  const candidates = [
    ...(atm ? [{ strike: atm, side: 'ce' as const }, { strike: atm, side: 'pe' as const }] : []),
    ...(atmPlus1 ? [{ strike: atmPlus1, side: 'ce' as const }] : []),
    ...(atmMinus1 ? [{ strike: atmMinus1, side: 'pe' as const }] : []),
  ]

  return (
    <SectionCard title="Smart Option Selection" tooltip={tooltip}>
      <div className="grid grid-cols-2 gap-2">
        {candidates.map(({ strike, side }) => (
          <OptionCard key={`${strike.strike}-${side}`} strike={strike} side={side} rec={score(strike, side, chain.atmStrike)} />
        ))}
      </div>
    </SectionCard>
  )
}
