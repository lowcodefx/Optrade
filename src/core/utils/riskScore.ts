export interface RiskScoreSignal {
  name: string
  points: number
  maxPoints: number
  passed: boolean
  detail: string
}

export interface RiskScoreResult {
  score: number   // 0–100
  label: 'poor' | 'fair' | 'good' | 'excellent'
  signals: RiskScoreSignal[]
}

export interface RiskScoreParams {
  entry: number           // limit price or premium
  stopLoss: number | null
  target: number | null   // 0 or missing = auto-derive at 2:1
  optionType: 'CE' | 'PE'
  oi: number              // open interest at selected strike (liquidity proxy)
  hour: number
  minute: number
  // Distance to next structural level (% of spot)
  distToResistancePct?: number
  distToSupportPct?: number
}

export function calculateRiskScore(p: RiskScoreParams): RiskScoreResult {
  const signals: RiskScoreSignal[] = []

  // 1. Risk:Reward (30pts)
  let rr: number | null = null
  if (p.stopLoss && p.entry > 0 && p.entry > p.stopLoss) {
    const risk   = p.entry - p.stopLoss
    const target = p.target && p.target > p.entry ? p.target : p.entry + risk * 2  // default 2:1
    rr = risk > 0 ? (target - p.entry) / risk : null
  }
  const rrPts = rr === null ? 0 : rr >= 2.5 ? 30 : rr >= 2.0 ? 25 : rr >= 1.5 ? 15 : rr >= 1.0 ? 8 : 0
  signals.push({
    name: 'Risk:Reward',
    points: rrPts, maxPoints: 30,
    passed: rr !== null && rr >= 2.0,
    detail: rr !== null ? `${rr.toFixed(1)}:1` : 'SL or Target not set',
  })

  // 2. Stop-loss validity (20pts) — SL should be 5–30% of premium (not too tight, not too wide)
  let slPts = 0, slDetail = 'SL not set'
  if (p.stopLoss && p.entry > 0) {
    const slPct = ((p.entry - p.stopLoss) / p.entry) * 100
    if (slPct >= 5 && slPct <= 30)      { slPts = 20; slDetail = `SL ${slPct.toFixed(0)}% of premium (valid)` }
    else if (slPct > 30 && slPct <= 50) { slPts = 10; slDetail = `SL ${slPct.toFixed(0)}% of premium (wide)` }
    else if (slPct > 0 && slPct < 5)    { slPts = 5;  slDetail = `SL ${slPct.toFixed(0)}% of premium (too tight)` }
    else                                 { slPts = 0;  slDetail = `SL ${slPct.toFixed(0)}% (invalid)` }
  }
  signals.push({ name: 'SL Validity', points: slPts, maxPoints: 20, passed: slPts >= 20, detail: slDetail })

  // 3. Distance to next structural level (20pts)
  // For CE: distance to next resistance matters (more room = better)
  // For PE: distance to next support matters
  let distPts = 0, distDetail = 'No level data'
  const distPct = p.optionType === 'CE' ? p.distToResistancePct : p.distToSupportPct
  if (distPct !== undefined) {
    if (distPct >= 1.5)      { distPts = 20; distDetail = `${distPct.toFixed(1)}% to next level (good room)` }
    else if (distPct >= 0.8) { distPts = 12; distDetail = `${distPct.toFixed(1)}% to next level (moderate)` }
    else if (distPct >= 0.3) { distPts = 5;  distDetail = `${distPct.toFixed(1)}% to next level (tight)` }
    else                     { distPts = 0;  distDetail = `${distPct.toFixed(1)}% — at resistance/support` }
  }
  signals.push({ name: 'Room to Level', points: distPts, maxPoints: 20, passed: distPts >= 20, detail: distDetail })

  // 4. Time of day quality (15pts)
  const t = p.hour * 60 + p.minute
  let timePts = 0, timeDetail = ''
  if (t >= 9 * 60 + 45 && t < 11 * 60)      { timePts = 15; timeDetail = 'Prime window (9:45–11:00)' }
  else if (t >= 14 * 60 && t < 15 * 60 + 15) { timePts = 15; timeDetail = 'Prime window (2:00–3:15)' }
  else if (t >= 11 * 60 && t < 12 * 60)      { timePts = 10; timeDetail = 'Moderate window (11:00–12:00)' }
  else if (t >= 9 * 60 + 25 && t < 9 * 60 + 45) { timePts = 7; timeDetail = 'Settling window (9:25–9:45)' }
  else if (t >= 13 * 60 + 30 && t < 14 * 60) { timePts = 8; timeDetail = 'Recovering (1:30–2:00)' }
  else if (t < 9 * 60 + 25)                  { timePts = 0; timeDetail = 'Opening noise (< 9:25)' }
  else if (t >= 12 * 60 && t < 13 * 60 + 30) { timePts = 3; timeDetail = 'Lunch lull (12:00–1:30)' }
  else                                        { timePts = 5; timeDetail = 'Closing window' }
  signals.push({ name: 'Time Quality', points: timePts, maxPoints: 15, passed: timePts >= 15, detail: timeDetail })

  // 5. Option liquidity (15pts) — based on open interest at the strike
  let liqPts = 0, liqDetail = ''
  const oiLakh = p.oi / 100000   // convert to lakh contracts
  if (oiLakh >= 20)      { liqPts = 15; liqDetail = `OI ${oiLakh.toFixed(0)}L (high liquidity)` }
  else if (oiLakh >= 10) { liqPts = 10; liqDetail = `OI ${oiLakh.toFixed(0)}L (moderate)` }
  else if (oiLakh >= 5)  { liqPts = 5;  liqDetail = `OI ${oiLakh.toFixed(0)}L (low)` }
  else                   { liqPts = 0;  liqDetail = `OI ${oiLakh.toFixed(1)}L (very low — wide spread risk)` }
  signals.push({ name: 'Liquidity', points: liqPts, maxPoints: 15, passed: liqPts >= 15, detail: liqDetail })

  const score = signals.reduce((s, sig) => s + sig.points, 0)
  const label: RiskScoreResult['label'] =
    score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 35 ? 'fair' : 'poor'

  return { score, label, signals }
}
