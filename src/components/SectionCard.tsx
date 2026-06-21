import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { InfoTooltip, type TooltipContent } from './InfoTooltip'
import type { ReactNode } from 'react'

interface Props {
  title: string
  tooltip?: TooltipContent
  children: ReactNode
  className?: string
  noPadding?: boolean
  collapsible?: boolean
  defaultOpen?: boolean
  badge?: ReactNode
}

export function SectionCard({ title, tooltip, children, className, noPadding, collapsible, defaultOpen = true, badge }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={cn('border-b border-[#1e293b]', className)}>
      <div
        className={cn('flex items-center gap-1 px-3 pt-2.5 pb-2', collapsible && 'cursor-pointer select-none hover:bg-[#0f1f35]/40 transition-colors')}
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
      >
        <span className="text-[9px] text-[#64748b] uppercase tracking-widest font-medium flex-1">{title}</span>
        {badge && <span className="mr-1">{badge}</span>}
        {tooltip && !collapsible && <InfoTooltip content={tooltip} />}
        {collapsible && (
          <ChevronDown
            size={12}
            className={cn('text-[#475569] transition-transform duration-200', open ? 'rotate-0' : '-rotate-90')}
          />
        )}
      </div>
      {(!collapsible || open) && (
        <div className={noPadding ? '' : 'px-3 pb-3'}>{children}</div>
      )}
    </div>
  )
}
