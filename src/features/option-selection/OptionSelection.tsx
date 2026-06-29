import { useMarketStore, useOrderStore } from '@/core/store'
import { SectionCard } from '@/components/SectionCard'
import type { OptionStrike } from '@/core/types'

const tooltip = {
  title: 'Smart Option Selection',
  what: 'Recommends options with LTP in ₹180–200 range aligned with market prediction.',
  why: '₹180–200 options have the right delta balance: gain value quickly without excessive premium.',
  how: 'Click any card to auto-fill Order Entry. Shows CE options when BULLISH, PE when BEARISH.',
  bullish: 'Buy CE options in ₹180–200 range.',
  bearish: 'Buy PE options in ₹180–200 range.',
}

const TARGET = 190
const IDEAL_LOW = 180
const IDEAL_HIGH = 200

interface Candidate { strike: OptionStrike; side: 'ce' | 'pe'; dist: number; inRange: boolean }

function buildCandidates(strikes: OptionStrike[], side: 'ce' | 'pe', count = 4): Candidate[] {
  return strikes
    .map(s => {
      const ltp = s[side].ltp
      return { strike: s, side, dist: Math.abs(ltp - TARGET), inRange: ltp >= IDEAL_LOW && ltp <= IDEAL_HIGH }
    })
    .filter(c => c.strike[side].ltp > 0)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, count)
}

interface CardProps { c: Candidate }

function OptionCard({ c }: CardProps) {
  const setStrike = useOrderStore(s => s.setStrike)
  const { strike, side, inRange } = c
  const data = strike[side]
  const borderColor = inRange ? '#22c55e' : '#f59e0b'
  const label = inRange ? '★ Ideal Range' : '◆ Closest'
  const labelColor = inRange ? 'text-[#22c55e]' : 'text-[#f59e0b]'

  return (
    <div
      className="bg-[#0a1628] rounded p-2 cursor-pointer hover:bg-[#0f1f35] transition-colors"
      style={{ border: `1px solid ${borderColor}` }}
      onClick={() => setStrike(strike.strike, side.toUpperCase() as 'CE' | 'PE', data.ltp)}
    >
      <div className={`text-[9px] font-bold mb-1 ${labelColor}`}>{label}</div>
      <div className="text-white text-xs font-bold">{strike.strike} {side.toUpperCase()}</div>
      <div className="text-[#38bdf8] text-sm font-bold">₹{data.ltp.toFixed(2)}</div>
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
  const chain       = useMarketStore(s => s.optionChain)
  const prediction  = useMarketStore(s => s.prediction1h)
  if (!chain) return null

  // Align suggested options with the current market prediction
  let all: Candidate[]
  let hint: string

  if (prediction === 'BULLISH') {
    all  = buildCandidates(chain.strikes, 'ce', 4)
    hint = 'CE options (BULLISH signal)'
  } else if (prediction === 'BEARISH') {
    all  = buildCandidates(chain.strikes, 'pe', 4)
    hint = 'PE options (BEARISH signal)'
  } else {
    // NEUTRAL / SIDEWAYS / NO_TRADE — show 2 from each side
    all  = [...buildCandidates(chain.strikes, 'ce', 2), ...buildCandidates(chain.strikes, 'pe', 2)]
    hint = 'CE + PE (no clear bias)'
  }

  if (all.length === 0) return null

  return (
    <SectionCard title="Smart Option Selection" tooltip={tooltip} collapsible defaultOpen={true}>
      <div className="text-[9px] text-[#475569] mb-2">
        Closest to ₹{TARGET} LTP (ideal ₹{IDEAL_LOW}–{IDEAL_HIGH}) · {hint}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {all.map(c => (
          <OptionCard key={`${c.strike.strike}-${c.side}`} c={c} />
        ))}
      </div>
    </SectionCard>
  )
}
