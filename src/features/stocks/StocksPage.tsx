import { useState } from 'react'
import { ArrowLeft, BarChart2, Star, TrendingUp, Briefcase, Calendar, BookOpen } from 'lucide-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StocksHeader } from './components/StocksHeader'
import { TopStocksBucket } from './components/TopStocksBucket'
import { HoldingsBucket } from './components/HoldingsBucket'
import { StocksWatchlist } from './components/StocksWatchlist'
import { EventsCalendar } from './components/EventsCalendar'
import { LogEntryModal, TradeLogPanel } from './components/TradeLog'
import type { TradeLogEntry } from './components/TradeLog'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })

type Tab = 'watchlist' | 'picks' | 'holdings' | 'events' | 'tradelog'

const TABS: Array<{ id: Tab; label: string; Icon: React.ElementType }> = [
  { id: 'watchlist', label: 'Watchlist',        Icon: Star },
  { id: 'picks',    label: 'Stock Picks',       Icon: TrendingUp },
  { id: 'holdings', label: 'My Holdings',       Icon: Briefcase },
  { id: 'events',   label: 'Upcoming Events',   Icon: Calendar },
  { id: 'tradelog', label: 'Trade Log',         Icon: BookOpen },
]

export function StocksPage() {
  const [tab, setTab] = useState<Tab>('picks')
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

        {/* ── Tab bar ── */}
        <div className="flex shrink-0 bg-[#0a1628] border-b border-[#1e293b] overflow-x-auto">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap border-b-2 transition-colors ${
                tab === id
                  ? 'text-[#a78bfa] border-[#a78bfa] bg-[#a78bfa]/5'
                  : 'text-[#475569] border-transparent hover:text-[#94a3b8] hover:bg-[#ffffff]/5'
              }`}
            >
              <Icon size={12} />
              {label}
              {id === 'watchlist' && watchlist.length > 0 && (
                <span className="ml-1 bg-[#a78bfa]/20 text-[#a78bfa] text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  {watchlist.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {tab === 'watchlist' && (
            <StocksWatchlist
              watchlist={watchlist}
              onRemove={removeFromWatchlist}
              onAdd={addToWatchlist}
            />
          )}
          {tab === 'picks' && (
            <TopStocksBucket
              onAddToWatchlist={addToWatchlist}
              watchlist={watchlist}
              onLogEntry={(sym, price) => setPendingLog({ symbol: sym, price, action: 'buy' })}
            />
          )}
          {tab === 'holdings' && <HoldingsBucket />}
          {tab === 'events'   && <EventsCalendar />}
          {tab === 'tradelog' && <TradeLogPanel refreshKey={tradeLogKey} />}
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
