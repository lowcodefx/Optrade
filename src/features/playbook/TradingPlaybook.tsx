import { X } from 'lucide-react'

interface Props { onClose: () => void }

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  const textColor = color.includes('green') ? '#22c55e'
    : color.includes('red') ? '#ef4444'
    : color.includes('yellow') ? '#f59e0b'
    : color.includes('purple') ? '#a855f7'
    : '#38bdf8'
  return (
    <div className={`border ${color} rounded-lg p-4`}>
      <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: textColor }}>{title}</h3>
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

function Check({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-[11px] mt-0.5 shrink-0 text-[#475569]">✓</span>
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

          {/* 4-Score system explained */}
          <Section title="The 4-Score Decision System" color="border-[#38bdf8]/30">
            <div className="grid grid-cols-2 gap-3 mb-3">
              {[
                { name: 'Market Score', range: '/1000', desc: 'Macro bias — EMA, VWAP, RSI, OI, Structure, VIX, Breadth', threshold: '≥ 600 to trade', color: '#38bdf8' },
                { name: 'Trade Strength', range: '/100', desc: 'Confluence of trend signals — VWAP, EMA, PCR, Volume', threshold: '≥ 55 (green badge)', color: '#a855f7' },
                { name: 'Entry Quality', range: '/100', desc: 'Last candle setup — body, wick, ATR expansion, volume spike', threshold: '≥ 60 before entry', color: '#f59e0b' },
                { name: 'Risk Score', range: '/100', desc: 'Trade params — R:R, SL validity, room to level, time, OI', threshold: '≥ 60 before entry', color: '#22c55e' },
              ].map(s => (
                <div key={s.name} className="bg-[#060d1a] border border-[#1e293b] rounded p-2.5">
                  <div className="text-[10px] font-bold mb-0.5" style={{ color: s.color }}>{s.name} <span className="text-[#475569] font-normal">{s.range}</span></div>
                  <div className="text-[9px] text-[#64748b] mb-1">{s.desc}</div>
                  <div className="text-[9px] font-semibold" style={{ color: s.color }}>{s.threshold}</div>
                </div>
              ))}
            </div>
            <div className="bg-[#0f1f35] rounded p-2 text-[9px] text-[#94a3b8] leading-relaxed">
              All 4 badges green = take the trade. If any badge is red and there is a NO TRADE banner — skip the trade, no exceptions.
            </div>
          </Section>

          {/* Pre-trade checklist */}
          <Section title="Before Opening Any Trade" color="border-[#38bdf8]/30">
            <div className="grid grid-cols-2 gap-x-6">
              <div>
                <div className="text-[9px] text-[#38bdf8] uppercase font-bold mb-1">Market Conditions</div>
                <Check text="Time is 9:45am – 3:00pm (prime windows: 9:45–11 and 2:00–3:15)" />
                <Check text="VIX below 25 — app blocks trades if VIX > 25" />
                <Check text="NO TRADE banner is not showing in Order Entry" />
                <Check text="NIFTY is trending, not choppy (ADX > 20)" />
              </div>
              <div>
                <div className="text-[9px] text-[#38bdf8] uppercase font-bold mb-1">Score Gate</div>
                <Check text="Market Score ≥ 600/1000" />
                <Check text="Trade Strength badge is green (≥ 55/100)" />
                <Check text="Entry Quality ≥ 60/100 (candle setup is clean)" />
                <Check text="Risk Score ≥ 60/100 (R:R ≥ 2:1, SL is valid)" />
              </div>
            </div>
          </Section>

          {/* CE Buy Setup */}
          <Section title="⬆ BUY CE — Bullish Setup" color="border-[#22c55e]/40">
            <div className="grid grid-cols-2 gap-x-6">
              <div>
                <Row label="Market Score (CE)" value="≥ 600/1000" note="Strong: ≥ 700 · Minimum: 600" />
                <Row label="1h Prediction" value="BULLISH" />
                <Row label="Spot vs VWAP" value="Spot ABOVE VWAP" />
                <Row label="EMA Stack" value="EMA9 > EMA20 > EMA50" note="All three aligned up" />
              </div>
              <div>
                <Row label="RSI" value="> 55" note="Momentum confirming up" />
                <Row label="ADX" value="> 20" note="Trend is active" />
                <Row label="Entry Quality" value="≥ 60/100" note="Breakout candle, no upper wick" />
                <Row label="Risk Score" value="≥ 60/100" note="R:R ≥ 2:1, room above entry" />
              </div>
            </div>
            <div className="mt-2 bg-[#0d2b0d] rounded p-2 text-[10px] text-[#22c55e]">
              Ideal: all badges green + Entry Quality ≥ 70. Minimum: CE Score ≥ 600 + VWAP above + EMA aligned + Risk Score ≥ 60.
            </div>
          </Section>

          {/* PE Buy Setup */}
          <Section title="⬇ BUY PE — Bearish Setup" color="border-[#ef4444]/40">
            <div className="grid grid-cols-2 gap-x-6">
              <div>
                <Row label="Market Score (PE)" value="≥ 600/1000" note="Strong: ≥ 700 · Minimum: 600" />
                <Row label="1h Prediction" value="BEARISH" />
                <Row label="Spot vs VWAP" value="Spot BELOW VWAP" />
                <Row label="EMA Stack" value="EMA9 < EMA20 < EMA50" note="All three aligned down" />
              </div>
              <div>
                <Row label="RSI" value="< 45" note="Momentum confirming down" />
                <Row label="ADX" value="> 20" note="Trend is active" />
                <Row label="Entry Quality" value="≥ 60/100" note="Strong bearish candle, no lower wick" />
                <Row label="Risk Score" value="≥ 60/100" note="R:R ≥ 2:1, room below entry" />
              </div>
            </div>
            <div className="mt-2 bg-[#2b0d0d] rounded p-2 text-[10px] text-[#ef4444]">
              Ideal: all badges green + Entry Quality ≥ 70. Minimum: PE Score ≥ 600 + VWAP below + EMA aligned + Risk Score ≥ 60.
            </div>
          </Section>

          {/* Option to pick */}
          <Section title="Which Option to Pick" color="border-[#f59e0b]/30">
            <Row label="LTP Range" value="₹150 – ₹250" note="Use Smart Option Selection — it picks automatically" />
            <Row label="Strike type" value="ATM or 1 ITM" note="Avoids low-delta OTM options" />
            <Row label="Delta" value="0.40 – 0.60" note="Higher delta = moves more with NIFTY" />
            <Row label="OI Change" value="Positive (↑)" note="Rising OI = fresh positions building" />
            <Row label="Volume" value="High" note="Liquid option = easy exit, better Risk Score" />
          </Section>

          {/* Order & SL Rules */}
          <Section title="Order Rules (Non-Negotiable)" color="border-[#a855f7]/30">
            <Row label="Order Type" value="LIMIT always" note="Never market order for options" />
            <Row label="Product" value="MIS only" note="Auto square-off by 3:15pm" />
            <Row label="Stop Loss" value="Set before placing" note="R:R gate disables BUY if SL missing or RR < 1.5" />
            <Row label="Target" value="Auto 2:1 default" note="Click 'Auto 2:1' or enter manually. Must be ≥ 1.5:1" />
            <Row label="Quantity" value="Start with 1 lot (75 shares)" note="Scale up only after 3 consecutive wins" />
          </Section>

          {/* Trade Management */}
          <Section title="During the Trade" color="border-[#38bdf8]/30">
            <Check text="If trade moves +50% of your SL range in your favour → move SL to entry (break-even)." />
            <Check text="If trade moves to your target → exit fully. Don't hold unless score is still ≥ 700." />
            <Check text="If SL is hit → DO NOT re-enter the same direction within 15 minutes." />
            <Check text="If 2 consecutive SLs hit → stop trading for the day." />
            <Check text="After 3 consecutive wins → discipline store warns about overconfidence. Reduce size." />
          </Section>

          {/* Avoid */}
          <Section title="⚠ Never Trade When…" color="border-[#f59e0b]/40">
            <div className="grid grid-cols-2 gap-x-6">
              <div>
                <div className="text-[9px] text-[#f59e0b] uppercase font-bold mb-1">App-enforced (NO TRADE)</div>
                <Check text="Both CE and PE score < 350 (no directional bias)" />
                <Check text="Gap between CE/PE < 80 and both < 550 (mixed signals)" />
                <Check text="VIX > 25 (market too volatile)" />
                <Check text="Time is 12:00–1:30pm (lunch lull — time multiplier 0.75)" />
              </div>
              <div>
                <div className="text-[9px] text-[#f59e0b] uppercase font-bold mb-1">Rule-based (your discipline)</div>
                <Check text="Entry Quality < 40 (candle setup is poor)" />
                <Check text="Risk Score < 40 (R:R poor or SL not set)" />
                <Check text="Prediction = SIDEWAYS or NEUTRAL" />
                <Check text="Daily loss limit already at 50%+" />
              </div>
            </div>
          </Section>

          {/* Score Reference */}
          <Section title="Score Reference" color="border-[#475569]/40">
            <div className="mb-2">
              <div className="text-[9px] text-[#64748b] uppercase font-bold mb-1.5">Market Score (out of 1000)</div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { range: '700–1000', label: 'Strong', color: 'text-[#22c55e]', bg: 'bg-[#0d2b0d]' },
                  { range: '600–699', label: 'Moderate', color: 'text-[#f59e0b]', bg: 'bg-[#1a1200]' },
                  { range: '400–599', label: 'Wait', color: 'text-[#475569]', bg: 'bg-[#0f1f35]' },
                  { range: '0–399', label: 'No Trade', color: 'text-[#ef4444]', bg: 'bg-[#2b0d0d]' },
                ].map(({ range, label, color, bg }) => (
                  <div key={range} className={`${bg} rounded p-2`}>
                    <div className={`${color} text-xs font-bold`}>{range}</div>
                    <div className={`${color} text-[9px] mt-0.5`}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[9px] text-[#64748b] uppercase font-bold mb-1.5">Entry Quality & Risk Score (out of 100)</div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { range: '80–100', label: 'Excellent', color: 'text-[#22c55e]', bg: 'bg-[#0d2b0d]' },
                  { range: '60–79', label: 'Good', color: 'text-[#f59e0b]', bg: 'bg-[#1a1200]' },
                  { range: '35–59', label: 'Fair', color: 'text-[#475569]', bg: 'bg-[#0f1f35]' },
                  { range: '0–34', label: 'Poor', color: 'text-[#ef4444]', bg: 'bg-[#2b0d0d]' },
                ].map(({ range, label, color, bg }) => (
                  <div key={range} className={`${bg} rounded p-2`}>
                    <div className={`${color} text-xs font-bold`}>{range}</div>
                    <div className={`${color} text-[9px] mt-0.5`}>{label}</div>
                  </div>
                ))}
              </div>
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
