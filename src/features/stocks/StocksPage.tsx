import { useState } from 'react'
import { ArrowLeft, BarChart2, Calendar, BookOpen } from 'lucide-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StocksHeader } from './components/StocksHeader'
import { TopStocksBucket } from './components/TopStocksBucket'
import { HoldingsBucket } from './components/HoldingsBucket'
import { StockChatbot } from './components/StockChatbot'
import { EventsCalendar } from './components/EventsCalendar'
import { LogEntryModal, TradeLogPanel } from './components/TradeLog'
import type { TradeLogEntry } from './components/TradeLog'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })

type RightBottomTab = 'events' | 'tradelog'

export function StocksPage() {
  const [bottomTab, setBottomTab] = useState<RightBottomTab>('events')
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

        {/* ── Main 2-column layout ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── Left: Stock Picks (flex-1) + Chatbot strip below ── */}
          <div className="flex-1 min-w-0 border-r border-[#1e293b] flex flex-col overflow-hidden">

            {/* Stock Picks — upper portion */}
            <div className="flex-1 min-h-0 overflow-y-auto border-b border-[#1e293b]">
              <TopStocksBucket
                onAddToWatchlist={addToWatchlist}
                watchlist={watchlist}
                onLogEntry={(sym, price) => setPendingLog({ symbol: sym, price, action: 'buy' })}
              />
            </div>

            {/* AI Chatbot — fixed-height strip at bottom of left column */}
            <div className="h-[260px] shrink-0 flex flex-col overflow-hidden">
              <StockChatbot />
            </div>

          </div>

          {/* ── Right: Holdings (large) + Events/Log ── */}
          <div className="w-[580px] shrink-0 flex flex-col overflow-hidden">

            {/* Holdings — upper 65% */}
            <div className="flex-[65] min-h-0 border-b border-[#1e293b] overflow-hidden flex flex-col">
              <HoldingsBucket />
            </div>

            {/* Events / Trade Log — lower 35% */}
            <div className="flex-[35] min-h-0 flex flex-col overflow-hidden">
              <div className="flex shrink-0 bg-[#0a1628] border-b border-[#1e293b]">
                {([
                  { id: 'events' as const,   Icon: Calendar,  label: 'Events'    },
                  { id: 'tradelog' as const, Icon: BookOpen,  label: 'Trade Log' },
                ] as const).map(({ id, Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => setBottomTab(id)}
                    className={`flex items-center gap-1 px-3 py-2 text-[9px] font-bold uppercase tracking-widest border-b-2 transition-colors ${
                      bottomTab === id
                        ? 'text-[#a78bfa] border-[#a78bfa]'
                        : 'text-[#64748b] border-transparent hover:text-[#94a3b8]'
                    }`}
                  >
                    <Icon size={9} />
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto">
                {bottomTab === 'events'   && <EventsCalendar />}
                {bottomTab === 'tradelog' && <TradeLogPanel refreshKey={tradeLogKey} />}
              </div>
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
