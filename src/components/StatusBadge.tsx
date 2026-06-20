import { cn } from '@/lib/utils'

type Status = 'bullish' | 'bearish' | 'neutral' | 'strong' | 'moderate' | 'weak'

const map: Record<Status, { bg: string; text: string; label: string }> = {
  bullish: { bg: 'bg-[#0d2b0d] border-[#22c55e]', text: 'text-[#22c55e]', label: 'Bullish' },
  bearish: { bg: 'bg-[#2d0a0a] border-[#ef4444]', text: 'text-[#ef4444]', label: 'Bearish' },
  neutral: { bg: 'bg-[#2a1f00] border-[#f59e0b]', text: 'text-[#f59e0b]', label: 'Neutral' },
  strong: { bg: 'bg-[#0d2b0d] border-[#22c55e]', text: 'text-[#22c55e]', label: 'Strong' },
  moderate: { bg: 'bg-[#2a1f00] border-[#f59e0b]', text: 'text-[#f59e0b]', label: 'Moderate' },
  weak: { bg: 'bg-[#2d0a0a] border-[#ef4444]', text: 'text-[#ef4444]', label: 'Weak' },
}

interface Props {
  status: Status
  label?: string
  className?: string
}

export function StatusBadge({ status, label, className }: Props) {
  const s = map[status]
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border', s.bg, s.text, className)}>
      {label ?? s.label}
    </span>
  )
}
