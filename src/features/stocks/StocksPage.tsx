import { useState } from 'react'
import { ArrowLeft, BarChart2 } from 'lucide-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StocksHeader } from './components/StocksHeader'
import { TopStocksBucket } from './components/TopStocksBucket'
import { HoldingsBucket } from './components/HoldingsBucket'
import { StocksWatchlist } from './components/StocksWatchlist'
import { StockPortfolioSummary } from './components/StockPortfolioSummary'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })

export function StocksPage() {
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('sw_watchlist') ?? '[]') } catch { return [] }
  })
  const [selectedSector, setSelectedSector] = useState<string | null>(null)

  function addToWatchlist(symbol: string) {
    setWatchlist(prev => {
      const next = prev.includes(symbol) ? prev : [...prev, symbol]
      localStorage.setItem('sw_watchlist', JSON.stringify(next))
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

        {/* ── Main 3-column layout ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Left dock */}
          <div className="w-52 shrink-0 border-r border-[#1e293b] flex flex-col overflow-hidden">
            <StocksWatchlist
              watchlist={watchlist}
              onRemove={removeFromWatchlist}
              onAdd={addToWatchlist}
              selectedSector={selectedSector}
              onSectorSelect={setSelectedSector}
            />
          </div>

          {/* Center: two independent-scroll buckets */}
          <div className="flex flex-1 min-w-0 gap-0 divide-x divide-[#1e293b]">
            <div className="flex-1 overflow-y-auto min-w-0">
              <TopStocksBucket
                onAddToWatchlist={addToWatchlist}
                watchlist={watchlist}
                selectedSector={selectedSector}
              />
            </div>
            <div className="flex-1 overflow-y-auto min-w-0">
              <HoldingsBucket />
            </div>
          </div>

          {/* Right dock */}
          <div className="w-56 shrink-0 border-l border-[#1e293b] overflow-y-auto">
            <StockPortfolioSummary />
          </div>

        </div>
      </div>
    </QueryClientProvider>
  )
}
