import { useMarketStore } from '@/core/store'
import { SectionCard } from '@/components/SectionCard'
import { getStrengthColor } from '@/core/utils/tradeStrength'

const tooltip = {
  title: 'Trade Strength Engine',
  what: 'A composite score (0–100) built from 8 market signals weighted by importance.',
  why: 'Prevents entering trades when market conditions are unfavorable. Only trade when conviction is high.',
  how: 'Score above 60 = consider entry. Above 80 = high conviction setup. Below 40 = wait.',
  bullish: 'Score 70+ with EMA aligned + above VWAP + PCR > 1.2 = ideal CE entry.',
  bearish: 'Score 70+ but trend bearish = ideal PE entry. Direction matters, not just score.',
}

export function TradeStrength() {
  const ts = useMarketStore(s => s.tradeStrength)
  if (!ts) return null

  const color = getStrengthColor(ts.label)
  const labelText: Record<string, string> = {
    'weak': 'Weak', 'moderate': 'Moderate', 'strong': 'Strong', 'high-conviction': 'High Conviction'
  }

  // SVG arc gauge
  const r = 26
  const circ = 2 * Math.PI * r
  const arc = (ts.score / 100) * circ * 0.75 // 270° sweep
  const offset = circ * 0.25

  return (
    <SectionCard title="Trade Strength" tooltip={tooltip}>
      <div className="flex items-center gap-3 mb-2">
        {/* Gauge */}
        <div className="relative w-16 h-16 flex-shrink-0">
          <svg viewBox="0 0 60 60" className="w-full h-full" style={{ transform: 'rotate(135deg)' }}>
            <circle cx="30" cy="30" r={r} fill="none" stroke="#1e293b" strokeWidth="7"
              strokeDasharray={`${circ * 0.75} ${circ * 0.25}`} strokeLinecap="round" />
            <circle cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="7"
              strokeDasharray={`${arc} ${circ - arc}`}
              strokeDashoffset={-offset} strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.5s ease' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: 4 }}>
            <span className="text-white font-bold text-sm leading-none">{ts.score}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm" style={{ color }}>{labelText[ts.label]}</div>
          <div className="text-[#64748b] text-[10px]">Confidence: {ts.confidence}%</div>
          <div className="mt-1 h-1 bg-[#1e293b] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${ts.score}%`, background: color }} />
          </div>
        </div>
      </div>

      {/* Signal rows */}
      <div className="space-y-1">
        {ts.signals.slice(0, 5).map(s => (
          <div key={s.name} className="flex justify-between items-center">
            <span className="text-[#64748b] text-[9px]">{s.name}</span>
            <span className={`text-[9px] font-medium ${s.passed ? 'text-[#22c55e]' : 'text-[#475569]'}`}>
              {s.passed ? '✓' : '○'} {s.value}
            </span>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
