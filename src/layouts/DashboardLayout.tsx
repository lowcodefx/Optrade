import { useState } from 'react'
import type { ReactNode } from 'react'
import { useMarketStore } from '@/core/store'
import { ChartFullscreenOverlay } from '@/features/chart/ChartFullscreenOverlay'
import { LayoutDashboard, BarChart2, Zap } from 'lucide-react'

interface Props {
  header: ReactNode
  leftDock: ReactNode
  center: ReactNode
  rightDock: ReactNode
}

type MobileTab = 'overview' | 'trading' | 'order'

const MOBILE_TABS: Array<{ id: MobileTab; label: string; Icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { id: 'trading', label: 'Trading', Icon: BarChart2 },
  { id: 'order',   label: 'Order',    Icon: Zap },
]

export function DashboardLayout({ header, leftDock, center, rightDock }: Props) {
  const chartFullscreen = useMarketStore(s => s.chartFullscreen)
  const [mobileTab, setMobileTab] = useState<MobileTab>('trading')

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#060d1a]">
      {/* Header */}
      <div className="flex-shrink-0">{header}</div>

      {/* ── Mobile: top nav (below header) ── */}
      <nav className="md:hidden flex-shrink-0 flex border-b border-[#1e293b] bg-[#0a1628]">
        {MOBILE_TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setMobileTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[9px] font-semibold uppercase tracking-widest transition-colors ${
              mobileTab === id
                ? 'text-[#38bdf8] border-b-2 border-[#38bdf8]'
                : 'text-[#475569] border-b-2 border-transparent'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </nav>

      {/* ── Desktop: 3-column fixed layout ── */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <div className="w-[260px] min-w-[260px] flex flex-col overflow-hidden bg-[#0a1628] border-r border-[#1e293b]">
          {leftDock}
        </div>
        <div className="flex-1 overflow-y-auto bg-[#060d1a] min-w-0">
          {center}
        </div>
        <div className="w-[280px] min-w-[280px] flex flex-col bg-[#0a1628] border-l border-[#1e293b] overflow-y-auto">
          {rightDock}
        </div>
      </div>

      {/* ── Mobile: single panel ── */}
      <div className="flex md:hidden flex-1 min-h-0 overflow-y-auto bg-[#060d1a]">
        {mobileTab === 'overview' && <div className="w-full bg-[#0a1628]">{leftDock}</div>}
        {mobileTab === 'trading'  && <div className="w-full">{center}</div>}
        {mobileTab === 'order'    && <div className="w-full bg-[#0a1628]">{rightDock}</div>}
      </div>

      {chartFullscreen && <ChartFullscreenOverlay />}
    </div>
  )
}
