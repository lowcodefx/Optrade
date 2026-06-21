import { usePositions } from '@/core/hooks/useMarketData'
import { tradingService } from '@/core/services/tradingService'
import { useQueryClient } from '@tanstack/react-query'
import { SectionCard } from '@/components/SectionCard'
import { formatCurrency, formatNumber } from '@/lib/utils'

const tooltip = {
  title: 'Open Positions',
  what: 'All currently open option positions with live P&L updating every 3 seconds.',
  why: 'Real-time P&L visibility helps you manage positions and enforce stop-loss discipline.',
  how: 'Monitor LTP vs Entry. Exit immediately when SL hit. Trail SL when in profit.',
  bullish: 'CE position in profit with expanding premium = strong bullish move, consider trailing SL.',
  bearish: 'CE position in loss approaching SL = market turning, exit immediately.',
}

export function OpenPositions() {
  const { data: positions = [] } = usePositions()
  const qc = useQueryClient()

  async function exit(id: string) {
    await tradingService.exitPosition(id)
    qc.invalidateQueries({ queryKey: ['positions'] })
  }

  async function exitAll() {
    await tradingService.exitAllPositions()
    qc.invalidateQueries({ queryKey: ['positions'] })
  }

  const totalPnL = positions.reduce((a, p) => a + p.pnl, 0)
  const totalExposure = positions.reduce((a, p) => a + p.entryPrice * p.quantity, 0)

  const posLabel = positions.length > 0
    ? <span className="text-[9px] font-bold text-[#22c55e] bg-[#0d2b0d] px-1.5 py-0.5 rounded">{positions.length}</span>
    : undefined

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
                {positions.map(pos => (
                  <tr key={pos.positionId} className="border-b border-[#0f1f35] hover:bg-[#0a1628] transition-colors">
                    <td className="py-2 px-2 font-medium text-white">NIFTY {pos.strike} {pos.optionType}</td>
                    <td className="py-2 px-2 text-[#94a3b8]">{pos.quantity}</td>
                    <td className="py-2 px-2 text-[#94a3b8]">{formatNumber(pos.entryPrice, 2)}</td>
                    <td className="py-2 px-2 text-white font-medium">{formatNumber(pos.ltp, 2)}</td>
                    <td className={`py-2 px-2 text-right font-bold ${pos.pnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      {pos.pnl >= 0 ? '+' : ''}{formatCurrency(pos.pnl)}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <button onClick={() => exit(pos.positionId)} className="bg-[#ef4444] text-white text-[9px] font-bold px-2 py-0.5 rounded hover:bg-[#dc2626] transition-colors">
                        Exit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
