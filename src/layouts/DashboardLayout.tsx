import type { ReactNode } from 'react'
import { useMarketStore } from '@/core/store'
import { ChartFullscreenOverlay } from '@/features/chart/ChartFullscreenOverlay'

interface Props {
  header: ReactNode
  leftDock: ReactNode
  center: ReactNode
  rightDock: ReactNode
}

export function DashboardLayout({ header, leftDock, center, rightDock }: Props) {
  const chartFullscreen = useMarketStore(s => s.chartFullscreen)

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#060d1a]">
      {/* Header */}
      <div className="flex-shrink-0">{header}</div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Dock */}
        <div className="w-[260px] min-w-[260px] flex flex-col overflow-y-auto bg-[#0a1628] border-r border-[#1e293b]">
          {leftDock}
        </div>

        {/* Center — scrollable */}
        <div className="flex-1 overflow-y-auto bg-[#060d1a] min-w-0">
          {center}
        </div>

        {/* Right Dock */}
        <div className="w-[280px] min-w-[280px] flex flex-col bg-[#0a1628] border-l border-[#1e293b] overflow-y-auto">
          {rightDock}
        </div>
      </div>

      {/* Fullscreen overlay (portal-like, covers everything) */}
      {chartFullscreen && <ChartFullscreenOverlay />}
    </div>
  )
}
