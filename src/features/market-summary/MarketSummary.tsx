import { useEffect, useState } from 'react'
import { API_BASE, vmHeaders } from '@/core/services/apiClient'
import { useMarketStore } from '@/core/store'
import { Zap, BarChart2, RefreshCw, Clock } from 'lucide-react'
import type { Candle } from '@/core/types'

interface SummaryData {
  summary: string
  updatedAt: string
  stale?: boolean
}

// ── alert coloring ────────────────────────────────────────────────────────────

function alertColor(line: string): 'green' | 'red' | 'yellow' | 'gray' {
  const l = line.toLowerCase()
  if (l.includes('bullish')) return 'green'
  if (l.includes('bearish')) return 'red'
  if (l.includes('volatil') || l.includes('caution') || l.includes('uncertain')) return 'yellow'
  return 'gray'
}

// ── chart pattern detection ───────────────────────────────────────────────────

interface PatternPoint {
  label: string
  detail: string
  signal: 'bullish' | 'bearish' | 'neutral'
}

function detectPatterns(candles: Candle[], spot: number, pp?: number, r1?: number, s1?: number): PatternPoint[] {
  if (candles.length < 5) return []
  const pts: PatternPoint[] = []
  const n = candles.length
  const c0 = candles[n - 1]  // latest
  const c1 = candles[n - 2]  // previous
  const last5  = candles.slice(-5)
  const last10 = candles.slice(-10)

  const body0    = Math.abs(c0.close - c0.open)
  const range0   = c0.high - c0.low
  const upper0   = c0.high - Math.max(c0.open, c0.close)
  const lower0   = Math.min(c0.open, c0.close) - c0.low
  const isGreen0 = c0.close >= c0.open

  // 1 ── Last-candle pattern
  if (range0 > 0) {
    const bodyRatio = body0 / range0
    const body1 = Math.abs(c1.close - c1.open)
    const isGreen1 = c1.close >= c1.open

    if (bodyRatio < 0.1 && range0 > 0) {
      pts.push({ label: 'Doji', detail: 'Indecision — bulls and bears in balance, watch next candle', signal: 'neutral' })
    } else if (lower0 > body0 * 2 && upper0 < body0 * 0.5) {
      pts.push({ label: isGreen0 ? 'Hammer' : 'Hanging Man', detail: isGreen0 ? 'Long lower wick — buyers rejected sell-off, bullish' : 'Long lower wick at high — distribution possible, bearish', signal: isGreen0 ? 'bullish' : 'bearish' })
    } else if (upper0 > body0 * 2 && lower0 < body0 * 0.5) {
      pts.push({ label: isGreen0 ? 'Inv. Hammer' : 'Shooting Star', detail: isGreen0 ? 'Long upper wick — potential reversal signal' : 'Long upper wick — sellers pushed price down, bearish', signal: isGreen0 ? 'neutral' : 'bearish' })
    } else if (body0 > body1 * 1.5 && isGreen0 !== isGreen1) {
      pts.push({ label: isGreen0 ? 'Bullish Engulfing' : 'Bearish Engulfing', detail: isGreen0 ? 'Current candle engulfs previous — strong buying pressure' : 'Current candle engulfs previous — strong selling pressure', signal: isGreen0 ? 'bullish' : 'bearish' })
    } else {
      pts.push({ label: isGreen0 ? 'Green Candle' : 'Red Candle', detail: isGreen0 ? `+${(c0.close - c0.open).toFixed(1)} pts — buyers in control` : `${(c0.close - c0.open).toFixed(1)} pts — sellers in control`, signal: isGreen0 ? 'bullish' : 'bearish' })
    }
  }

  // 2 ── Swing trend (last 5 candles HH/HL or LH/LL)
  const h5 = last5.map(c => c.high)
  const l5 = last5.map(c => c.low)
  const hhhl = h5[4] > h5[0] && l5[4] > l5[0]
  const lhll = h5[4] < h5[0] && l5[4] < l5[0]
  if (hhhl)      pts.push({ label: 'Swing Trend', detail: 'Higher highs & higher lows forming — uptrend intact', signal: 'bullish' })
  else if (lhll) pts.push({ label: 'Swing Trend', detail: 'Lower highs & lower lows forming — downtrend intact', signal: 'bearish' })
  else           pts.push({ label: 'Swing Trend', detail: 'No clear swing structure — range-bound price action', signal: 'neutral' })

  // 3 ── Momentum (consecutive same-colour candles)
  let streak = 1
  const streakGreen = candles[n - 1].close >= candles[n - 1].open
  for (let i = n - 2; i >= Math.max(0, n - 8); i--) {
    const g = candles[i].close >= candles[i].open
    if (g === streakGreen) streak++
    else break
  }
  if (streak >= 3) {
    pts.push({ label: 'Momentum', detail: `${streak} consecutive ${streakGreen ? 'green' : 'red'} candles — ${streakGreen ? 'bullish' : 'bearish'} momentum building`, signal: streakGreen ? 'bullish' : 'bearish' })
  }

  // 4 ── Pivot level proximity (within 0.2% of pp / r1 / s1)
  const near = (level: number) => Math.abs(spot - level) / spot < 0.002
  if (pp && near(pp)) pts.push({ label: 'Pivot Test', detail: `Price at Pivot Point (${pp.toFixed(0)}) — breakout direction key`, signal: 'neutral' })
  else if (r1 && near(r1)) pts.push({ label: 'R1 Test',    detail: `Price testing R1 resistance (${r1.toFixed(0)}) — watch for rejection or breakout`, signal: 'neutral' })
  else if (s1 && near(s1)) pts.push({ label: 'S1 Test',    detail: `Price at S1 support (${s1.toFixed(0)}) — hold = bullish, break = bearish`, signal: 'neutral' })

  // 5 ── Recent range (10 candles) — is price near high or low?
  const rangeHigh = Math.max(...last10.map(c => c.high))
  const rangeLow  = Math.min(...last10.map(c => c.low))
  const rangePos  = (spot - rangeLow) / (rangeHigh - rangeLow || 1)
  if (rangePos >= 0.85)      pts.push({ label: 'Range Position', detail: `Near 10-bar high (${rangeHigh.toFixed(0)}) — potential resistance zone`, signal: 'bearish' })
  else if (rangePos <= 0.15) pts.push({ label: 'Range Position', detail: `Near 10-bar low (${rangeLow.toFixed(0)}) — potential support zone`, signal: 'bullish' })

  return pts.slice(0, 5)
}

function useChartPatterns(): PatternPoint[] {
  const candles     = useMarketStore(s => s.candles)
  const quote       = useMarketStore(s => s.quote)
  const pivotPoints = useMarketStore(s => s.pivotPoints)
  if (!quote || candles.length < 5) return []
  return detectPatterns(candles, quote.spot, pivotPoints?.pp, pivotPoints?.r1, pivotPoints?.s1)
}

// ── shared style maps ─────────────────────────────────────────────────────────

const DOT: Record<string, string> = {
  green: 'bg-[#22c55e]', red: 'bg-[#ef4444]', yellow: 'bg-[#f59e0b]', gray: 'bg-[#475569]',
  bullish: 'bg-[#22c55e]', bearish: 'bg-[#ef4444]', neutral: 'bg-[#475569]',
}
const CLR: Record<string, string> = {
  green: 'text-[#cbd5e1]', red: 'text-[#cbd5e1]', yellow: 'text-[#cbd5e1]', gray: 'text-[#94a3b8]',
  bullish: 'text-[#cbd5e1]', bearish: 'text-[#cbd5e1]', neutral: 'text-[#94a3b8]',
}

// ── component ─────────────────────────────────────────────────────────────────

export function MarketSummary() {
  const [data, setData]     = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const patterns = useChartPatterns()

  async function load() {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/market-summary`, { headers: vmHeaders() })
      if (!res.ok) throw new Error(`${res.status}`)
      setData(await res.json())
    } catch { setError('Alerts unavailable') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 10 * 60 * 1000)
    return () => clearInterval(t)
  }, [])

  const updatedTime = data?.updatedAt
    ? new Date(data.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : null
  const alertLines = data?.summary.split('\n').filter(l => l.trim()) ?? []

  return (
    <div className="p-3 space-y-3">

      {/* ── Market Alerts ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Zap size={11} className="text-[#f59e0b]" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#94a3b8]">Market Alerts</span>
            {data?.stale && <span className="text-[8px] text-[#f59e0b]">(cached)</span>}
          </div>
          <div className="flex items-center gap-2">
            {updatedTime && (
              <div className="flex items-center gap-1 text-[8px] text-[#475569]">
                <Clock size={8} />{updatedTime}
              </div>
            )}
            <button onClick={load} disabled={loading} className="text-[#475569] hover:text-[#94a3b8] transition-colors disabled:opacity-40">
              <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {loading && !data && (
          <div className="flex items-center gap-2 py-2">
            <RefreshCw size={10} className="animate-spin text-[#f59e0b]" />
            <span className="text-[10px] text-[#475569]">Scanning market news…</span>
          </div>
        )}
        {error && !data && <p className="text-[10px] text-[#ef4444]">{error}</p>}

        {alertLines.length > 0 && (
          <div className="space-y-1.5">
            {alertLines.map((line, i) => {
              const c = alertColor(line)
              return (
                <div key={i} className="flex items-start gap-2">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${DOT[c]}`} />
                  <p className={`text-[10px] leading-relaxed ${CLR[c]}`}>{line}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Chart Pattern Analysis ── */}
      {patterns.length > 0 && (
        <div className="border-t border-[#1e293b] pt-3">
          <div className="flex items-center gap-1.5 mb-2">
            <BarChart2 size={11} className="text-[#38bdf8]" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#94a3b8]">Chart Patterns</span>
          </div>
          <div className="space-y-1.5">
            {patterns.map((pt, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${DOT[pt.signal]}`} />
                <div>
                  <span className="text-[9px] font-semibold text-[#64748b] mr-1">{pt.label}:</span>
                  <span className={`text-[10px] ${CLR[pt.signal]}`}>{pt.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
