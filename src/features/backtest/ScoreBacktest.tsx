import { useState } from 'react'
import { useSettingsStore } from '@/core/store'
import { useLiveModeStore } from '@/core/services/tradingService'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, CartesianGrid,
} from 'recharts'
import { Play, AlertCircle } from 'lucide-react'
import { calculateMarketScore } from '@/core/utils/scoreEngine'
import { CandlestickChart } from '@/features/chart/CandlestickChart'
import type { Candle, PivotPoints } from '@/core/types'

// ── types ─────────────────────────────────────────────────────────────────────
interface RawCandle { ts: string; open: number; high: number; low: number; close: number; volume: number }
interface ScorePoint { time: string; ceScore: number; peScore: number }

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

// Returns EMA, using running SMA for early bars (no NaN — full-length output).
function calcEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const ema: number[] = []
  let prev = NaN, sum = 0
  for (let i = 0; i < prices.length; i++) {
    sum += prices[i]
    if (isNaN(prev)) {
      if (i === period - 1) { prev = sum / period; ema.push(prev) }
      else                  { ema.push(sum / (i + 1)) }  // running SMA until primed
    } else {
      prev = prices[i] * k + prev * (1 - k)
      ema.push(prev)
    }
  }
  return ema
}

// Returns RSI (14). Returns 50 (neutral) until enough data.
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

// Returns ADX (14). Returns 20 (neutral) until enough bars.
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

// Zerodha timestamps are already IST (e.g. "2026-05-15T09:15:00+0530")
function parseIST(ts: string): { hour: number; minute: number; label: string } {
  const m = ts.match(/T(\d{2}):(\d{2})/)
  if (m) return { hour: +m[1], minute: +m[2], label: `${m[1]}:${m[2]}` }
  const d = new Date(ts)
  const ist = new Date(d.getTime() + 5.5 * 3600000)
  const h = ist.getUTCHours(), mn = ist.getUTCMinutes()
  return { hour: h, minute: mn, label: `${String(h).padStart(2,'0')}:${String(mn).padStart(2,'0')}` }
}

// ── pivot computation ─────────────────────────────────────────────────────────

function buildPivots(pd: { high: number; low: number; close: number }): PivotPoints {
  const pp = (pd.high + pd.low + pd.close) / 3
  return {
    pp, prevHigh: pd.high, prevLow: pd.low, prevClose: pd.close,
    r1: 2 * pp - pd.low,  r2: pp + (pd.high - pd.low),
    s1: 2 * pp - pd.high, s2: pp - (pd.high - pd.low),
  }
}

// ── multi-timeframe helpers ───────────────────────────────────────────────────

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
  // Need at least 9 aggregate bars for EMA9 to be meaningful; return neutral otherwise
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

// ── score + candle computation ────────────────────────────────────────────────

interface ComputeResult { scores: ScorePoint[]; candles: Candle[] }

function computeScores(
  raw: RawCandle[],
  prevDay: { high: number; low: number; close: number } | null,
  pivots: PivotPoints | null,
): ComputeResult {
  const closes = raw.map(c => c.close)
  const highs  = raw.map(c => c.high)
  const lows   = raw.map(c => c.low)
  const vols   = raw.map(c => c.volume)

  const vwap  = calcVWAP(raw)
  const ema9  = calcEMA(closes, 9)
  const ema20 = calcEMA(closes, 20)
  const ema50 = calcEMA(closes, 50)
  const rsi   = calcRSI(closes, 14)
  const adx   = calcADX(highs, lows, closes, 14)

  // Multi-timeframe trends derived from 5-min bars
  const trend15m = calcTrendArr(raw, 3)   // 3 × 5min = 15min
  const trend1h  = calcTrendArr(raw, 12)  // 12 × 5min = 60min

  const avgVol = vols.reduce((a, b) => a + b, 0) / Math.max(vols.length, 1)
  const ORH = Math.max(...highs.slice(0, 3))
  const ORL = Math.min(...lows.slice(0, 3))
  const LB = 10   // lookback bars for HH/HL detection
  const ROC_N = 5 // bars for rate-of-change (25 min on 5-min candles)

  const scores: ScorePoint[] = []
  const candles: Candle[] = []

  raw.forEach((c, i) => {
    const { hour, minute, label } = parseIST(c.ts)

    // Higher high / lower low vs LB bars ago
    const isHigherHigh = i >= LB ? highs[i] > highs[i - LB] : undefined
    const isHigherLow  = i >= LB ? lows[i]  > lows[i - LB]  : undefined
    const isLowerHigh  = i >= LB ? highs[i] < highs[i - LB] : undefined
    const isLowerLow   = i >= LB ? lows[i]  < lows[i - LB]  : undefined

    // 5-bar rate of change (%) — responds immediately to price moves, no EMA lag
    const roc5 = i >= ROC_N
      ? (closes[i] - closes[i - ROC_N]) / closes[i - ROC_N] * 100
      : undefined

    const score = calculateMarketScore({
      spot: c.close, vwap: vwap[i],
      ema9: ema9[i], ema20: ema20[i], ema50: ema50[i],
      rsi: rsi[i], adx: adx[i],
      pcr: 1.0, breadth: 50,
      vix: 20,        // truly neutral: gives 0 pts to both CE and PE
      lastCandleGreen: c.close >= c.open,
      volumeAboveAvg:  c.volume > avgVol,
      yesterdayHigh: prevDay?.high,
      yesterdayLow:  prevDay?.low,
      openingRangeHigh: i >= 3 ? ORH : undefined,
      openingRangeLow:  i >= 3 ? ORL : undefined,
      isHigherHigh, isHigherLow, isLowerHigh, isLowerLow,
      roc5,
      trend15m: trend15m[i],
      trend1h:  trend1h[i],
      // Pivot levels for S/R factor
      pivotPP: pivots?.pp,   pivotR1: pivots?.r1,  pivotR2: pivots?.r2,
      pivotS1: pivots?.s1,   pivotS2: pivots?.s2,
      hour, minute,
    })
    scores.push({ time: label, ceScore: score.ceScore, peScore: score.peScore })
    candles.push({
      time: label, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
      ema9: ema9[i], ema20: ema20[i], ema50: ema50[i], vwap: vwap[i],
    })
  })

  return { scores, candles }
}

// ── component ─────────────────────────────────────────────────────────────────

function lastWeekday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

export function ScoreBacktest() {
  const { apiKey, accessToken } = useSettingsStore()
  const isLive = useLiveModeStore(s => s.isLive)

  const [fromDate, setFromDate] = useState(lastWeekday)
  const [toDate, setToDate]     = useState(lastWeekday)
  const [scores, setScores]     = useState<ScorePoint[]>([])
  const [chartCandles, setChartCandles] = useState<Candle[]>([])
  const [pivots, setPivots]     = useState<PivotPoints | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [ran, setRan]           = useState(false)

  async function run() {
    setLoading(true); setError('')
    try {
      const [rawCandles, prevDay] = await Promise.all([
        fetch5mCandles(fromDate, toDate, apiKey, accessToken),
        fetchPrevDayCandle(fromDate, apiKey, accessToken),
      ])
      if (rawCandles.length === 0) throw new Error('No 5-min candles returned — this may be a holiday or weekend')
      const pv = prevDay ? buildPivots(prevDay) : null
      const { scores: s, candles: c } = computeScores(rawCandles, prevDay, pv)
      setScores(s)
      setChartCandles(c)
      setPivots(pv)
      setRan(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch data')
    }
    setLoading(false)
  }

  if (!isLive) {
    return (
      <div className="flex flex-col items-center justify-center h-28 gap-2 border-t border-[#1e293b] mt-1">
        <AlertCircle size={16} className="text-[#f59e0b]" />
        <p className="text-[#64748b] text-[10px]">Connect to Zerodha to run score backtest</p>
      </div>
    )
  }

  const maxCE  = scores.length > 0 ? Math.max(...scores.map(s => s.ceScore)) : 0
  const maxPE  = scores.length > 0 ? Math.max(...scores.map(s => s.peScore)) : 0
  const ceBars = scores.filter(s => s.ceScore >= 500).length
  const peBars = scores.filter(s => s.peScore >= 500).length

  return (
    <div className="space-y-3 p-3 border-t border-[#1e293b]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-[#e2e8f0] text-xs font-semibold">Score Backtest</h3>
          <p className="text-[#475569] text-[9px]">CE / PE score · Scoring engine v2 · 5-min candles</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <span className="text-[#475569] text-[9px]">From</span>
            <input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={e => setFromDate(e.target.value)}
              className="bg-[#060d1a] border border-[#1e3a5f] rounded px-2 py-1 text-[#e2e8f0] text-[10px]"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[#475569] text-[9px]">To</span>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={e => setToDate(e.target.value)}
              className="bg-[#060d1a] border border-[#1e3a5f] rounded px-2 py-1 text-[#e2e8f0] text-[10px]"
            />
          </div>
          <button
            onClick={run} disabled={loading || !fromDate || !toDate}
            className="flex items-center gap-1.5 bg-[#38bdf8] text-black text-[10px] font-bold px-3 py-1.5 rounded hover:bg-[#0ea5e9] disabled:opacity-50 transition-colors"
          >
            <Play size={10} />
            {loading ? 'Computing…' : ran ? 'Re-run' : 'Run'}
          </button>
        </div>
      </div>

      {error && <div className="text-[#ef4444] text-[10px] bg-red-900/20 rounded p-2">{error}</div>}

      {ran && scores.length > 0 && (
        <>
          <div className="text-[#64748b] text-[9px] uppercase tracking-widest">
            CE / PE Score · {fromDate}{fromDate !== toDate ? ` → ${toDate}` : ''} · {scores.length} candles
          </div>

          <div className="overflow-x-auto">
            <div style={{ width: Math.max(600, scores.length * 9), minWidth: '100%' }}>
              <LineChart width={Math.max(600, scores.length * 9)} height={200} data={scores} margin={{ top: 5, right: 60, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" />
                <XAxis dataKey="time" tick={{ fontSize: 7, fill: '#475569' }} interval={5} axisLine={false} tickLine={false} />
                <YAxis
                  orientation="right" width={50}
                  domain={[0, 1000]}
                  ticks={[0, 250, 500, 700, 1000]}
                  tick={{ fontSize: 7, fill: '#475569' }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip
                  contentStyle={{ background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: 4, fontSize: 10 }}
                  labelStyle={{ color: '#64748b' }}
                  formatter={(v: number, key: string) => [v, key === 'ceScore' ? 'CE Score' : 'PE Score']}
                />
                <ReferenceLine y={500} stroke="#f59e0b" strokeDasharray="5 3" strokeWidth={1.5}
                  label={{ value: '500', fill: '#f59e0b', fontSize: 8, position: 'right' }} />
                <ReferenceLine y={700} stroke="#22c55e" strokeDasharray="3 5" strokeWidth={1} opacity={0.5}
                  label={{ value: '700', fill: '#22c55e', fontSize: 8, position: 'right' }} />
                <Line type="monotone" dataKey="ceScore" stroke="#22c55e" strokeWidth={1.5}
                  dot={false} name="CE Score" isAnimationActive={false} />
                <Line type="monotone" dataKey="peScore" stroke="#ef4444" strokeWidth={1.5}
                  dot={false} name="PE Score" isAnimationActive={false} />
              </LineChart>
            </div>
          </div>

          {/* Legend + summary */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px]">
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 inline-block rounded bg-[#22c55e]" />
              <span className="text-[#22c55e]">CE Score</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 inline-block rounded bg-[#ef4444]" />
              <span className="text-[#ef4444]">PE Score</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 inline-block rounded" style={{ background: '#f59e0b', height: 1, borderTop: '1px dashed #f59e0b' }} />
              <span className="text-[#f59e0b]">500 threshold</span>
            </span>

            <span className="ml-auto text-[#475569]">
              Peak CE <span className="text-[#22c55e] font-bold">{maxCE}</span>
            </span>
            <span className="text-[#475569]">
              Peak PE <span className="text-[#ef4444] font-bold">{maxPE}</span>
            </span>
            <span className="text-[#475569]">
              CE≥500 <span className="text-[#22c55e]">{ceBars} bars</span>
            </span>
            <span className="text-[#475569]">
              PE≥500 <span className="text-[#ef4444]">{peBars} bars</span>
            </span>
          </div>

          {/* NIFTY 50 candlestick chart */}
          <div className="text-[#64748b] text-[9px] uppercase tracking-widest mt-1">
            NIFTY 5-min candles · {fromDate}{fromDate !== toDate ? ` → ${toDate}` : ''}
          </div>
          <div className="bg-[#060d1a] rounded border border-[#1e293b] overflow-x-auto">
            <div style={{ width: Math.max(600, chartCandles.length * 9), minWidth: '100%' }}>
              <CandlestickChart
                candles={chartCandles}
                pivotPoints={pivots}
                height={220}
                timeframeMinutes={5}
              />
            </div>
          </div>

          <p className="text-[#334155] text-[8px] leading-relaxed">
            Scoring uses EMA9/20/50, VWAP, RSI14, ADX14 derived from 5-min candles.
            PCR, VIX and N50 breadth unavailable for historical data — neutral defaults used (pcr=1.0, vix=14, breadth=50).
          </p>
        </>
      )}
    </div>
  )
}
