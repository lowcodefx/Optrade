import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { API_BASE, kiteAuthHeaders } from '@/core/services/apiClient'
import { ChevronDown, ChevronRight, Info, RefreshCw, Bookmark, BookmarkCheck, Flame, Newspaper, LineChart } from 'lucide-react'
import { SECTOR_STOCKS } from '../stockSectors'

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Fetch ─────────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

  // Doji (open ≈ close within 0.3% of day range)
  const range = last.h - last.l
  if (range > 0 && Math.abs(last.c - last.o) / range < 0.1)
    return 'Doji — indecision at this level'

  // Hammer (long lower wick, small body near top)
  const body = Math.abs(last.c - last.o)
  const lowerWick = Math.min(last.c, last.o) - last.l
  if (lowerWick > body * 2 && last.c > last.o)
    return 'Hammer — potential reversal signal'

  return 'No clear pattern'
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

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

// ── Price chart SVG ───────────────────────────────────────────────────────────

function PriceChart({ hist }: { hist: HistoryData }) {
  const prices  = hist.prices
  const volumes = hist.volumes
  if (prices.length < 2) return <div className="flex items-center justify-center h-32 text-[#334155] text-xs">No data</div>

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
        const barColor = hist.candles[i] ? (hist.candles[i].c >= hist.candles[i].o ? '#22c55e' : '#ef4444') : '#334155'
        return <rect key={i} x={bX.toFixed(1)} y={bY.toFixed(1)} width={bW.toFixed(1)} height={bH.toFixed(1)} fill={barColor} fillOpacity="0.5" />
      })}

      {/* Date labels */}
      {hist.candles.filter((_, i) => i % Math.max(1, Math.floor(n / 4)) === 0).map((c, i, arr) => {
        const origIdx = i * Math.max(1, Math.floor(n / 4))
        const x = px(origIdx)
        const label = new Date(c.t).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
        if (i === arr.length - 1 && origIdx < n - 1) return null
        return (
          <text key={i} x={x.toFixed(1)} y={(H - 1).toFixed(1)} textAnchor="middle" fontSize="7" fill="#334155">
            {label}
          </text>
        )
      })}
    </svg>
  )
}

// ── Chart modal ───────────────────────────────────────────────────────────────

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
                ₹{stock.last_price.toLocaleString('en-IN')}
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
            <div className="flex items-center justify-center h-28 text-[#334155] text-xs">
              Connect Zerodha for live chart
            </div>
          )}
        </div>

        {/* Stats row */}
        {(hi10d || lo10d) && (
          <div className="flex gap-4 text-[10px]">
            <span className="text-[#475569]">10d Hi <span className="text-[#22c55e] font-semibold">₹{hi10d}</span></span>
            <span className="text-[#475569]">10d Lo <span className="text-[#ef4444] font-semibold">₹{lo10d}</span></span>
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

// ── Info modal (score + news) ─────────────────────────────────────────────────

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

          {newsLoading && <div className="text-[#334155] text-[9px]">Analysing news with Claude…</div>}

          {/* Claude verdict */}
          {!newsLoading && newsData?.sentiment && (() => {
            const v = newsData.sentiment!
            const cfg = {
              BULLISH: { bg: 'bg-[#22c55e]/10', text: 'text-[#22c55e]', border: 'border-[#22c55e]/30', icon: '↑' },
              BEARISH: { bg: 'bg-[#ef4444]/10', text: 'text-[#ef4444]', border: 'border-[#ef4444]/30', icon: '↓' },
              NEUTRAL: { bg: 'bg-[#475569]/10', text: 'text-[#475569]', border: 'border-[#475569]/30', icon: '—' },
              MIXED:   { bg: 'bg-[#f59e0b]/10', text: 'text-[#f59e0b]', border: 'border-[#f59e0b]/30', icon: '↕' },
            }[v.verdict] ?? { bg: 'bg-[#475569]/10', text: 'text-[#475569]', border: 'border-[#475569]/30', icon: '?' }
            return (
              <div className={`rounded-lg px-3 py-2.5 border ${cfg.bg} ${cfg.border} space-y-1`}>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${cfg.text}`}>{cfg.icon}</span>
                  <span className={`text-[10px] font-bold ${cfg.text}`}>{v.verdict}</span>
                  <span className="text-[8px] text-[#334155] ml-auto">Claude Haiku</span>
                </div>
                <p className="text-[#cbd5e1] text-[9px] leading-snug">{v.summary}</p>
              </div>
            )
          })()}

          {/* Raw headlines */}
          {!newsLoading && !newsData?.articles.length && <div className="text-[#334155] text-[9px]">No recent news found</div>}
          {newsData?.articles.map((a, i) => (
            <div key={i} className="space-y-0.5 pl-1 border-l border-[#1e293b]">
              <p className="text-[#64748b] text-[9px] leading-snug">{a.title}</p>
              <div className="flex items-center gap-2">
                <span className="text-[#334155] text-[8px]">{a.source}</span>
                <span className="text-[#334155] text-[8px]">· {timeAgo(a.publishedAt)}</span>
              </div>
            </div>
          ))}
        </div>

        <button onClick={onClose} className="w-full text-[#475569] text-[10px] hover:text-white transition-colors">Close</button>
      </div>
    </div>
  )
}

// ── Stock row ─────────────────────────────────────────────────────────────────

function StockRow({ stock, rank, cap, onInfo, onWatchlist, inWatchlist }: {
  stock: StockScore
  rank?: number
  cap?: string
  onInfo: () => void
  onWatchlist: () => void
  inWatchlist: boolean
}) {
  const [showChart, setShowChart] = useState(false)
  const scoreColor = stock.totalScore >= 70 ? 'text-[#22c55e]' : stock.totalScore >= 50 ? 'text-[#f59e0b]' : 'text-[#ef4444]'
  const capColor   = cap === 'L' ? 'text-[#38bdf8]' : cap === 'M' ? 'text-[#a78bfa]' : 'text-[#f59e0b]'
  const pctPos     = (stock.pct_change ?? 0) >= 0

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#0f1f35] hover:bg-[#0a1628] transition-colors">
        {rank !== undefined && (
          <span className="text-[9px] font-bold text-[#334155] w-4 shrink-0 text-right">{rank}</span>
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
                <span className="text-[#e2e8f0] text-[10px] font-semibold">₹{stock.last_price.toLocaleString('en-IN')}</span>
                {stock.pct_change != null && (
                  <span className={`text-[9px] font-semibold ${pctPos ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                    {pctPos ? '+' : ''}{stock.pct_change}%
                  </span>
                )}
              </>
            ) : (
              <span className="text-[#334155] text-[9px]">price unavailable</span>
            )}
            {stock.rs1d != null && <RSBadge rs={stock.rs1d} />}
          </div>
        </div>
        <span className={`text-sm font-bold w-8 text-right shrink-0 ${scoreColor}`}>{stock.totalScore}</span>
        <button onClick={() => setShowChart(true)} className="text-[#334155] hover:text-[#38bdf8] shrink-0 transition-colors" title="Price chart">
          <LineChart size={12} />
        </button>
        <button onClick={onWatchlist} className={`shrink-0 transition-colors ${inWatchlist ? 'text-[#38bdf8]' : 'text-[#334155] hover:text-[#64748b]'}`}>
          {inWatchlist ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
        </button>
        <button onClick={onInfo} className="text-[#334155] hover:text-[#64748b] shrink-0 transition-colors" title="Score details + news">
          <Info size={12} />
        </button>
      </div>
      {showChart && <ChartModal stock={stock} onClose={() => setShowChart(false)} />}
    </>
  )
}

// ── Top 10 view ───────────────────────────────────────────────────────────────

function Top10View({ data, onWatchlist, watchlist, heldSymbols, sectorFilter }: {
  data: AnalysisResult
  onWatchlist: (s: string) => void
  watchlist: string[]
  heldSymbols: string[]
  sectorFilter: string | null
}) {
  const [infoStock, setInfoStock] = useState<StockScore | null>(null)

  let all = allStocksSorted(data).filter(s => !heldSymbols.includes(s.symbol))
  if (sectorFilter && SECTOR_STOCKS[sectorFilter]) {
    all = all.filter(s => SECTOR_STOCKS[sectorFilter].includes(s.symbol))
  }
  const top10 = all.slice(0, 10)

  return (
    <div>
      {sectorFilter && (
        <div className="px-3 py-1.5 bg-[#0a1628] border-b border-[#1e293b]">
          <span className="text-[9px] text-[#94a3b8]">Sector: <span className="text-[#38bdf8] font-bold">{sectorFilter}</span></span>
        </div>
      )}
      <div className="flex items-center px-3 py-1.5 border-b border-[#0f1f35] bg-[#060d1a]">
        <span className="text-[8px] text-[#334155] flex-1">Symbol · Price · RS</span>
        <span className="text-[8px] text-[#334155]">Score  Chart  Save  Info</span>
      </div>
      {top10.length === 0 && (
        <div className="py-8 text-center text-[#334155] text-[10px]">No stocks in this sector</div>
      )}
      {top10.map((s, i) => (
        <StockRow
          key={s.symbol}
          stock={s}
          rank={i + 1}
          cap={s.cap}
          onInfo={() => setInfoStock(s)}
          onWatchlist={() => onWatchlist(s.symbol)}
          inWatchlist={watchlist.includes(s.symbol)}
        />
      ))}
      {infoStock && <InfoModal stock={infoStock} onClose={() => setInfoStock(null)} />}
    </div>
  )
}

// ── By-category accordion view ────────────────────────────────────────────────

function AccordionSection({ title, stocks, defaultOpen, onWatchlist, watchlist, sectorFilter }: {
  title: string
  stocks: StockScore[]
  defaultOpen?: boolean
  onWatchlist: (s: string) => void
  watchlist: string[]
  sectorFilter: string | null
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
          <span className="text-[8px] text-[#334155]">{visible.length} stocks</span>
        </div>
      </button>
      {open && visible.map(s => (
        <StockRow
          key={s.symbol}
          stock={s}
          onInfo={() => setInfoStock(s)}
          onWatchlist={() => onWatchlist(s.symbol)}
          inWatchlist={watchlist.includes(s.symbol)}
        />
      ))}
      {infoStock && <InfoModal stock={infoStock} onClose={() => setInfoStock(null)} />}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type Tab = 'top10' | 'all'

export function TopStocksBucket({ onAddToWatchlist, watchlist, selectedSector }: {
  onAddToWatchlist: (s: string) => void
  watchlist: string[]
  selectedSector: string | null
}) {
  const [tab, setTab] = useState<Tab>('top10')
  const qc = useQueryClient()

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
            <Flame size={10} />Top 10 Today
          </button>
          <button
            onClick={() => setTab('all')}
            className={`px-3 py-1.5 text-[10px] font-bold border-b-2 transition-colors ${
              tab === 'all' ? 'border-[#38bdf8] text-[#38bdf8]' : 'border-transparent text-[#475569] hover:text-[#94a3b8]'
            }`}
          >
            All Stocks
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <RefreshCw size={20} className="animate-spin text-[#a78bfa]" />
          <p className="text-[#475569] text-xs text-center max-w-[200px]">Analysing with AI…<br/>~30 seconds</p>
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
        />
      )}

      {data && tab === 'all' && (
        <>
          <AccordionSection title="Large Cap" stocks={data.largeCap} defaultOpen onWatchlist={onAddToWatchlist} watchlist={watchlist} sectorFilter={selectedSector} />
          <AccordionSection title="Mid Cap"   stocks={data.midCap}             onWatchlist={onAddToWatchlist} watchlist={watchlist} sectorFilter={selectedSector} />
          <AccordionSection title="Small Cap" stocks={data.smallCap}           onWatchlist={onAddToWatchlist} watchlist={watchlist} sectorFilter={selectedSector} />
        </>
      )}

    </div>
  )
}
