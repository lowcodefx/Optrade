import { X } from 'lucide-react'

interface Props { onClose: () => void }

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className={`border ${color} rounded-lg p-4`}>
      <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: color.includes('green') ? '#22c55e' : color.includes('red') ? '#ef4444' : color.includes('yellow') ? '#f59e0b' : '#38bdf8' }}>{title}</h3>
      {children}
    </div>
  )
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1.5 border-b border-[#1e293b]/60 last:border-0">
      <span className="text-[#94a3b8] text-[10px] min-w-0">{label}</span>
      <div className="text-right shrink-0">
        <span className="text-white text-[10px] font-semibold">{value}</span>
        {note && <div className="text-[9px] text-[#475569]">{note}</div>}
      </div>
    </div>
  )
}

function Check({ ok, text }: { ok?: boolean; text: string }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <span className={`text-[11px] mt-0.5 shrink-0 ${ok ? 'text-[#22c55e]' : 'text-[#475569]'}`}>✓</span>
      <span className="text-[#94a3b8] text-[10px]">{text}</span>
    </div>
  )
}

export function TradingPlaybook({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-[#0a1628] border border-[#1e293b] rounded-xl w-full max-w-2xl my-4 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e293b]">
          <div>
            <h2 className="text-white font-bold text-base">Trading Playbook</h2>
            <p className="text-[#475569] text-[10px] mt-0.5">NIFTY Options · MIS · Intraday only</p>
          </div>
          <button onClick={onClose} className="text-[#475569] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Pre-trade checklist */}
          <Section title="Before Opening Any Trade" color="border-[#38bdf8]/30">
            <div className="grid grid-cols-2 gap-x-6">
              <div>
                <div className="text-[9px] text-[#38bdf8] uppercase font-bold mb-1">Market Conditions</div>
                <Check text="Time is 9:30am – 2:45pm (avoid first 15 min & last 30 min)" />
                <Check text="VIX is below 20 (avoid high volatility days)" />
                <Check text="No major news / RBI / global event in next 30 min" />
                <Check text="NIFTY is trending, not choppy (ADX > 20)" />
              </div>
              <div>
                <div className="text-[9px] text-[#38bdf8] uppercase font-bold mb-1">Discipline Rules</div>
                <Check text="Daily loss limit not hit" />
                <Check text="Less than 5 trades today" />
                <Check text="Less than 2 consecutive losses" />
                <Check text="Trade Strength panel shows Green / High Conviction" />
              </div>
            </div>
          </Section>

          {/* CE Buy Setup */}
          <Section title="⬆ BUY CE — Bullish Setup" color="border-[#22c55e]/40">
            <div className="grid grid-cols-2 gap-x-6">
              <div>
                <Row label="CE Score" value="> 650" note="Strong: >700 · Moderate: 600–650" />
                <Row label="1h Prediction" value="BULLISH" />
                <Row label="Spot vs VWAP" value="Spot ABOVE VWAP" />
                <Row label="EMA Stack" value="EMA9 > EMA20 > EMA50" note="All three aligned up" />
              </div>
              <div>
                <Row label="RSI" value="> 55" note="Momentum confirming up" />
                <Row label="ADX" value="> 20" note="Trend is active, not ranging" />
                <Row label="PCR" value="> 1.0" note="> 1.2 = strong bull signal" />
                <Row label="N50 Breadth" value="> 60% stocks bullish" note="More stocks participating = safer" />
              </div>
            </div>
            <div className="mt-2 bg-[#0d2b0d] rounded p-2 text-[10px] text-[#22c55e]">
              Ideal entry: All 8 conditions met. Minimum: CE Score &gt; 600 + Spot above VWAP + EMA aligned.
            </div>
          </Section>

          {/* PE Buy Setup */}
          <Section title="⬇ BUY PE — Bearish Setup" color="border-[#ef4444]/40">
            <div className="grid grid-cols-2 gap-x-6">
              <div>
                <Row label="PE Score" value="> 650" note="Strong: >700 · Moderate: 600–650" />
                <Row label="1h Prediction" value="BEARISH" />
                <Row label="Spot vs VWAP" value="Spot BELOW VWAP" />
                <Row label="EMA Stack" value="EMA9 < EMA20 < EMA50" note="All three aligned down" />
              </div>
              <div>
                <Row label="RSI" value="< 45" note="Momentum confirming down" />
                <Row label="ADX" value="> 20" note="Trend is active" />
                <Row label="PCR" value="< 0.9" note="< 0.8 = strong bear signal" />
                <Row label="N50 Breadth" value="< 40% stocks bullish" note="Broad selling = safer PE" />
              </div>
            </div>
            <div className="mt-2 bg-[#2b0d0d] rounded p-2 text-[10px] text-[#ef4444]">
              Ideal entry: All 8 conditions met. Minimum: PE Score &gt; 600 + Spot below VWAP + EMA aligned.
            </div>
          </Section>

          {/* Option to pick */}
          <Section title="Which Option to Pick" color="border-[#f59e0b]/30">
            <Row label="LTP Range" value="₹180 – ₹200" note="Use Smart Option Selection panel — it picks automatically" />
            <Row label="Strike type" value="ATM or 1 ITM" note="Avoids low-delta OTM options" />
            <Row label="Delta" value="0.40 – 0.60" note="Higher delta = moves more with NIFTY" />
            <Row label="OI Change" value="Positive (↑)" note="Rising OI = fresh positions building" />
            <Row label="Volume" value="High" note="Liquid option = easy exit" />
          </Section>

          {/* Order & SL Rules */}
          <Section title="Order Rules (Non-Negotiable)" color="border-[#a855f7]/30">
            <Row label="Order Type" value="LIMIT always" note="Never market order for options" />
            <Row label="Product" value="MIS only" note="Auto square-off at 3:15pm" />
            <Row label="Stop Loss" value="Entry − ₹20 per unit" note="Hardcoded, do not remove" />
            <Row label="Quantity" value="Start with 1 lot (50 shares)" note="Scale up only after 3 consecutive wins" />
            <Row label="Target" value="Entry + ₹40–60" note="2:1 to 3:1 reward:risk minimum" />
          </Section>

          {/* Trade Management */}
          <Section title="During the Trade" color="border-[#38bdf8]/30">
            <Check text="If trade moves +₹20 in your favour → move SL to entry (break-even)" />
            <Check text="If trade moves +₹40 → trail SL to entry + ₹20 (lock in profit)" />
            <Check text="Exit fully at target. Don't hold for more unless score is still > 700." />
            <Check text="If SL is hit → DO NOT re-enter the same direction within 15 minutes." />
            <Check text="If 2 consecutive SLs hit → stop trading for the day." />
          </Section>

          {/* Avoid */}
          <Section title="⚠ Never Trade When…" color="border-[#f59e0b]/40">
            <div className="grid grid-cols-2 gap-x-6">
              <div>
                <Check text="VIX > 20 (market unpredictable)" />
                <Check text="CE and PE score both < 500 (no clear bias)" />
                <Check text="Prediction = SIDEWAYS or NEUTRAL" />
                <Check text="ADX < 15 (no trend, just chop)" />
              </div>
              <div>
                <Check text="PCR between 0.9–1.1 (range-bound, no conviction)" />
                <Check text="Daily loss limit already at 50%+" />
                <Check text="Time is after 2:45pm (square-off risk)" />
                <Check text="Breadth < 30% or > 70% (extreme — possible reversal)" />
              </div>
            </div>
          </Section>

          {/* Score Reference */}
          <Section title="Score Reference (out of 1000)" color="border-[#475569]/40">
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { range: '700–1000', label: 'Strong Signal', color: 'text-[#22c55e]', bg: 'bg-[#0d2b0d]' },
                { range: '600–699', label: 'Moderate', color: 'text-[#f59e0b]', bg: 'bg-[#1a1200]' },
                { range: '400–599', label: 'Weak / Wait', color: 'text-[#475569]', bg: 'bg-[#0f1f35]' },
                { range: '0–399', label: 'No Trade', color: 'text-[#ef4444]', bg: 'bg-[#2b0d0d]' },
              ].map(({ range, label, color, bg }) => (
                <div key={range} className={`${bg} rounded p-2`}>
                  <div className={`${color} text-xs font-bold`}>{range}</div>
                  <div className={`${color} text-[9px] mt-0.5`}>{label}</div>
                </div>
              ))}
            </div>
          </Section>

          <div className="text-center text-[9px] text-[#334155] pt-1">
            Follow the plan. Protect capital. One good trade is better than five bad ones.
          </div>

        </div>
      </div>
    </div>
  )
}
