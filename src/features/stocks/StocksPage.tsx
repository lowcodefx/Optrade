import { useState } from 'react'
import { ArrowLeft, BarChart2, Calendar, BookOpen } from 'lucide-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StocksHeader } from './components/StocksHeader'
import { TopStocksBucket } from './components/TopStocksBucket'
import { HoldingsBucket } from './components/HoldingsBucket'
import { StocksWatchlist } from './components/StocksWatchlist'
import { EventsCalendar } from './components/EventsCalendar'
import { LogEntryModal, TradeLogPanel } from './components/TradeLog'
import type { TradeLogEntry } from './components/TradeLog'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })

type RightTab = 'events' | 'tradelog'

export function StocksPage() {
  const [rightTab, setRightTab] = useState<RightTab>('events')
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('sw_watchlist') ?? '[]') } catch { return [] }
  })
  const [pendingLog, setPendingLog] = useState<{ symbol: string; price: number; action: 'buy' | 'watchlist' } | null>(null)
  const [tradeLogKey, setTradeLogKey] = useState(0)

  function addToWatchlist(symbol: string, price?: number) {
    setWatchlist(prev => {
      if (prev.includes(symbol)) return prev
      const next = [...prev, symbol]
      localStorage.setItem('sw_watchlist', JSON.stringify(next))
      setPendingLog({ symbol, price: price ?? 0, action: 'watchlist' })
      return next
    })
  }

  function removeFromWatchlist(symbol: string) {
    setWatchlist(prev => {
      const next = prev.filter(s => s !== symbol)
      localStorage.setItem('sw_watchlist', JSON.stringify(next))
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

        {/* ── Top nav bar ── */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[#1e293b] shrink-0 bg-[#0a1628]">
          <button onClick={() => window.location.href = '/'} className="text-[#475569] hover:text-[#94a3b8] transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <BarChart2 size={15} className="text-[#a78bfa]" />
            <span className="text-white font-bold text-sm tracking-wide">Optrade Swing</span>
          </div>
          <span className="text-[#334155] text-[10px] ml-1">AI-powered swing picks</span>
        </div>

        {/* ── Market indices header ── */}
        <StocksHeader />

        {/* ── Main layout: Left dock | Center | Right panel ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── Left: Watchlist (fixed 190px) ── */}
          <div className="w-[190px] shrink-0 border-r border-[#1e293b] flex flex-col overflow-hidden bg-[#060d1a]">
            <StocksWatchlist
              watchlist={watchlist}
              onRemove={removeFromWatchlist}
              onAdd={addToWatchlist}
            />
          </div>

          {/* ── Center: Stock Picks (flex-1, most space) ── */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-r border-[#1e293b]">
            <div className="flex-1 overflow-y-auto">
              <TopStocksBucket
                onAddToWatchlist={addToWatchlist}
                watchlist={watchlist}
                onLogEntry={(sym, price) => setPendingLog({ symbol: sym, price, action: 'buy' })}
              />
            </div>
          </div>

          {/* ── Right panel (320px): Holdings top + Events/Log bottom ── */}
          <div className="w-[320px] shrink-0 flex flex-col overflow-hidden bg-[#060d1a]">

            {/* Holdings — top 55% */}
            <div className="flex-[55] min-h-0 border-b border-[#1e293b] overflow-hidden flex flex-col">
              <HoldingsBucket />
            </div>

            {/* Events / Trade Log — bottom 45% */}
            <div className="flex-[45] min-h-0 flex flex-col overflow-hidden">

              {/* Mini tab bar */}
              <div className="flex shrink-0 border-b border-[#1e293b] bg-[#0a1628]">
                <button
                  onClick={() => setRightTab('events')}
                  className={`flex items-center gap-1 px-3 py-2 text-[9px] font-bold uppercase tracking-widest border-b-2 transition-colors ${
                    rightTab === 'events'
                      ? 'text-[#a78bfa] border-[#a78bfa]'
                      : 'text-[#475569] border-transparent hover:text-[#94a3b8]'
                  }`}
                >
                  <Calendar size={9} />
                  Events
                </button>
                <button
                  onClick={() => setRightTab('tradelog')}
                  className={`flex items-center gap-1 px-3 py-2 text-[9px] font-bold uppercase tracking-widest border-b-2 transition-colors ${
                    rightTab === 'tradelog'
                      ? 'text-[#a78bfa] border-[#a78bfa]'
                      : 'text-[#475569] border-transparent hover:text-[#94a3b8]'
                  }`}
                >
                  <BookOpen size={9} />
                  Trade Log
                </button>
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto">
                {rightTab === 'events'   && <EventsCalendar />}
                {rightTab === 'tradelog' && <TradeLogPanel refreshKey={tradeLogKey} />}
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
