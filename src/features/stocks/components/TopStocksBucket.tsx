import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { API_BASE, kiteAuthHeaders } from '@/core/services/apiClient'
import { ChevronDown, ChevronRight, Info, RefreshCw, Bookmark, BookmarkCheck } from 'lucide-react'

// ── Stock universe ────────────────────────────────────────────────────────────

const LARGE_CAP = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'BHARTIARTL', 'ITC', 'KOTAKBANK', 'LT', 'WIPRO']
const MID_CAP   = ['MPHASIS', 'PIIND', 'LTTS', 'COFORGE', 'PERSISTENT', 'ABCAPITAL', 'SONACOMS', 'LTIM', 'KALYANKJIL', 'AARTIIND']
const SMALL_CAP = ['TEJASNET', 'CRAFTSMAN', 'HAPPYMIND', 'MEDANTA', 'BIKAJI', 'SENCO', 'NEWGEN', 'CYIENT', 'IRIS', 'GREENPANEL']

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
}

interface AnalysisResult { largeCap: StockScore[]; midCap: StockScore[]; smallCap: StockScore[] }

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchStockAnalysis(): Promise<AnalysisResult> {
  const res = await fetch(`${API_BASE}/api/stock-analysis`, { headers: kiteAuthHeaders() })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

// ── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-16 h-1 bg-[#1e293b] rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  )
}

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

// ── Info modal ────────────────────────────────────────────────────────────────

function InfoModal({ stock, onClose }: { stock: StockScore; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-5 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-sm">{stock.symbol}</h3>
            <SignalBadge signal={stock.signal} />
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
            { label: 'Technical',    value: stock.technical,    color: 'bg-[#38bdf8]' },
            { label: 'Fundamental',  value: stock.fundamental,  color: 'bg-[#a78bfa]' },
            { label: 'Sentiment',    value: stock.sentiment,    color: 'bg-[#f59e0b]' },
            { label: 'Growth',       value: stock.growth,       color: 'bg-[#22c55e]' },
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

        <button onClick={onClose} className="w-full text-[#475569] text-[10px] hover:text-white transition-colors">Close</button>
      </div>
    </div>
  )
}

// ── Stock row ─────────────────────────────────────────────────────────────────

function StockRow({ stock, onInfo, onWatchlist, inWatchlist }: {
  stock: StockScore
  onInfo: () => void
  onWatchlist: () => void
  inWatchlist: boolean
}) {
  const scoreColor = stock.totalScore >= 70 ? 'text-[#22c55e]' : stock.totalScore >= 50 ? 'text-[#f59e0b]' : 'text-[#ef4444]'
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-[#0f1f35] hover:bg-[#0a1628] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white text-[10px] font-semibold">{stock.symbol}</span>
          <SignalBadge signal={stock.signal} />
        </div>
        <div className="flex gap-2 mt-1">
          <ScoreBar value={stock.technical}   color="bg-[#38bdf8]" />
          <ScoreBar value={stock.fundamental} color="bg-[#a78bfa]" />
          <ScoreBar value={stock.sentiment}   color="bg-[#f59e0b]" />
          <ScoreBar value={stock.growth}      color="bg-[#22c55e]" />
        </div>
      </div>
      <span className={`text-sm font-bold w-8 text-right shrink-0 ${scoreColor}`}>{stock.totalScore}</span>
      <button onClick={onWatchlist} className={`shrink-0 transition-colors ${inWatchlist ? 'text-[#38bdf8]' : 'text-[#334155] hover:text-[#64748b]'}`}>
        {inWatchlist ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
      </button>
      <button onClick={onInfo} className="text-[#334155] hover:text-[#64748b] shrink-0 transition-colors">
        <Info size={12} />
      </button>
    </div>
  )
}

// ── Accordion section ─────────────────────────────────────────────────────────

function AccordionSection({ title, stocks, defaultOpen, onWatchlist, watchlist }: {
  title: string
  stocks: StockScore[]
  defaultOpen?: boolean
  onWatchlist: (s: string) => void
  watchlist: string[]
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const [infoStock, setInfoStock] = useState<StockScore | null>(null)

  return (
    <div className="border-b border-[#1e293b]">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#0a1628] transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown size={12} className="text-[#475569]" /> : <ChevronRight size={12} className="text-[#475569]" />}
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">{title}</span>
          <span className="text-[8px] text-[#334155]">{stocks.length} stocks</span>
        </div>
        <div className="flex gap-1">
          {['T', 'F', 'S', 'G'].map((l, i) => (
            <span key={l} className={`text-[7px] ${['text-[#38bdf8]','text-[#a78bfa]','text-[#f59e0b]','text-[#22c55e]'][i]}`}>{l}</span>
          ))}
        </div>
      </button>

      {open && (
        <div>
          {stocks.map(s => (
            <StockRow
              key={s.symbol}
              stock={s}
              onInfo={() => setInfoStock(s)}
              onWatchlist={() => onWatchlist(s.symbol)}
              inWatchlist={watchlist.includes(s.symbol)}
            />
          ))}
        </div>
      )}

      {infoStock && <InfoModal stock={infoStock} onClose={() => setInfoStock(null)} />}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function TopStocksBucket({ onAddToWatchlist, watchlist }: {
  onAddToWatchlist: (s: string) => void
  watchlist: string[]
}) {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['stockAnalysis'],
    queryFn: fetchStockAnalysis,
    staleTime: 30 * 60 * 1000,
    retry: false,
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1e293b] bg-[#060d1a] sticky top-0 z-10">
        <div>
          <h2 className="text-[#e2e8f0] text-xs font-bold">Today's Top Picks</h2>
          <p className="text-[#334155] text-[8px]">T=Technical · F=Fundamental · S=Sentiment · G=Growth</p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching} className="text-[#475569] hover:text-[#94a3b8] disabled:opacity-40 transition-colors">
          <RefreshCw size={11} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <RefreshCw size={20} className="animate-spin text-[#a78bfa]" />
          <p className="text-[#475569] text-xs text-center max-w-[200px]">Analysing stocks with AI…<br/>This may take ~30 seconds</p>
        </div>
      )}

      {error && !data && (
        <div className="p-4 text-center">
          <p className="text-[#ef4444] text-[10px] mb-3">Analysis unavailable</p>
          <button onClick={() => refetch()} className="text-[#38bdf8] text-[10px] underline">Retry</button>
        </div>
      )}

      {data && (
        <>
          <AccordionSection title="Large Cap" stocks={data.largeCap} defaultOpen onWatchlist={onAddToWatchlist} watchlist={watchlist} />
          <AccordionSection title="Mid Cap"   stocks={data.midCap}   onWatchlist={onAddToWatchlist} watchlist={watchlist} />
          <AccordionSection title="Small Cap" stocks={data.smallCap} onWatchlist={onAddToWatchlist} watchlist={watchlist} />
        </>
      )}
    </div>
  )
}
