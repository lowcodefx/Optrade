import { useState } from 'react'
import { ArrowLeft, BarChart2, Calendar, BookOpen } from 'lucide-react'
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
  const [chatbotPicks, setChatbotPicks] = useState<ScoredStock[]>([])
  const [pendingLog, setPendingLog] = useState<{ symbol: string; price: number; action: 'buy' | 'watchlist' } | null>(null)
  const [tradeLogKey, setTradeLogKey] = useState(0)
  const [watchlist, setWatchlist] = useState<string[]>(() => {
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
        </div>

        {/* ── Market indices ── */}
        <StocksHeader />

        {/* ── 4-column layout ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Col 1: Chat Bot (190px) */}
          <div className="w-[190px] shrink-0 border-r border-[#1e293b] flex flex-col overflow-hidden">
            <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-[#1e293b] bg-[#0a1628] shrink-0">
              <span className="text-[8px] font-bold uppercase tracking-widest text-[#64748b]">Chat Bot</span>
            </div>
            <StockChatbot onPicks={setChatbotPicks} />
          </div>

          {/* Col 2: Stock Picks (330px) */}
          <div className="w-[330px] shrink-0 border-r border-[#1e293b] flex flex-col overflow-hidden">
            <TopStocksBucket
              onAddToWatchlist={addToWatchlist}
              watchlist={watchlist}
              onLogEntry={(sym, price) => setPendingLog({ symbol: sym, price, action: 'buy' })}
              chatbotPicks={chatbotPicks}
            />
          </div>

          {/* Col 3: My Holdings (flex-1, largest) */}
          <div className="flex-1 min-w-0 border-r border-[#1e293b] flex flex-col overflow-hidden">
            <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[#1e293b] bg-[#0a1628] shrink-0">
              <span className="text-[8px] font-bold uppercase tracking-widest text-[#64748b]">My Holdings</span>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <HoldingsBucket />
            </div>
          </div>

          {/* Col 4a: Events (170px) */}
          <div className="w-[170px] shrink-0 border-r border-[#1e293b] flex flex-col overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[#1e293b] bg-[#0a1628] shrink-0">
              <Calendar size={9} className="text-[#64748b]" />
              <span className="text-[8px] font-bold uppercase tracking-widest text-[#64748b]">Events</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <EventsCalendar />
            </div>
          </div>

          {/* Col 4b: Trade Log (170px) */}
          <div className="w-[170px] shrink-0 flex flex-col overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[#1e293b] bg-[#0a1628] shrink-0">
              <BookOpen size={9} className="text-[#64748b]" />
              <span className="text-[8px] font-bold uppercase tracking-widest text-[#64748b]">Trade Log</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <TradeLogPanel refreshKey={tradeLogKey} />
            </div>
          </div>

        </div>
      </div>

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
