import { useEffect, useState } from 'react'
import { API_BASE, vmHeaders } from '@/core/services/apiClient'
import { useMarketStore } from '@/core/store'
import { Zap, TrendingUp, RefreshCw, Clock } from 'lucide-react'

interface SummaryData {
  summary: string
  updatedAt: string
  stale?: boolean
}

function alertColor(line: string): 'green' | 'red' | 'yellow' | 'gray' {
  const l = line.toLowerCase()
  if (l.includes('bullish')) return 'green'
  if (l.includes('bearish')) return 'red'
  if (l.includes('volatil') || l.includes('caution') || l.includes('uncertain')) return 'yellow'
  return 'gray'
}

const DOT: Record<'green' | 'red' | 'yellow' | 'gray', string> = {
  green:  'bg-[#22c55e]',
  red:    'bg-[#ef4444]',
  yellow: 'bg-[#f59e0b]',
  gray:   'bg-[#475569]',
}
const TEXT: Record<'green' | 'red' | 'yellow' | 'gray', string> = {
  green:  'text-[#cbd5e1]',
  red:    'text-[#cbd5e1]',
  yellow: 'text-[#cbd5e1]',
  gray:   'text-[#94a3b8]',
}

function paColor(signal: 'bullish' | 'bearish' | 'neutral'): 'green' | 'red' | 'gray' {
  if (signal === 'bullish') return 'green'
  if (signal === 'bearish') return 'red'
  return 'gray'
}

interface PAPoint { label: string; detail: string; signal: 'bullish' | 'bearish' | 'neutral' }

function usePriceActionPoints(): PAPoint[] {
  const quote     = useMarketStore(s => s.quote)
  const candles   = useMarketStore(s => s.candles)
  const ceScore   = useMarketStore(s => s.ceScore)
  const peScore   = useMarketStore(s => s.peScore)
  const prediction = useMarketStore(s => s.prediction1h)

  const points: PAPoint[] = []

  if (candles.length > 0) {
    const last = candles[candles.length - 1]
    if (last.vwap) {
      const aboveVWAP = last.close > last.vwap
      points.push({
        label: 'Price vs VWAP',
        detail: `${aboveVWAP ? 'Above' : 'Below'} VWAP (${last.vwap.toFixed(0)})`,
        signal: aboveVWAP ? 'bullish' : 'bearish',
      })
    }
    if (last.ema9 && last.ema20) {
      const bull = last.close > last.ema9 && last.ema9 > last.ema20
      const bear = last.close < last.ema9 && last.ema9 < last.ema20
      points.push({
        label: 'EMA Stack',
        detail: bull ? 'Price > EMA9 > EMA20 — bullish' : bear ? 'Price < EMA9 < EMA20 — bearish' : 'EMAs mixed — sideways',
        signal: bull ? 'bullish' : bear ? 'bearish' : 'neutral',
      })
    }
  }

  if (quote) {
    points.push({
      label: 'PCR',
      detail: `${quote.pcr.toFixed(2)} — ${quote.pcr > 1.2 ? 'Put heavy, bullish bias' : quote.pcr < 0.8 ? 'Call heavy, bearish bias' : 'Neutral'}`,
      signal: quote.pcr > 1.2 ? 'bullish' : quote.pcr < 0.8 ? 'bearish' : 'neutral',
    })
    points.push({
      label: 'VIX',
      detail: `${quote.vix.toFixed(1)} — ${quote.vix > 20 ? 'Elevated, expect swings' : quote.vix < 13 ? 'Low, calm market' : 'Normal range'}`,
      signal: quote.vix > 20 ? 'bearish' : 'neutral',
    })
  }

  if (ceScore > 0 || peScore > 0) {
    const dir = ceScore > peScore ? 'CE favoured' : peScore > ceScore ? 'PE favoured' : 'Balanced'
    points.push({
      label: 'Score',
      detail: `CE ${ceScore} / PE ${peScore} — ${dir}`,
      signal: ceScore > peScore + 50 ? 'bullish' : peScore > ceScore + 50 ? 'bearish' : 'neutral',
    })
  }

  if (prediction && prediction !== 'NEUTRAL') {
    points.push({
      label: '1h Prediction',
      detail: prediction,
      signal: prediction === 'BULLISH' ? 'bullish' : prediction === 'BEARISH' ? 'bearish' : 'neutral',
    })
  }

  return points
}

export function MarketSummary() {
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const paPoints = usePriceActionPoints()

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/market-summary`, { headers: vmHeaders() })
      if (!res.ok) throw new Error(`${res.status}`)
      setData(await res.json())
    } catch {
      setError('Alerts unavailable')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 10 * 60 * 1000)
    return () => clearInterval(interval)
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
                <Clock size={8} />
                {updatedTime}
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
                  <p className={`text-[10px] leading-relaxed ${TEXT[c]}`}>{line}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Price Action Analysis ── */}
      {paPoints.length > 0 && (
        <div className="border-t border-[#1e293b] pt-3">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp size={11} className="text-[#38bdf8]" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#94a3b8]">Price Action</span>
          </div>
          <div className="space-y-1.5">
            {paPoints.map((pt, i) => {
              const c = paColor(pt.signal)
              return (
                <div key={i} className="flex items-start gap-2">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${DOT[c]}`} />
                  <div>
                    <span className="text-[9px] font-semibold text-[#64748b] mr-1">{pt.label}:</span>
                    <span className={`text-[10px] ${TEXT[c]}`}>{pt.detail}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
