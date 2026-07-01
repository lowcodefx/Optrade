import { useMarketStore, useOrderStore } from '@/core/store'
import { SectionCard } from '@/components/SectionCard'
import type { OptionStrike } from '@/core/types'

const tooltip = {
  title: 'Smart Option Selection',
  what: 'Suggests ATM and ITM options aligned with market prediction.',
  why: 'ATM/ITM options have higher delta (0.5–0.9) so they gain value faster on NIFTY moves.',
  how: 'Click any card to auto-fill Order Entry. CE options shown when BULLISH, PE when BEARISH.',
  bullish: 'ATM/ITM CE options move ₹0.50–₹0.90 per NIFTY point.',
  bearish: 'ATM/ITM PE options move ₹0.50–₹0.90 per NIFTY point.',
}

interface Candidate {
  strike: OptionStrike
  side: 'ce' | 'pe'
  label: string   // 'ATM' | '1 ITM' | '2 ITM' ...
  isATM: boolean
}

// Pick ATM + nearest ITM strikes for the given side.
// CE bullish: ATM strike + 3 strikes below spot (deeper ITM = higher premium)
// PE bearish: ATM strike + 3 strikes above spot
function buildCandidates(
  strikes: OptionStrike[],
  side: 'ce' | 'pe',
  atmStrike: number,
  count = 4,
): Candidate[] {
  // For CE: want strikes <= ATM (ATM, then increasingly ITM going down)
  // For PE: want strikes >= ATM (ATM, then increasingly ITM going up)
  const ordered = [...strikes]
    .filter(s => s[side].ltp >= 0) // include ltp=0 (illiquid) — still show the strike
    .sort((a, b) => side === 'ce'
      ? b.strike - a.strike  // descending: ATM first, then ITM
      : a.strike - b.strike  // ascending: ATM first, then ITM
    )

  // Keep only ATM + ITM side
  const candidates = ordered.filter(s =>
    side === 'ce' ? s.strike <= atmStrike + 50 : s.strike >= atmStrike - 50
  )

  return candidates.slice(0, count).map((s, idx) => {
    const isATM = s.strike === atmStrike || Math.abs(s.strike - atmStrike) <= 50
    const label = isATM && idx === 0 ? 'ATM' : `${idx + (isATM ? 0 : 1)} ITM`
    return { strike: s, side, label, isATM: idx === 0 && isATM }
  })
}

interface CardProps { c: Candidate }

function OptionCard({ c }: CardProps) {
  const setStrike = useOrderStore(s => s.setStrike)
  const { strike, side, label, isATM } = c
  const data = strike[side]
  const borderColor = isATM ? '#38bdf8' : '#a78bfa'
  const labelColor  = isATM ? 'text-[#38bdf8]' : 'text-[#a78bfa]'
  const hasLtp = data.ltp > 0

  return (
    <div
      className="bg-[#0a1628] rounded p-2 cursor-pointer hover:bg-[#0f1f35] transition-colors"
      style={{ border: `1px solid ${borderColor}` }}
      onClick={() => setStrike(strike.strike, side.toUpperCase() as 'CE' | 'PE', data.ltp)}
    >
      <div className={`text-[9px] font-bold mb-1 ${labelColor}`}>{label}</div>
      <div className="text-white text-xs font-bold">{strike.strike} {side.toUpperCase()}</div>
      <div className={`text-sm font-bold ${hasLtp ? 'text-[#38bdf8]' : 'text-[#475569]'}`}>
        {hasLtp ? `₹${data.ltp.toFixed(2)}` : 'No quote'}
      </div>
      <div className="grid grid-cols-2 gap-x-2 mt-1.5 text-[9px] text-[#64748b]">
        <span>Δ {data.delta.toFixed(2)}</span>
        <span>IV {data.iv}%</span>
        <span>SL ₹{Math.max(0, data.ltp - 20).toFixed(0)}</span>
        <span>OI {data.oiChange > 0 ? <span className="text-[#22c55e]">↑</span> : <span className="text-[#ef4444]">↓</span>}</span>
      </div>
    </div>
  )
}

export function OptionSelection() {
  const chain      = useMarketStore(s => s.optionChain)
  const quote      = useMarketStore(s => s.quote)
  const prediction = useMarketStore(s => s.prediction1h)
  if (!chain) return null

  const atmStrike = chain.atmStrike
  const spot      = quote?.spot ?? atmStrike

  let all: Candidate[]
  let hint: string
  let dirColor: string

  if (prediction === 'BULLISH') {
    all      = buildCandidates(chain.strikes, 'ce', atmStrike, 4)
    hint     = 'CE · ATM + ITM (BULLISH signal)'
    dirColor = '#22c55e'
  } else if (prediction === 'BEARISH') {
    all      = buildCandidates(chain.strikes, 'pe', atmStrike, 4)
    hint     = 'PE · ATM + ITM (BEARISH signal)'
    dirColor = '#ef4444'
  } else {
    all      = [...buildCandidates(chain.strikes, 'ce', atmStrike, 2),
                ...buildCandidates(chain.strikes, 'pe', atmStrike, 2)]
    hint     = 'CE + PE · ATM (no clear bias)'
    dirColor = '#f59e0b'
  }

  if (all.length === 0) return null

  const spotDisplay = spot > 0 ? `Spot ${spot.toFixed(0)}` : ''

  return (
    <SectionCard title="Smart Option Selection" tooltip={tooltip} collapsible defaultOpen={true}>
      <div className="text-[9px] mb-2" style={{ color: dirColor }}>
        {hint}
        {spotDisplay && <span className="text-[#475569] ml-1">· {spotDisplay} · ATM {atmStrike}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {all.map(c => (
          <OptionCard key={`${c.strike.strike}-${c.side}`} c={c} />
        ))}
      </div>
    </SectionCard>
  )
}
