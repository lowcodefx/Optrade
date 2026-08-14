import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { API_BASE, kiteAuthHeaders } from '@/core/services/apiClient'
import { useSettingsStore } from '@/core/store'
import { ChevronDown, ChevronRight, Info, RefreshCw, Bookmark, BookmarkCheck, Flame, Newspaper, LineChart, ShoppingCart, Bot } from 'lucide-react'
import { SECTOR_STOCKS, SECTOR_COLORS } from '../stockSectors'
import type { ScoredStock as ChatbotStock } from './StockChatbot'

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface StockScore {
  symbol: string
  totalScore: number
  technical: number
  fundamental: number
  sentiment: number
  growth: number
  summary: string
  signal: 'BUY' | 'WATCH' | 'AVOID'
  rs1d?: number | null
  last_price?: number | null
  pct_change?: number | null
  instrument_token?: number | null
}

interface CandleData { t: string; o: number; h: number; l: number; c: number; v: number }
interface HistoryData { prices: number[]; volumes: number[]; candles: CandleData[] }
interface KiteHolding { tradingsymbol: string }
interface NewsArticle { title: string; source: string; publishedAt: string }
interface NewsSentiment { verdict: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED'; summary: string }
interface NewsData { articles: NewsArticle[]; sentiment: NewsSentiment | null }
interface AnalysisResult { largeCap: StockScore[]; midCap: StockScore[]; smallCap: StockScore[] }

// â”€â”€ Fetch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function fetchStockAnalysis(): Promise<AnalysisResult> {
  const res = await fetch(`${API_BASE}/api/stock-analysis`, { headers: kiteAuthHeaders() })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

async function fetchStockHistory(token: number): Promise<HistoryData> {
  const res = await fetch(
    `${API_BASE}/api/stock-history?tokens=${token}`,
    { headers: kiteAuthHeaders() },
  )
  if (!res.ok) return { prices: [], volumes: [], candles: [] }
  const data = await res.json()
  return data[token] ?? { prices: [], volumes: [], candles: [] }
}

async function fetchStockNews(symbol: string): Promise<NewsData> {
  const res = await fetch(`${API_BASE}/api/stock-news?symbol=${encodeURIComponent(symbol)}`, { headers: kiteAuthHeaders() })
  if (!res.ok) return { articles: [], sentiment: null }
  return res.json()
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function allStocksSorted(data: AnalysisResult): (StockScore & { cap: string })[] {
  return [
    ...data.largeCap.map(s => ({ ...s, cap: 'L' })),
    ...data.midCap.map(s  => ({ ...s, cap: 'M' })),
    ...data.smallCap.map(s => ({ ...s, cap: 'S' })),
  ].sort((a, b) => b.totalScore - a.totalScore)
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function detectPattern(candles: CandleData[]): string {
  if (candles.length < 3) return ''
  const last = candles[candles.length - 1]
  const prev = candles[candles.length - 2]
  const prev2 = candles[candles.length - 3]

  // 3 consecutive green candles
  const last3Green = [prev2, prev, last].every(c => c.c > c.o)
  if (last3Green) return 'Bullish momentum (3 green candles)'

  // 3 consecutive red candles
  const last3Red = [prev2, prev, last].every(c => c.c < c.o)
  if (last3Red) return 'Bearish momentum (3 red candles)'

  // Bullish engulfing
  if (prev.c < prev.o && last.c > last.o && last.o < prev.c && last.c > prev.o)
    return 'Bullish engulfing pattern'

  // Bearish engulfing
  if (prev.c > prev.o && last.c < last.o && last.o > prev.c && last.c < prev.o)
    return 'Bearish engulfing pattern'

  // Doji (open â‰ˆ close within 0.3% of day range)
  const range = last.h - last.l
  if (range > 0 && Math.abs(last.c - last.o) / range < 0.1)
    return 'Doji - indecision at this level'

  // Hammer (long lower wick, small body near top)
  const body = Math.abs(last.c - last.o)
  const lowerWick = Math.min(last.c, last.o) - last.l
  if (lowerWick > body * 2 && last.c > last.o)
    return 'Hammer - potential reversal signal'

  return 'No clear pattern'
}

function sectorMomentum(sectorName: string, data: AnalysisResult): number | null {
  const symbols   = SECTOR_STOCKS[sectorName] ?? []
  const allStocks = [...data.largeCap, ...data.midCap, ...data.smallCap]
  const matched   = allStocks.filter(s => symbols.includes(s.symbol) && s.rs1d !== null)
  if (!matched.length) return null
  const avg = matched.reduce((sum, s) => sum + (s.rs1d ?? 0), 0) / matched.length
  return +avg.toFixed(2)
}

// â”€â”€ Shared UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SignalBadge({ signal }: { signal: 'BUY' | 'WATCH' | 'AVOID' }) {
  const cfg = {
    BUY:   { bg: 'bg-[#22c55e]/15', text: 'text-[#22c55e]', border: 'border-[#22c55e]/30' },
    WATCH: { bg: 'bg-[#f59e0b]/15', text: 'text-[#f59e0b]', border: 'border-[#f59e0b]/30' },
    AVOID: { bg: 'bg-[#ef4444]/15', text: 'text-[#ef4444]', border: 'border-[#ef4444]/30' },
  }[signal]
  return (
    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {signal}
    </span>
  )
}

function RSBadge({ rs }: { rs: number | null | undefined }) {
  if (rs == null) return null
  const pos = rs >= 0
  return (
    <span className={`text-[7px] font-bold ${pos ? 'text-[#22c55e]' : 'text-[#ef4444]'}`} title="vs NIFTY">
      RS{pos ? '+' : ''}{rs.toFixed(1)}
    </span>
  )
}

// â”€â”€ Price chart SVG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function PriceChart({ hist }: { hist: HistoryData }) {
  const prices  = hist.prices
  const volumes = hist.volumes
  if (prices.length < 2) return <div className="flex items-center justify-center h-32 text-[#64748b] text-xs">No data</div>

  const W = 320, H = 120, volH = 22, padL = 40, padR = 8, padT = 8, padB = 4
  const chartH = H - volH - padT - padB
  const chartW = W - padL - padR
  const n      = prices.length

  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  const rngP  = maxP - minP || 1
  const maxV  = Math.max(...volumes) || 1

  const px = (i: number) => padL + (i / (n - 1)) * chartW
  const py = (p: number) => padT + chartH - ((p - minP) / rngP) * chartH

  const pts = prices.map((p, i) => `${px(i).toFixed(1)},${py(p).toFixed(1)}`).join(' ')
  const isUp = prices[n - 1] >= prices[0]
  const lineColor = isUp ? '#22c55e' : '#ef4444'

  // Area fill path
  const areaPath =
    `M ${px(0).toFixed(1)},${py(prices[0]).toFixed(1)} ` +
    prices.slice(1).map((p, i) => `L ${px(i + 1).toFixed(1)},${py(p).toFixed(1)}`).join(' ') +
    ` L ${px(n - 1).toFixed(1)},${(padT + chartH).toFixed(1)} L ${padL},${(padT + chartH).toFixed(1)} Z`

  const yLabels = [minP, (minP + maxP) / 2, maxP]

  return (
    <svg width={W} height={H} className="w-full">
      {/* Y axis grid + labels */}
      {yLabels.map((v, i) => {
        const y = py(v)
        return (
          <g key={i}>
            <line x1={padL} y1={y.toFixed(1)} x2={W - padR} y2={y.toFixed(1)} stroke="#1e293b" strokeWidth="0.5" />
            <text x={padL - 3} y={(y + 3).toFixed(1)} textAnchor="end" fontSize="7" fill="#475569">
              {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}
            </text>
          </g>
        )
      })}

      {/* Area fill */}
      <path d={areaPath} fill={lineColor} fillOpacity="0.06" />

      {/* Price line */}
      <polyline points={pts} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinejoin="round" />

      {/* Last point dot */}
      <circle cx={px(n - 1).toFixed(1)} cy={py(prices[n - 1]).toFixed(1)} r="3" fill={lineColor} />

      {/* Volume bars */}
      {volumes.map((v, i) => {
        const bW = Math.max(2, chartW / n - 2)
        const bH = (v / maxV) * (volH - 2)
        const bX = px(i) - bW / 2
        const bY = H - bH
        const barColor = hist.candles[i] ? (hist.candles[i].c >= hist.candles[i].o ? '#22c55e' : '#ef4444') : '#64748b'
        return <rect key={i} x={bX.toFixed(1)} y={bY.toFixed(1)} width={bW.toFixed(1)} height={bH.toFixed(1)} fill={barColor} fillOpacity="0.5" />
      })}

      {/* Date labels */}
      {hist.candles.filter((_, i) => i % Math.max(1, Math.floor(n / 4)) === 0).map((c, i, arr) => {
        const origIdx = i * Math.max(1, Math.floor(n / 4))
        const x = px(origIdx)
        const label = new Date(c.t).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
        if (i === arr.length - 1 && origIdx < n - 1) return null
        return (
          <text key={i} x={x.toFixed(1)} y={(H - 1).toFixed(1)} textAnchor="middle" fontSize="7" fill="#64748b">
            {label}
          </text>
        )
      })}
    </svg>
  )
}

// â”€â”€ Chart modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ChartModal({ stock, onClose }: { stock: StockScore; onClose: () => void }) {
  const token = stock.instrument_token
  const { data: hist, isLoading } = useQuery({
    queryKey: ['stockChart', token],
    queryFn: () => fetchStockHistory(token!),
    enabled: !!token,
    staleTime: 20 * 60 * 1000,
  })

  const pattern = hist ? detectPattern(hist.candles) : ''
  const prices  = hist?.prices ?? []
  const chg10d  = prices.length >= 2 ? ((prices[prices.length - 1] - prices[0]) / prices[0] * 100).toFixed(2) : null
  const hi10d   = prices.length ? Math.max(...prices).toFixed(2) : null
  const lo10d   = prices.length ? Math.min(...prices).toFixed(2) : null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-4 w-96 max-w-full space-y-3" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-sm">{stock.symbol}</span>
            <SignalBadge signal={stock.signal} />
            {stock.last_price && (
              <span className="text-white text-xs font-semibold">
                Rs.{stock.last_price.toLocaleString('en-IN')}
              </span>
            )}
          </div>
          {chg10d && (
            <span className={`text-xs font-bold ${parseFloat(chg10d) >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {parseFloat(chg10d) >= 0 ? '+' : ''}{chg10d}% (10d)
            </span>
          )}
        </div>

        {/* Chart */}
        <div className="bg-[#060d1a] rounded-lg p-2">
          {isLoading && (
            <div className="flex items-center justify-center h-28">
              <RefreshCw size={16} className="animate-spin text-[#475569]" />
            </div>
          )}
          {!isLoading && hist && <PriceChart hist={hist} />}
          {!isLoading && !token && (
            <div className="flex items-center justify-center h-28 text-[#64748b] text-xs">
              Connect Zerodha for live chart
            </div>
          )}
        </div>

        {/* Stats row */}
        {(hi10d || lo10d) && (
          <div className="flex gap-4 text-[10px]">
            <span className="text-[#475569]">10d Hi <span className="text-[#22c55e] font-semibold">Rs.{hi10d}</span></span>
            <span className="text-[#475569]">10d Lo <span className="text-[#ef4444] font-semibold">Rs.{lo10d}</span></span>
            {stock.rs1d != null && (
              <span className="text-[#475569]">vs NIFTY <span className={`font-semibold ${stock.rs1d >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{stock.rs1d >= 0 ? '+' : ''}{stock.rs1d}%</span></span>
            )}
          </div>
        )}

        {/* Pattern */}
        {pattern && (
          <div className="bg-[#0f1f35] rounded px-3 py-2">
            <div className="text-[8px] uppercase tracking-widest text-[#475569] mb-0.5">Price Action</div>
            <div className="text-[10px] text-[#cbd5e1]">{pattern}</div>
          </div>
        )}

        {/* AI summary */}
        <p className="text-[#64748b] text-[9px] leading-relaxed">{stock.summary}</p>

        <button onClick={onClose} className="w-full text-[#475569] text-[10px] hover:text-white transition-colors">Close</button>
      </div>
    </div>
  )
}

// â”€â”€ Info modal (score + news) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function InfoModal({ stock, onClose }: { stock: StockScore; onClose: () => void }) {
  const { data: newsData, isLoading: newsLoading } = useQuery({
    queryKey: ['stockNews', stock.symbol],
    queryFn: () => fetchStockNews(stock.symbol),
    staleTime: 30 * 60 * 1000,
    retry: false,
  })

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-5 max-w-sm w-full space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-white font-bold text-sm">{stock.symbol}</h3>
            <div className="flex items-center gap-2">
              <SignalBadge signal={stock.signal} />
              {stock.rs1d != null && <RSBadge rs={stock.rs1d} />}
            </div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${stock.totalScore >= 70 ? 'text-[#22c55e]' : stock.totalScore >= 50 ? 'text-[#f59e0b]' : 'text-[#ef4444]'}`}>
              {stock.totalScore}
            </div>
            <div className="text-[8px] text-[#475569]">/ 100</div>
          </div>
        </div>

        <div className="space-y-2">
          {[
            { label: 'Technical',   value: stock.technical,   color: 'bg-[#38bdf8]' },
            { label: 'Fundamental', value: stock.fundamental, color: 'bg-[#a78bfa]' },
            { label: 'Sentiment',   value: stock.sentiment,   color: 'bg-[#f59e0b]' },
            { label: 'Growth',      value: stock.growth,      color: 'bg-[#22c55e]' },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-3">
              <span className="text-[#64748b] text-[10px] w-24">{f.label}</span>
              <div className="flex-1 h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${f.color}`} style={{ width: `${f.value}%` }} />
              </div>
              <span className="text-[#94a3b8] text-[10px] w-6 text-right">{f.value}</span>
            </div>
          ))}
        </div>

        <p className="text-[#94a3b8] text-[10px] leading-relaxed border-t border-[#1e293b] pt-3">{stock.summary}</p>

        {/* News + Claude sentiment */}
        <div className="border-t border-[#1e293b] pt-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Newspaper size={10} className="text-[#38bdf8]" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#94a3b8]">News Sentiment</span>
          </div>

          {newsLoading && <div className="text-[#64748b] text-[9px]">Analysing news with Claude...</div>}

          {/* Claude verdict */}
          {!newsLoading && newsData?.sentiment && (() => {
            const v = newsData.sentiment!
            const cfg = {
              BULLISH: { bg: 'bg-[#22c55e]/10', text: 'text-[#22c55e]', border: 'border-[#22c55e]/30', icon: '^' },
              BEARISH: { bg: 'bg-[#ef4444]/10', text: 'text-[#ef4444]', border: 'border-[#ef4444]/30', icon: 'v' },
              NEUTRAL: { bg: 'bg-[#475569]/10', text: 'text-[#475569]', border: 'border-[#475569]/30', icon: '-' },
              MIXED:   { bg: 'bg-[#f59e0b]/10', text: 'text-[#f59e0b]', border: 'border-[#f59e0b]/30', icon: '~' },
            }[v.verdict] ?? { bg: 'bg-[#475569]/10', text: 'text-[#475569]', border: 'border-[#475569]/30', icon: '?' }
            return (
              <div className={`rounded-lg px-3 py-2.5 border ${cfg.bg} ${cfg.border} space-y-1`}>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${cfg.text}`}>{cfg.icon}</span>
                  <span className={`text-[10px] font-bold ${cfg.text}`}>{v.verdict}</span>
                  <span className="text-[8px] text-[#64748b] ml-auto">Claude Haiku</span>
                </div>
                <p className="text-[#cbd5e1] text-[9px] leading-snug">{v.summary}</p>
              </div>
            )
          })()}

          {/* Raw headlines */}
          {!newsLoading && !newsData?.articles.length && <div className="text-[#64748b] text-[9px]">No recent news found</div>}
          {newsData?.articles.map((a, i) => (
            <div key={i} className="space-y-0.5 pl-1 border-l border-[#1e293b]">
              <p className="text-[#64748b] text-[9px] leading-snug">{a.title}</p>
              <div className="flex items-center gap-2">
                <span className="text-[#64748b] text-[8px]">{a.source}</span>
                <span className="text-[#64748b] text-[8px]">&middot; {timeAgo(a.publishedAt)}</span>
              </div>
            </div>
          ))}
        </div>

        <button onClick={onClose} className="w-full text-[#475569] text-[10px] hover:text-white transition-colors">Close</button>
      </div>
    </div>
  )
}

// â”€â”€ Stock row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StockRow({ stock, rank, cap, onInfo, onWatchlist, inWatchlist, onBuy }: {
  stock: StockScore
  rank?: number
  cap?: string
  onInfo: () => void
  onWatchlist: () => void
  inWatchlist: boolean
  onBuy: (symbol: string, price: number) => void
}) {
  const [showChart, setShowChart] = useState(false)
  const scoreColor = stock.totalScore >= 70 ? 'text-[#22c55e]' : stock.totalScore >= 50 ? 'text-[#f59e0b]' : 'text-[#ef4444]'
  const capColor   = cap === 'L' ? 'text-[#38bdf8]' : cap === 'M' ? 'text-[#a78bfa]' : 'text-[#f59e0b]'
  const pctPos     = (stock.pct_change ?? 0) >= 0

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#0f1f35] hover:bg-[#0a1628] transition-colors">
        {rank !== undefined && (
          <span className="text-[9px] font-bold text-[#64748b] w-4 shrink-0 text-right">{rank}</span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-white text-[10px] font-semibold">{stock.symbol}</span>
            {cap && <span className={`text-[7px] font-bold ${capColor}`}>{cap === 'L' ? 'LG' : cap === 'M' ? 'MD' : 'SM'}</span>}
            <SignalBadge signal={stock.signal} />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {stock.last_price != null ? (
              <>
                <span className="text-[#e2e8f0] text-[10px] font-semibold">Rs.{stock.last_price.toLocaleString('en-IN')}</span>
                {stock.pct_change != null && (
                  <span className={`text-[9px] font-semibold ${pctPos ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                    {pctPos ? '+' : ''}{stock.pct_change}%
                  </span>
                )}
              </>
            ) : (
              <span className="text-[#64748b] text-[9px]">price unavailable</span>
            )}
            {stock.rs1d != null && <RSBadge rs={stock.rs1d} />}
          </div>
        </div>
        <span className={`text-sm font-bold w-8 text-right shrink-0 ${scoreColor}`}>{stock.totalScore}</span>
        <button onClick={() => setShowChart(true)} className="text-[#64748b] hover:text-[#38bdf8] shrink-0 transition-colors" title="Price chart">
          <LineChart size={12} />
        </button>
        <button onClick={onWatchlist} className={`shrink-0 transition-colors ${inWatchlist ? 'text-[#38bdf8]' : 'text-[#64748b] hover:text-[#64748b]'}`}>
          {inWatchlist ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
        </button>
        <button onClick={onInfo} className="text-[#64748b] hover:text-[#64748b] shrink-0 transition-colors" title="Score details + news">
          <Info size={12} />
        </button>
        <button
          title="Buy CNC"
          onClick={e => { e.stopPropagation(); onBuy(stock.symbol, stock.last_price ?? 0) }}
          className="p-1 rounded text-[#22c55e]/60 hover:text-[#22c55e] hover:bg-[#22c55e]/10 transition-colors shrink-0"
        >
          <ShoppingCart size={11} />
        </button>
      </div>
      {showChart && <ChartModal stock={stock} onClose={() => setShowChart(false)} />}
    </>
  )
}

// â”€â”€ Top 10 view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function applyPriceFilter(stocks: StockScore[], range: string): StockScore[] {
  if (range === 'all') return stocks
  return stocks.filter(s => {
    const p = s.last_price ?? 0
    if (range === '<100')     return p < 100
    if (range === '100-500')  return p >= 100  && p < 500
    if (range === '500-2000') return p >= 500  && p < 2000
    if (range === '2000+')    return p >= 2000
    return true
  })
}

function Top10View({ data, onWatchlist, watchlist, heldSymbols, sectorFilter, priceRange, onBuy }: {
  data: AnalysisResult
  onWatchlist: (s: string, price?: number) => void
  watchlist: string[]
  heldSymbols: string[]
  sectorFilter: string | null
  priceRange: string
  onBuy: (symbol: string, price: number) => void
}) {
  const [infoStock, setInfoStock] = useState<StockScore | null>(null)

  let all = allStocksSorted(data).filter(s => !heldSymbols.includes(s.symbol))
  if (sectorFilter && SECTOR_STOCKS[sectorFilter]) {
    all = all.filter(s => SECTOR_STOCKS[sectorFilter].includes(s.symbol))
  }
  all = applyPriceFilter(all, priceRange)
  const top10 = all.slice(0, 10)

  return (
    <div>
      {sectorFilter && (
        <div className="px-3 py-1.5 bg-[#0a1628] border-b border-[#1e293b]">
          <span className="text-[9px] text-[#94a3b8]">Sector: <span className="text-[#38bdf8] font-bold">{sectorFilter}</span></span>
        </div>
      )}
      <div className="px-3 py-1.5 bg-[#060d1a] border-b border-[#0f1f35] flex flex-wrap gap-x-2 gap-y-0.5">
        {['Fundamentals', 'Sentiment', 'Growth', 'Price action', 'Not in holdings'].map(tag => (
          <span key={tag} className="text-[7px] text-[#334155] font-medium">{tag}</span>
        ))}
      </div>
      <div className="flex items-center px-3 py-1.5 border-b border-[#0f1f35] bg-[#060d1a]">
        <span className="text-[8px] text-[#64748b] flex-1">Symbol &middot; Price &middot; RS</span>
        <span className="text-[8px] text-[#64748b]">Score  Chart  Save  Info</span>
      </div>
      {top10.length === 0 && (
        <div className="py-8 text-center text-[#64748b] text-[10px]">No stocks in this sector</div>
      )}
      {top10.map((s, i) => (
        <StockRow
          key={s.symbol}
          stock={s}
          rank={i + 1}
          cap={s.cap}
          onInfo={() => setInfoStock(s)}
          onWatchlist={() => onWatchlist(s.symbol, s.last_price ?? 0)}
          inWatchlist={watchlist.includes(s.symbol)}
          onBuy={onBuy}
        />
      ))}
      {infoStock && <InfoModal stock={infoStock} onClose={() => setInfoStock(null)} />}
    </div>
  )
}

// â”€â”€ By-category accordion view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AccordionSection({ title, stocks, defaultOpen, onWatchlist, watchlist, sectorFilter, onBuy }: {
  title: string
  stocks: StockScore[]
  defaultOpen?: boolean
  onWatchlist: (s: string, price?: number) => void
  watchlist: string[]
  sectorFilter: string | null
  onBuy: (symbol: string, price: number) => void
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const [infoStock, setInfoStock] = useState<StockScore | null>(null)

  const visible = sectorFilter && SECTOR_STOCKS[sectorFilter]
    ? stocks.filter(s => SECTOR_STOCKS[sectorFilter].includes(s.symbol))
    : stocks

  return (
    <div className="border-b border-[#1e293b]">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#0a1628] transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown size={12} className="text-[#475569]" /> : <ChevronRight size={12} className="text-[#475569]" />}
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">{title}</span>
          <span className="text-[8px] text-[#64748b]">{visible.length} stocks</span>
        </div>
      </button>
      {open && visible.map(s => (
        <StockRow
          key={s.symbol}
          stock={s}
          onInfo={() => setInfoStock(s)}
          onWatchlist={() => onWatchlist(s.symbol, s.last_price ?? 0)}
          inWatchlist={watchlist.includes(s.symbol)}
          onBuy={onBuy}
        />
      ))}
      {infoStock && <InfoModal stock={infoStock} onClose={() => setInfoStock(null)} />}
    </div>
  )
}

// â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type Tab = 'top10' | 'chatbot'

export function TopStocksBucket({ onAddToWatchlist, watchlist, onLogEntry, chatbotPicks = [] }: {
  onAddToWatchlist: (s: string, price?: number) => void
  watchlist: string[]
  onLogEntry?: (symbol: string, price: number, action: 'buy') => void
  chatbotPicks?: ChatbotStock[]
}) {
  const { maxPerStock } = useSettingsStore()
  const [tab, setTab]                   = useState<Tab>('top10')
  const [selectedSector, setSelectedSector] = useState<string | null>(null)
  const [priceRange, setPriceRange]     = useState<string>('all')
  const [buyStock, setBuyStock]         = useState<{ symbol: string; price: number } | null>(null)
  const [buyQty, setBuyQty]             = useState('1')
  const [buyError, setBuyError]         = useState<string | null>(null)
  const [buyLoading, setBuyLoading]     = useState(false)
  const [buySuccess, setBuySuccess]     = useState<string | null>(null)
  const qc = useQueryClient()

  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleBuy = (symbol: string, price: number) => {
    const suggestedQty = price > 0 ? Math.max(1, Math.floor(maxPerStock / price)) : 1
    setBuyStock({ symbol, price })
    setBuyQty(String(suggestedQty))
    setBuyError(null)
    setBuySuccess(null)
  }

  useEffect(() => () => { if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current) }, [])

  async function placeCNCOrder(symbol: string, price: number, qty: number): Promise<string> {
    const body = new URLSearchParams({
      exchange: 'NSE',
      tradingsymbol: symbol,
      transaction_type: 'BUY',
      quantity: String(qty),
      product: 'CNC',
      order_type: 'LIMIT',
      price: price.toFixed(2),
      validity: 'DAY',
    }).toString()

    const res = await fetch(`${API_BASE}/api/kite?kite_path=orders/regular`, {
      method: 'POST',
      headers: { ...kiteAuthHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`)
    return json.data?.order_id ?? 'placed'
  }

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['stockAnalysis'],
    queryFn: fetchStockAnalysis,
    staleTime: 30 * 60 * 1000,
    retry: false,
  })

  const holdings   = qc.getQueryData<KiteHolding[]>(['stockHoldings']) ?? []
  const heldSymbols = holdings.map(h => h.tradingsymbol)

  return (
    <div className="flex flex-col h-full">

      <div className="px-3 pt-2.5 border-b border-[#1e293b] bg-[#060d1a] sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[#e2e8f0] text-xs font-bold">Stock Picks</h2>
          <button onClick={() => refetch()} disabled={isFetching} className="text-[#475569] hover:text-[#94a3b8] disabled:opacity-40 transition-colors">
            <RefreshCw size={11} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="flex gap-0">
          <button
            onClick={() => setTab('top10')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold border-b-2 transition-colors ${
              tab === 'top10' ? 'border-[#22c55e] text-[#22c55e]' : 'border-transparent text-[#475569] hover:text-[#94a3b8]'
            }`}
          >
            <Flame size={10} />15-Day Picks
          </button>
          <button
            onClick={() => setTab('chatbot')}
            className={`flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold border-b-2 transition-colors ${
              tab === 'chatbot' ? 'border-[#a78bfa] text-[#a78bfa]' : 'border-transparent text-[#475569] hover:text-[#94a3b8]'
            }`}
          >
            <Bot size={9} />
            Chatbot{chatbotPicks.length > 0 && <span className="ml-0.5 text-[8px] bg-[#a78bfa]/20 text-[#a78bfa] px-1 rounded-full">{chatbotPicks.length}</span>}
          </button>
        </div>

        {/* Price range + Sector filter pills */}
        <div className="flex items-center gap-1 py-2 overflow-x-auto scrollbar-none">
          {/* Price range */}
          {[
            { key: 'all',   label: 'All prices' },
            { key: '<100',  label: '<₹100' },
            { key: '100-500',  label: '₹100-500' },
            { key: '500-2000', label: '₹500-2K' },
            { key: '2000+', label: '₹2K+' },
          ].map(r => (
            <button
              key={r.key}
              onClick={() => setPriceRange(r.key === priceRange ? 'all' : r.key)}
              className={`shrink-0 rounded px-2 py-0.5 text-[8px] font-bold transition-colors ${
                priceRange === r.key && r.key !== 'all'
                  ? 'bg-[#f59e0b]/20 text-[#f59e0b] ring-1 ring-[#f59e0b]/50'
                  : r.key === 'all' && priceRange === 'all'
                    ? 'bg-[#1e293b] text-[#64748b]'
                    : 'bg-[#1e293b]/50 text-[#475569] hover:text-[#94a3b8]'
              }`}
            >{r.label}</button>
          ))}
          <span className="text-[#1e293b] mx-0.5">|</span>
          {Object.keys(SECTOR_STOCKS).map(name => {
            const c      = SECTOR_COLORS[name]
            const active = selectedSector === name
            const mom    = data ? sectorMomentum(name, data) : null
            return (
              <button
                key={name}
                onClick={() => setSelectedSector(active ? null : name)}
                title={data ? `Avg RS vs NIFTY: ${mom?.toFixed(2) ?? 'n/a'}%` : name}
                className={`shrink-0 rounded px-2 py-0.5 text-[8px] font-bold transition-colors flex items-center gap-0.5 ${
                  active
                    ? `${c.activeBg} ${c.text} ring-1 ring-current`
                    : `${c.bg} ${c.text}`
                }`}
              >
                {name}
                {mom !== null && (
                  mom >= 1.0
                    ? <span className="text-[7px] text-[#22c55e] leading-none">+</span>
                    : mom <= -1.0
                      ? <span className="text-[7px] text-[#ef4444] leading-none">-</span>
                      : <span className="text-[7px] text-[#475569] leading-none">=</span>
                )}
              </button>
            )
          })}
          {selectedSector && (
            <button
              onClick={() => setSelectedSector(null)}
              className="shrink-0 rounded px-2 py-0.5 text-[8px] font-bold text-[#475569] bg-[#1e293b] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors ml-1"
            >
              x Clear
            </button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <RefreshCw size={20} className="animate-spin text-[#a78bfa]" />
          <p className="text-[#475569] text-xs text-center max-w-[200px]">Analysing with AI...<br/>~30 seconds</p>
        </div>
      )}

      {error && !data && (
        <div className="p-4 text-center">
          <p className="text-[#ef4444] text-[10px] mb-3">Analysis unavailable</p>
          <button onClick={() => refetch()} className="text-[#38bdf8] text-[10px] underline">Retry</button>
        </div>
      )}

      {data && tab === 'top10' && (
        <Top10View
          data={data}
          onWatchlist={onAddToWatchlist}
          watchlist={watchlist}
          heldSymbols={heldSymbols}
          sectorFilter={selectedSector}
          priceRange={priceRange}
          onBuy={handleBuy}
        />
      )}


      {tab === 'chatbot' && (
        chatbotPicks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-4">
            <Bot size={24} className="text-[#a78bfa]/40" />
            <p className="text-[#64748b] text-[10px]">No chatbot picks yet</p>
            <p className="text-[#475569] text-[9px]">Ask the chatbot a question — the matching stocks will appear here</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center px-3 py-1.5 border-b border-[#0f1f35] bg-[#060d1a]">
              <span className="text-[8px] text-[#64748b] flex-1">Symbol · Price · RS</span>
              <span className="text-[8px] text-[#64748b]">Score  Chart  Save  Info</span>
            </div>
            {chatbotPicks.map((s, i) => {
              const capChar = s.cap === 'LG' ? 'L' : s.cap === 'MD' ? 'M' : 'S'
              const asStock: StockScore = {
                symbol: s.symbol, totalScore: s.totalScore, signal: s.signal,
                rs1d: s.rs1d, last_price: s.last_price, pct_change: s.pct_change,
                technical: 0, fundamental: 0, sentiment: 0, growth: 0,
                summary: 'Filtered by AI chatbot',
              }
              return (
                <StockRow
                  key={s.symbol}
                  stock={asStock}
                  rank={i + 1}
                  cap={capChar}
                  onInfo={() => {}}
                  onWatchlist={() => onAddToWatchlist(s.symbol, s.last_price ?? 0)}
                  inWatchlist={watchlist.includes(s.symbol)}
                  onBuy={handleBuy}
                />
              )
            })}
          </div>
        )
      )}

      {buyStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setBuyStock(null)}>
          <div className="bg-[#0a1628] border border-[#1e293b] rounded-xl p-5 w-72 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold text-sm mb-3">Place CNC Buy - {buyStock.symbol}</h3>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-[10px]">
                <span className="text-[#475569]">Limit Price</span>
                <span className="text-white font-semibold">Rs.{buyStock.price.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#475569]">Quantity</span>
                <input
                  type="number" min="1" value={buyQty}
                  onChange={e => setBuyQty(e.target.value)}
                  className="flex-1 bg-[#060d1a] border border-[#1e293b] rounded px-2 py-1 text-white text-[10px] text-right focus:outline-none focus:border-[#38bdf8]"
                />
              </div>
              {(() => {
                const orderValue = buyStock.price * (parseInt(buyQty, 10) || 1)
                const overBudget = orderValue > maxPerStock * 1.2
                const underBudget = orderValue < maxPerStock * 0.5
                const valueColor = overBudget ? 'text-[#ef4444]' : underBudget ? 'text-[#f59e0b]' : 'text-[#22c55e]'
                return (
                  <>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-[#475569]">Order Value</span>
                      <span className={`font-semibold ${valueColor}`}>Rs.{orderValue.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-[#475569]">Budget limit</span>
                      <span className="text-[#475569]">Rs.{maxPerStock.toLocaleString('en-IN')}</span>
                    </div>
                    {overBudget && (
                      <p className="text-[8px] text-[#ef4444]">Order value exceeds budget limit — reduce quantity</p>
                    )}
                  </>
                )
              })()}
            </div>
            {buyError && <p className="text-[9px] text-[#ef4444] mb-2">{buyError}</p>}
            {buySuccess && <p className="text-[9px] text-[#22c55e] mb-2">Order placed - {buySuccess}</p>}
            <div className="flex gap-2">
              <button onClick={() => setBuyStock(null)} className="flex-1 py-1.5 rounded border border-[#1e293b] text-[10px] text-[#475569] hover:text-white">Cancel</button>
              <button
                disabled={buyLoading || parseInt(buyQty, 10) < 1}
                onClick={async () => {
                  setBuyError(null); setBuySuccess(null); setBuyLoading(true)
                  try {
                    const orderId = await placeCNCOrder(buyStock.symbol, buyStock.price, Math.max(1, parseInt(buyQty, 10) || 1))
                    setBuySuccess(`Order ID ${orderId}`)
                    // Auto-record today as buy date so age column populates immediately
                    try {
                      const dates = JSON.parse(localStorage.getItem('sw_buy_dates') ?? '{}')
                      dates[buyStock.symbol] = new Date().toISOString().slice(0, 10)
                      localStorage.setItem('sw_buy_dates', JSON.stringify(dates))
                    } catch { /* ignore */ }
                    onLogEntry?.(buyStock.symbol, buyStock.price, 'buy')
                    if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current)
                    autoCloseTimer.current = setTimeout(() => { setBuyStock(null); autoCloseTimer.current = null }, 2000)
                  } catch (err: unknown) {
                    setBuyError(err instanceof Error ? err.message : 'Order failed')
                  } finally {
                    setBuyLoading(false)
                  }
                }}
                className="flex-1 py-1.5 rounded bg-[#22c55e]/90 hover:bg-[#22c55e] disabled:opacity-50 text-white text-[10px] font-bold"
              >
                {buyLoading ? 'Placing...' : 'Confirm Buy'}
              </button>
            </div>
            <p className="text-[7px] text-[#64748b] text-center mt-2">CNC &middot; LIMIT &middot; NSE &middot; DAY</p>
          </div>
        </div>
      )}

    </div>
  )
}
