import { useMarketStore } from '@/core/store'
import { ChartPanel } from './ChartPanel'
import { OptionsChain } from '@/features/options-chain/OptionsChain'
import { OptionSelection } from '@/features/option-selection/OptionSelection'
import { OpenPositions } from '@/features/positions/OpenPositions'
import { TradeJournal } from '@/features/journal/TradeJournal'
import { cn } from '@/lib/utils'

type TabId = 'chart' | 'chain' | 'journal'
const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'chart', label: '📈 Chart' },
  { id: 'chain', label: '📊 Options Chain' },
  { id: 'journal', label: '📓 Journal' },
]

export function CenterPanel() {
  const centerTab = useMarketStore(s => s.centerTab) as TabId
  const setCenterTab = useMarketStore(s => s.setCenterTab)

  return (
    <div>
      {/* Tab toggle */}
      <div className="flex items-center px-3 py-2 bg-[#0a1628] border-b border-[#1e293b] sticky top-0 z-10">
        <div className="flex gap-1 bg-[#060d1a] rounded p-0.5">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setCenterTab(id as 'chart' | 'chain')}
              className={cn(
                'text-[10px] font-semibold px-3 py-1 rounded transition-colors',
                centerTab === id ? 'bg-[#1e3a5f] text-[#38bdf8]' : 'text-[#475569] hover:text-white'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {centerTab === 'journal' ? (
        <TradeJournal />
      ) : (
        <>
          {centerTab === 'chart' ? <ChartPanel /> : <OptionsChain />}
          <OptionSelection />
          <OpenPositions />
        </>
      )}
    </div>
  )
}
