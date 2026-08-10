import { useState } from 'react'
import { ArrowLeft, BarChart2, Bot, BookOpen, X, Sparkles } from 'lucide-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StocksHeader } from './components/StocksHeader'
import { TopStocksBucket } from './components/TopStocksBucket'
import { HoldingsBucket } from './components/HoldingsBucket'
import { StockChatbot } from './components/StockChatbot'
import type { ScoredStock } from './components/StockChatbot'
import { EventsCalendar } from './components/EventsCalendar'
import { LogEntryModal, TradeLogPanel } from './components/TradeLog'
import type { TradeLogEntry } from './components/TradeLog'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })

export function StocksPage() {
  const [chatbotOpen, setChatbotOpen]   = useState(false)
  const [tradeLogOpen, setTradeLogOpen] = useState(false)
  const [chatbotPicks, setChatbotPicks] = useState<ScoredStock[]>([])
  const [pendingLog, setPendingLog]     = useState<{ symbol: string; price: number; action: 'buy' | 'watchlist' } | null>(null)
  const [tradeLogKey, setTradeLogKey]   = useState(0)
  const [watchlist, setWatchlist]       = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('sw_watchlist') ?? '[]') } catch { return [] }
  })

  function addToWatchlist(symbol: string, price?: number) {
    setWatchlist(prev => {
      if (prev.includes(symbol)) return prev
      const next = [...prev, symbol]
      localStorage.setItem('sw_watchlist', JSON.stringify(next))
      setPendingLog({ symbol, price: price ?? 0, action: 'watchlist' })
      return next
    })
  }

  function handleSave(_entry: TradeLogEntry) {
    setPendingLog(null)
    setTradeLogKey(k => k + 1)
  }

  return (
    <QueryClientProvider client={qc}>
      <div className="min-h-screen bg-[#060d1a] flex flex-col overflow-hidden" style={{ height: '100dvh' }}>

        {/* ── Top nav ── */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[#1e293b] shrink-0 bg-[#0a1628]">
          <button onClick={() => window.location.href = '/'} className="text-[#64748b] hover:text-[#94a3b8] transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <BarChart2 size={15} className="text-[#a78bfa]" />
            <span className="text-white font-bold text-sm tracking-wide">Optrade Swing</span>
          </div>
          <span className="text-[#64748b] text-[10px] ml-1">AI-powered swing picks</span>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setChatbotOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors border bg-[#a78bfa]/10 text-[#a78bfa] border-[#a78bfa]/25 hover:bg-[#a78bfa]/20"
            >
              <Bot size={11} />
              Chat Bot
              {chatbotPicks.length > 0 && (
                <span className="ml-0.5 text-[8px] bg-[#a78bfa]/30 px-1.5 py-0.5 rounded-full">{chatbotPicks.length}</span>
              )}
            </button>
            <button
              onClick={() => setTradeLogOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors border bg-[#38bdf8]/10 text-[#38bdf8] border-[#38bdf8]/25 hover:bg-[#38bdf8]/20"
            >
              <BookOpen size={11} />
              Trade Log
            </button>
          </div>
        </div>

        {/* ── Market indices ── */}
        <StocksHeader />

        {/* ── 3-column layout ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Col 1: Stock Picks */}
          <div className="w-[370px] shrink-0 border-r border-[#1e293b] flex flex-col overflow-hidden">
            <TopStocksBucket
              onAddToWatchlist={addToWatchlist}
              watchlist={watchlist}
              onLogEntry={(sym, price) => setPendingLog({ symbol: sym, price, action: 'buy' })}
              chatbotPicks={chatbotPicks}
            />
          </div>

          {/* Col 2: My Holdings (flex-1, largest) */}
          <div className="flex-1 min-w-0 border-r border-[#1e293b] flex flex-col overflow-hidden">
            <div className="flex items-center px-3 py-1.5 border-b border-[#1e293b] bg-[#0a1628] shrink-0">
              <span className="text-[8px] font-bold uppercase tracking-widest text-[#64748b]">My Holdings</span>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <HoldingsBucket />
            </div>
          </div>

          {/* Col 3: Events (220px) */}
          <div className="w-[220px] shrink-0 flex flex-col overflow-hidden">
            <div className="flex items-center px-3 py-1.5 border-b border-[#1e293b] bg-[#0a1628] shrink-0">
              <span className="text-[8px] font-bold uppercase tracking-widest text-[#64748b]">Events</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <EventsCalendar />
            </div>
          </div>

        </div>
      </div>

      {/* ── Chat Bot popup (centered modal) ── */}
      {chatbotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setChatbotOpen(false)}>
          <div
            className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl w-[380px] max-w-[95vw] flex flex-col shadow-2xl"
            style={{ height: '75vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1e293b] bg-[#060d1a] rounded-t-xl shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles size={11} className="text-[#a78bfa]" />
                <span className="text-white text-[11px] font-bold">Stock Assistant</span>
              </div>
              <button onClick={() => setChatbotOpen(false)} className="text-[#64748b] hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>
            <StockChatbot onPicks={setChatbotPicks} />
          </div>
        </div>
      )}

      {/* ── Trade Log popup (centered modal) ── */}
      {tradeLogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setTradeLogOpen(false)}>
          <div
            className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl w-[640px] max-w-[95vw] flex flex-col shadow-2xl"
            style={{ height: '75vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e293b] shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen size={13} className="text-[#38bdf8]" />
                <span className="text-white text-sm font-bold">Trade Log</span>
              </div>
              <button onClick={() => setTradeLogOpen(false)} className="text-[#64748b] hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <TradeLogPanel refreshKey={tradeLogKey} />
            </div>
          </div>
        </div>
      )}

      {pendingLog && (
        <LogEntryModal
          symbol={pendingLog.symbol}
          price={pendingLog.price}
          action={pendingLog.action}
          onSave={handleSave}
          onCancel={() => setPendingLog(null)}
        />
      )}
    </QueryClientProvider>
  )
}
