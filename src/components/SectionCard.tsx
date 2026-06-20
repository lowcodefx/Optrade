import { cn } from '@/lib/utils'
import { InfoTooltip, type TooltipContent } from './InfoTooltip'
import type { ReactNode } from 'react'

interface Props {
  title: string
  tooltip?: TooltipContent
  children: ReactNode
  className?: string
  noPadding?: boolean
}

export function SectionCard({ title, tooltip, children, className, noPadding }: Props) {
  return (
    <div className={cn('border-b border-[#1e293b]', className)}>
      <div className="flex items-center gap-1 px-3 pt-2.5 pb-2">
        <span className="text-[9px] text-[#64748b] uppercase tracking-widest font-medium">{title}</span>
        {tooltip && <InfoTooltip content={tooltip} />}
      </div>
      <div className={noPadding ? '' : 'px-3 pb-3'}>{children}</div>
    </div>
  )
}
