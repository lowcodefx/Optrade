import { useState } from 'react'
import { usePositions } from '@/core/hooks/useMarketData'
import { tradingService } from '@/core/services/tradingService'
import { useQueryClient } from '@tanstack/react-query'
import { useMarketStore } from '@/core/store'
import { SectionCard } from '@/components/SectionCard'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { RefreshCw } from 'lucide-react'

const tooltip = {
  title: 'Open Positions',
  what: 'All currently open option positions with live P&L updating every second.',
  why: 'Real-time P&L visibility helps you manage positions and enforce stop-loss discipline.',
  how: 'Monitor LTP vs Entry. Exit immediately when SL hit. Trail SL when in profit.',
  bullish: 'CE position in profit with expanding premium = strong bullish move, consider trailing SL.',
  bearish: 'CE position in loss approaching SL = market turning, exit immediately.',
}

export function OpenPositions() {
  const { data: positions = [], isFetching, refetch } = usePositions()
  const optionChain = useMarketStore(s => s.optionChain)
  const qc = useQueryClient()
  const [exitError, setExitError] = useState<string | null>(null)
  const [exiting, setExiting] = useState<string | null>(null)

  // Resolve live LTP from option chain when available (chain refreshes every 3s,
  // positions poll every 1s — whichever is fresher wins)
  function liveLtp(strike: number, optionType: 'CE' | 'PE', fallback: number): number {
    if (!optionChain) return fallback
    const row = optionChain.strikes.find(s => s.strike === strike)
    const chainLtp = row?.[optionType === 'CE' ? 'ce' : 'pe']?.ltp
    return chainLtp && chainLtp > 0 ? chainLtp : fallback
  }

  async function exit(id: string) {
    setExiting(id)
    setExitError(null)
    try {
      await tradingService.exitPosition(id)
      qc.invalidateQueries({ queryKey: ['positions'] })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setExitError(`Exit failed: ${msg}`)
    } finally {
      setExiting(null)
    }
  }

  async function exitAll() {
    setExitError(null)
    try {
      await tradingService.exitAllPositions()
      qc.invalidateQueries({ queryKey: ['positions'] })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setExitError(`Exit failed: ${msg}`)
    }
  }

  const totalPnL = positions.reduce((a, p) => {
    const ltp = liveLtp(p.strike, p.optionType, p.ltp)
    return a + (ltp - p.entryPrice) * p.quantity
  }, 0)
  const totalExposure = positions.reduce((a, p) => a + p.entryPrice * p.quantity, 0)

  const posLabel = (
    <div className="flex items-center gap-1.5">
      {positions.length > 0 && (
        <span className="text-[9px] font-bold text-[#22c55e] bg-[#0d2b0d] px-1.5 py-0.5 rounded">{positions.length}</span>
      )}
      <button
        onClick={() => refetch()}
        disabled={isFetching}
        title="Refresh positions"
        className="text-[#475569] hover:text-[#38bdf8] transition-colors disabled:opacity-40"
      >
        <RefreshCw size={11} className={isFetching ? 'animate-spin' : ''} />
      </button>
    </div>
  )

  return (
    <SectionCard title="Open Positions" tooltip={tooltip} noPadding collapsible defaultOpen={true} badge={posLabel}>
      {positions.length === 0 ? (
        <div className="px-3 py-4 text-center text-[#475569] text-xs">No open positions</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className="text-[#475569] bg-[#0a1628]">
                  {['Instrument', 'Qty', 'Entry', 'LTP', 'P&L', ''].map(h => (
                    <th key={h} className={`py-1.5 px-2 font-medium ${h === '' || h === 'P&L' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positions.map(pos => {
                  const ltp = liveLtp(pos.strike, pos.optionType, pos.ltp)
                  const pnl = (ltp - pos.entryPrice) * pos.quantity
                  return (
                  <tr key={pos.positionId} className="border-b border-[#0f1f35] hover:bg-[#0a1628] transition-colors">
                    <td className="py-2 px-2 font-medium text-white">NIFTY {pos.strike} {pos.optionType}</td>
                    <td className="py-2 px-2 text-[#94a3b8]">{pos.quantity}</td>
                    <td className="py-2 px-2 text-[#94a3b8]">{formatNumber(pos.entryPrice, 2)}</td>
                    <td className="py-2 px-2 text-white font-medium">{formatNumber(ltp, 2)}</td>
                    <td className={`py-2 px-2 text-right font-bold ${pnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <button onClick={() => exit(pos.positionId)} disabled={exiting === pos.positionId}
                        className="bg-[#ef4444] text-white text-[9px] font-bold px-2 py-0.5 rounded hover:bg-[#dc2626] transition-colors disabled:opacity-50">
                        {exiting === pos.positionId ? '…' : 'Exit'}
                      </button>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {exitError && (
            <div className="mx-3 mt-2 p-2 bg-[#2b0d0d] border border-[#ef4444]/50 rounded text-[#ef4444] text-[9px]">
              {exitError}
            </div>
          )}
          <div className="px-3 py-2 flex items-center justify-between border-t border-[#0f1f35]">
            <div className="flex gap-4 text-[10px]">
              <span className="text-[#64748b]">Day P&L: <span className={`font-bold ${totalPnL >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}</span></span>
              <span className="text-[#64748b]">Exposure: <span className="text-white">{formatCurrency(totalExposure)}</span></span>
            </div>
            {positions.length > 0 && (
              <button onClick={exitAll} className="text-[#ef4444] text-[9px] border border-[#ef4444] px-2 py-0.5 rounded hover:bg-[#2d0a0a] transition-colors">
                Exit All
              </button>
            )}
          </div>
        </>
      )}
    </SectionCard>
  )
}
