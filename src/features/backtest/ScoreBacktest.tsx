import { useState, useEffect, useCallback } from 'react'
import { useSettingsStore } from '@/core/store'
import { useLiveModeStore } from '@/core/services/tradingService'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, CartesianGrid, ReferenceArea,
} from 'recharts'
import { AlertCircle, RefreshCw, TrendingUp } from 'lucide-react'
import { calculateMarketScore } from '@/core/utils/scoreEngine'
import type { PivotPoints } from '@/core/types'

// ── types ─────────────────────────────────────────────────────────────────────
interface RawCandle { ts: string; open: number; high: number; low: number; close: number; volume: number }
interface ScorePoint { time: string; ceScore: number; peScore: number }
interface ChartPoint { time: string; ceScore?: number; peScore?: number; ceAvg?: number; peAvg?: number }
interface Bracket { x1: string; x2: string; label: string }

// ── indicator helpers ─────────────────────────────────────────────────────────

function calcVWAP(candles: RawCandle[]): number[] {
  let cumPV = 0, cumV = 0
  return candles.map(c => {
    const tp = (c.high + c.low + c.close) / 3
    cumPV += tp * c.volume
    cumV  += c.volume
    return cumV > 0 ? cumPV / cumV : c.close
  })
}

function calcEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const ema: number[] = []
  let prev = NaN, sum = 0
  for (let i = 0; i < prices.length; i++) {
    sum += prices[i]
    if (isNaN(prev)) {
      if (i === period - 1) { prev = sum / period; ema.push(prev) }
      else                  { ema.push(sum / (i + 1)) }
    } else {
      prev = prices[i] * k + prev * (1 - k)
      ema.push(prev)
    }
  }
  return ema
}

function calcRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = []
  let avgGain = 0, avgLoss = 0, primed = false
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) { rsi.push(50); continue }
    const d = closes[i] - closes[i-1]
    const g = d > 0 ? d : 0, l = d < 0 ? -d : 0
    if (!primed) {
      avgGain += g; avgLoss += l
      if (i === period) {
        avgGain /= period; avgLoss /= period
        primed = true
        rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
      } else {
        rsi.push(50)
      }
    } else {
      avgGain = (avgGain * (period - 1) + g) / period
      avgLoss = (avgLoss * (period - 1) + l) / period
      rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
    }
  }
  return rsi
}

function calcADX(highs: number[], lows: number[], closes: number[], period = 14): number[] {
  const n = closes.length
  const result: number[] = new Array(n).fill(20)
  if (n <= period * 2) return result

  const pDM: number[] = [0], mDM: number[] = [0], trr: number[] = [highs[0] - lows[0]]
  for (let i = 1; i < n; i++) {
    const up = highs[i] - highs[i-1], dn = lows[i-1] - lows[i]
    pDM.push(up > dn && up > 0 ? up : 0)
    mDM.push(dn > up && dn > 0 ? dn : 0)
    trr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1])))
  }

  let sTR = trr.slice(0, period).reduce((a, b) => a + b)
  let sPDM = pDM.slice(0, period).reduce((a, b) => a + b)
  let sMDM = mDM.slice(0, period).reduce((a, b) => a + b)

  const getDX = (sp: number, sm: number, st: number) => {
    if (st === 0) return 0
    const pdi = sp / st * 100, mdi = sm / st * 100
    return pdi + mdi === 0 ? 0 : Math.abs(pdi - mdi) / (pdi + mdi) * 100
  }

  const dxArr: number[] = [getDX(sPDM, sMDM, sTR)]
  for (let i = period; i < n; i++) {
    sTR  = sTR  - sTR / period  + trr[i]
    sPDM = sPDM - sPDM / period + pDM[i]
    sMDM = sMDM - sMDM / period + mDM[i]
    dxArr.push(getDX(sPDM, sMDM, sTR))
  }

  if (dxArr.length < period) return result
  let adxVal = dxArr.slice(0, period).reduce((a, b) => a + b) / period
  let barIdx = 2 * period - 1
  if (barIdx < n) result[barIdx] = adxVal
  for (let i = period; i < dxArr.length; i++) {
    adxVal = (adxVal * (period - 1) + dxArr[i]) / period
    barIdx++
    if (barIdx < n) result[barIdx] = adxVal
  }
  return result
}

// ── fetch helpers ─────────────────────────────────────────────────────────────

async function fetch5mCandles(fromDate: string, toDate: string, apiKey: string, accessToken: string): Promise<RawCandle[]> {
  const from = encodeURIComponent(`${fromDate} 09:15:00`)
  const to   = encodeURIComponent(`${toDate} 15:30:00`)
  const qs = `kite_path=instruments/historical/256265/5minute&from=${from}&to=${to}&continuous=0&oi=0`
  const res = await fetch(`/api/kite?${qs}`, {
    headers: { 'X-Kite-Auth': `token ${apiKey}:${accessToken}`, 'X-Kite-Version': '3' },
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  const json = await res.json()
  const raw: Array<[string, number, number, number, number, number]> = json.data?.candles ?? []
  return raw.map(([ts, open, high, low, close, volume]) => ({ ts, open, high, low, close, volume }))
}

async function fetchPrevDayCandle(date: string, apiKey: string, accessToken: string): Promise<{ high: number; low: number; close: number } | null> {
  const toDate = new Date(date + 'T00:00:00')
  toDate.setDate(toDate.getDate() - 1)
  const fromDate = new Date(toDate)
  fromDate.setDate(fromDate.getDate() - 6)
  const qs = `kite_path=instruments/historical/256265/day&from=${encodeURIComponent(fromDate.toISOString().slice(0,10) + ' 00:00:00')}&to=${encodeURIComponent(toDate.toISOString().slice(0,10) + ' 23:59:59')}&continuous=0&oi=0`
  const res = await fetch(`/api/kite?${qs}`, {
    headers: { 'X-Kite-Auth': `token ${apiKey}:${accessToken}`, 'X-Kite-Version': '3' },
  })
  if (!res.ok) return null
  const json = await res.json()
  const raw: Array<[string, number, number, number, number]> = json.data?.candles ?? []
  if (raw.length === 0) return null
  const [, , h, l, c] = raw[raw.length - 1]
  return { high: h, low: l, close: c }
}

// ── indicator + score computation ─────────────────────────────────────────────

function parseIST(ts: string): { hour: number; minute: number; label: string } {
  const m = ts.match(/T(\d{2}):(\d{2})/)
  if (m) return { hour: +m[1], minute: +m[2], label: `${m[1]}:${m[2]}` }
  const d = new Date(ts)
  const ist = new Date(d.getTime() + 5.5 * 3600000)
  const h = ist.getUTCHours(), mn = ist.getUTCMinutes()
  return { hour: h, minute: mn, label: `${String(h).padStart(2,'0')}:${String(mn).padStart(2,'0')}` }
}

function buildPivots(pd: { high: number; low: number; close: number }): PivotPoints {
  const pp = (pd.high + pd.low + pd.close) / 3
  return {
    pp, prevHigh: pd.high, prevLow: pd.low, prevClose: pd.close,
    r1: 2 * pp - pd.low,  r2: pp + (pd.high - pd.low),
    s1: 2 * pp - pd.high, s2: pp - (pd.high - pd.low),
  }
}

function aggregateBars(raw: RawCandle[], barSize: number): RawCandle[] {
  const result: RawCandle[] = []
  for (let i = 0; i + barSize <= raw.length; i += barSize) {
    const chunk = raw.slice(i, i + barSize)
    result.push({
      ts: chunk[0].ts, open: chunk[0].open,
      high: Math.max(...chunk.map(c => c.high)),
      low:  Math.min(...chunk.map(c => c.low)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((a, b) => a + b.volume, 0),
    })
  }
  return result
}

function calcTrendArr(raw: RawCandle[], barSize: number): Array<'bull' | 'bear' | 'neutral'> {
  const agg = aggregateBars(raw, barSize)
  if (agg.length < 9) return raw.map(() => 'neutral' as const)
  const closes = agg.map(c => c.close)
  const e9  = calcEMA(closes, 9)
  const e20 = calcEMA(closes, 20)
  return raw.map((_, i) => {
    const idx = Math.floor(i / barSize)
    const v9 = e9[Math.min(idx, e9.length - 1)]
    const v20 = e20[Math.min(idx, e20.length - 1)]
    if (v9 > v20 * 1.0002) return 'bull'
    if (v9 < v20 * 0.9998) return 'bear'
    return 'neutral'
  })
}

function computeScores(
  raw: RawCandle[],
  prevDay: { high: number; low: number; close: number } | null,
  pivots: PivotPoints | null,
): ScorePoint[] {
  const closes = raw.map(c => c.close)
  const highs  = raw.map(c => c.high)
  const lows   = raw.map(c => c.low)
  const vols   = raw.map(c => c.volume)

  const vwap   = calcVWAP(raw)
  const ema9   = calcEMA(closes, 9)
  const ema20  = calcEMA(closes, 20)
  const ema50  = calcEMA(closes, 50)
  const rsi    = calcRSI(closes, 14)
  const adx    = calcADX(highs, lows, closes, 14)
  const trend15m = calcTrendArr(raw, 3)
  const trend1h  = calcTrendArr(raw, 12)

  const avgVol = vols.reduce((a, b) => a + b, 0) / Math.max(vols.length, 1)
  const ORH = Math.max(...highs.slice(0, 3))
  const ORL = Math.min(...lows.slice(0, 3))
  const LB = 10, ROC_N = 5

  return raw.map((c, i) => {
    const { hour, minute, label } = parseIST(c.ts)
    const score = calculateMarketScore({
      spot: c.close, vwap: vwap[i],
      ema9: ema9[i], ema20: ema20[i], ema50: ema50[i],
      rsi: rsi[i], adx: adx[i],
      pcr: 1.0, breadth: 50, vix: 20,
      lastCandleGreen: c.close >= c.open,
      volumeAboveAvg:  c.volume > avgVol,
      yesterdayHigh: prevDay?.high,
      yesterdayLow:  prevDay?.low,
      openingRangeHigh: i >= 3 ? ORH : undefined,
      openingRangeLow:  i >= 3 ? ORL : undefined,
      isHigherHigh: i >= LB ? highs[i] > highs[i - LB] : undefined,
      isHigherLow:  i >= LB ? lows[i]  > lows[i - LB]  : undefined,
      isLowerHigh:  i >= LB ? highs[i] < highs[i - LB] : undefined,
      isLowerLow:   i >= LB ? lows[i]  < lows[i - LB]  : undefined,
      roc5: i >= ROC_N ? (closes[i] - closes[i - ROC_N]) / closes[i - ROC_N] * 100 : undefined,
      trend15m: trend15m[i],
      trend1h:  trend1h[i],
      pivotPP: pivots?.pp, pivotR1: pivots?.r1, pivotR2: pivots?.r2,
      pivotS1: pivots?.s1, pivotS2: pivots?.s2,
      hour, minute,
    })
    return { time: label, ceScore: score.ceScore, peScore: score.peScore }
  })
}

// ── time slot + avg helpers ───────────────────────────────────────────────────

function generateTimeSlots(): string[] {
  const slots: string[] = []
  let h = 9, m = 15
  while (h < 15 || (h === 15 && m <= 25)) {
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    m += 5
    if (m >= 60) { m -= 60; h++ }
  }
  return slots
}

const ALL_SLOTS = generateTimeSlots()

function computeAvgByTimeSlot(rawMultiDay: RawCandle[]): { avgs: Record<string, {ceAvg: number; peAvg: number}>; days: number } {
  const byDate: Record<string, RawCandle[]> = {}
  for (const c of rawMultiDay) {
    const date = c.ts.slice(0, 10)
    if (!byDate[date]) byDate[date] = []
    byDate[date].push(c)
  }

  const accum: Record<string, {ceSum: number; peSum: number; count: number}> = {}
  let tradingDays = 0
  for (const candles of Object.values(byDate)) {
    if (candles.length < 10) continue
    tradingDays++
    for (const s of computeScores(candles, null, null)) {
      if (!accum[s.time]) accum[s.time] = { ceSum: 0, peSum: 0, count: 0 }
      accum[s.time].ceSum += s.ceScore
      accum[s.time].peSum += s.peScore
      accum[s.time].count++
    }
  }

  const avgs: Record<string, {ceAvg: number; peAvg: number}> = {}
  for (const [time, a] of Object.entries(accum)) {
    avgs[time] = { ceAvg: Math.round(a.ceSum / a.count), peAvg: Math.round(a.peSum / a.count) }
  }
  return { avgs, days: tradingDays }
}

function findHighBrackets(
  avgs: Record<string, {ceAvg: number; peAvg: number}>,
  key: 'ceAvg' | 'peAvg',
  threshold = 520,
): Bracket[] {
  const brackets: Bracket[] = []
  let start: string | null = null
  let count = 0

  for (const slot of ALL_SLOTS) {
    const val = avgs[slot]?.[key] ?? 0
    if (val >= threshold) {
      if (!start) { start = slot; count = 0 }
      count++
    } else {
      if (start && count >= 3) {
        const endSlot = ALL_SLOTS[Math.min(ALL_SLOTS.indexOf(start) + count - 1, ALL_SLOTS.length - 1)]
        brackets.push({ x1: start, x2: endSlot, label: `${start}–${endSlot}` })
      }
      start = null; count = 0
    }
  }
  if (start && count >= 3) {
    const endSlot = ALL_SLOTS[Math.min(ALL_SLOTS.indexOf(start) + count - 1, ALL_SLOTS.length - 1)]
    brackets.push({ x1: start, x2: endSlot, label: `${start}–${endSlot}` })
  }
  return brackets
}

// ── component ─────────────────────────────────────────────────────────────────

export function ScoreBacktest() {
  const { apiKey, accessToken } = useSettingsStore()
  const isLive = useLiveModeStore(s => s.isLive)

  const [avgs, setAvgs]           = useState<Record<string, {ceAvg: number; peAvg: number}>>({})
  const [avgDays, setAvgDays]     = useState(0)
  const [liveScores, setLiveScores] = useState<ScorePoint[]>([])
  const [loadingAvg, setLoadingAvg] = useState(false)
  const [loadingLive, setLoadingLive] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState('')

  const loadAvgScores = useCallback(async () => {
    if (!apiKey || !accessToken) return
    setLoadingAvg(true)
    try {
      const toDate = new Date()
      toDate.setDate(toDate.getDate() - 1)
      const fromDate = new Date(toDate)
      fromDate.setDate(fromDate.getDate() - 35) // ~25 trading days
      const raw = await fetch5mCandles(
        fromDate.toISOString().slice(0, 10),
        toDate.toISOString().slice(0, 10),
        apiKey, accessToken,
      )
      const { avgs: a, days } = computeAvgByTimeSlot(raw)
      setAvgs(a)
      setAvgDays(days)
    } catch { /* avg failure is non-critical */ }
    setLoadingAvg(false)
  }, [apiKey, accessToken])

  const loadLiveScores = useCallback(async () => {
    if (!apiKey || !accessToken) return
    setLoadingLive(true)
    setError('')
    try {
      const today = new Date().toISOString().slice(0, 10)
      const [raw, prevDay] = await Promise.all([
        fetch5mCandles(today, today, apiKey, accessToken),
        fetchPrevDayCandle(today, apiKey, accessToken),
      ])
      if (raw.length > 0) {
        const pv = prevDay ? buildPivots(prevDay) : null
        setLiveScores(computeScores(raw, prevDay, pv))
        setLastUpdated(new Date())
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch live data')
    }
    setLoadingLive(false)
  }, [apiKey, accessToken])

  useEffect(() => {
    if (!isLive) return
    loadAvgScores()
    loadLiveScores()
    // Auto-refresh every 5 min during market hours
    const interval = setInterval(loadLiveScores, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [isLive, loadAvgScores, loadLiveScores])

  if (!isLive) {
    return (
      <div className="flex flex-col items-center justify-center h-28 gap-2 border-t border-[#1e293b] mt-1">
        <AlertCircle size={16} className="text-[#f59e0b]" />
        <p className="text-[#64748b] text-[10px]">Connect to Zerodha to view live score</p>
      </div>
    )
  }

  // Merge live + avg into unified chart points across all time slots
  const liveMap = Object.fromEntries(liveScores.map(s => [s.time, s]))
  const chartData: ChartPoint[] = ALL_SLOTS.map(time => ({
    time,
    ceScore: liveMap[time]?.ceScore,
    peScore: liveMap[time]?.peScore,
    ceAvg: avgs[time]?.ceAvg,
    peAvg: avgs[time]?.peAvg,
  }))

  const hasAvg = Object.keys(avgs).length > 0
  const ceHighBrackets = hasAvg ? findHighBrackets(avgs, 'ceAvg') : []
  const peHighBrackets = hasAvg ? findHighBrackets(avgs, 'peAvg') : []
  const lastLive = liveScores[liveScores.length - 1]
  const updatedStr = lastUpdated?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  const chartWidth = Math.max(700, ALL_SLOTS.length * 9)

  return (
    <div className="space-y-3 p-3 border-t border-[#1e293b]">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-[#e2e8f0] text-xs font-semibold">Live Market Score</h3>
          <p className="text-[#475569] text-[9px]">
            CE / PE · 5-min candles
            {hasAvg && <span className="ml-1">· Avg from {avgDays} days</span>}
            {updatedStr && <span className="ml-1">· Updated {updatedStr}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {lastLive && (
            <div className="flex items-center gap-1.5 border border-[#1e293b] rounded px-2 py-1">
              <span className="text-[9px] text-[#64748b]">CE</span>
              <span className={`text-xs font-bold tabular-nums ${lastLive.ceScore >= 500 ? 'text-[#22c55e]' : 'text-[#64748b]'}`}>
                {lastLive.ceScore}
              </span>
              <span className="w-px h-3 bg-[#1e293b]" />
              <span className="text-[9px] text-[#64748b]">PE</span>
              <span className={`text-xs font-bold tabular-nums ${lastLive.peScore >= 500 ? 'text-[#ef4444]' : 'text-[#64748b]'}`}>
                {lastLive.peScore}
              </span>
            </div>
          )}
          <button
            onClick={loadLiveScores}
            disabled={loadingLive}
            className="flex items-center gap-1 text-[#475569] hover:text-[#94a3b8] text-[10px] px-2 py-1 rounded border border-[#1e293b] hover:border-[#1e3a5f] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={9} className={loadingLive ? 'animate-spin' : ''} />
            {loadingLive ? 'Updating…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <div className="text-[#ef4444] text-[10px] bg-red-900/20 rounded p-2">{error}</div>}

      {/* Chart */}
      <div className="overflow-x-auto">
        <div style={{ width: chartWidth, minWidth: '100%' }}>
          <LineChart
            width={chartWidth}
            height={220}
            data={chartData}
            margin={{ top: 5, right: 60, bottom: 5, left: 0 }}
          >
            <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" />

            {/* Avg high-score background brackets */}
            {ceHighBrackets.map((b, i) => (
              <ReferenceArea key={`ce-bg-${i}`} x1={b.x1} x2={b.x2} fill="#22c55e" fillOpacity={0.07} />
            ))}
            {peHighBrackets.map((b, i) => (
              <ReferenceArea key={`pe-bg-${i}`} x1={b.x1} x2={b.x2} fill="#ef4444" fillOpacity={0.07} />
            ))}

            <XAxis
              dataKey="time"
              tick={{ fontSize: 7, fill: '#475569' }}
              interval={5}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              orientation="right"
              width={50}
              domain={[0, 1000]}
              ticks={[0, 250, 500, 700, 1000]}
              tick={{ fontSize: 7, fill: '#475569' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: 4, fontSize: 10 }}
              labelStyle={{ color: '#94a3b8' }}
              formatter={(v: unknown, key: string) => {
                if (v == null) return null
                const labels: Record<string, string> = {
                  ceScore: 'CE Live', peScore: 'PE Live',
                  ceAvg: `CE Avg (${avgDays}d)`, peAvg: `PE Avg (${avgDays}d)`,
                }
                return [v as number, labels[key] ?? key]
              }}
            />

            <ReferenceLine y={500} stroke="#f59e0b" strokeDasharray="5 3" strokeWidth={1.5}
              label={{ value: '500', fill: '#f59e0b', fontSize: 8, position: 'right' }} />
            <ReferenceLine y={700} stroke="#22c55e" strokeDasharray="3 5" strokeWidth={1} opacity={0.4}
              label={{ value: '700', fill: '#22c55e', fontSize: 8, position: 'right' }} />

            {/* Historical avg lines — dashed, subtle */}
            {hasAvg && (
              <>
                <Line type="monotone" dataKey="ceAvg" stroke="#22c55e" strokeWidth={1}
                  strokeDasharray="4 3" dot={false} opacity={0.4} isAnimationActive={false} connectNulls />
                <Line type="monotone" dataKey="peAvg" stroke="#ef4444" strokeWidth={1}
                  strokeDasharray="4 3" dot={false} opacity={0.4} isAnimationActive={false} connectNulls />
              </>
            )}

            {/* Live score lines */}
            <Line type="monotone" dataKey="ceScore" stroke="#22c55e" strokeWidth={2}
              dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="peScore" stroke="#ef4444" strokeWidth={2}
              dot={false} isAnimationActive={false} />
          </LineChart>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px]">
        <span className="flex items-center gap-1">
          <span className="w-4 h-0.5 inline-block bg-[#22c55e] rounded" />
          <span className="text-[#22c55e]">CE (live)</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-0.5 inline-block bg-[#ef4444] rounded" />
          <span className="text-[#ef4444]">PE (live)</span>
        </span>
        {hasAvg && (
          <>
            <span className="flex items-center gap-1">
              <span className="w-4 inline-block border-t border-dashed border-[#22c55e] opacity-60" />
              <span className="text-[#64748b]">CE avg</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 inline-block border-t border-dashed border-[#ef4444] opacity-60" />
              <span className="text-[#64748b]">PE avg</span>
            </span>
          </>
        )}
        <span className="ml-auto text-[#475569]">
          Shaded = avg ≥520 brackets
        </span>
      </div>

      {/* High-score bracket summary */}
      {(ceHighBrackets.length > 0 || peHighBrackets.length > 0) && (
        <div className="bg-[#060d1a] rounded border border-[#1e293b] p-2 space-y-1.5">
          <p className="text-[#475569] text-[8px] uppercase tracking-widest">Avg high-score windows ({avgDays}d)</p>
          {ceHighBrackets.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <TrendingUp size={8} className="text-[#22c55e] shrink-0" />
              <span className="text-[#64748b] text-[8px]">CE high:</span>
              {ceHighBrackets.map(b => (
                <span key={b.label} className="text-[8px] text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/20 px-1.5 py-0.5 rounded">
                  {b.label}
                </span>
              ))}
            </div>
          )}
          {peHighBrackets.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <TrendingUp size={8} className="text-[#ef4444] shrink-0" />
              <span className="text-[#64748b] text-[8px]">PE high:</span>
              {peHighBrackets.map(b => (
                <span key={b.label} className="text-[8px] text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/20 px-1.5 py-0.5 rounded">
                  {b.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {loadingAvg && (
        <p className="text-[#475569] text-[8px] flex items-center gap-1">
          <RefreshCw size={7} className="animate-spin" />
          Loading historical patterns…
        </p>
      )}

    </div>
  )
}
