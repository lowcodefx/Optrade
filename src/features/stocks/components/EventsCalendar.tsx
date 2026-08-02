import { Calendar, TrendingUp, Building2, IndianRupee } from 'lucide-react'

interface CalEvent {
  date: string      // YYYY-MM-DD
  label: string
  type: 'earnings' | 'rbi' | 'macro' | 'ipo'
  symbol?: string
}

// Approximate schedule — update quarterly
const EVENTS: CalEvent[] = [
  // RBI MPC (bi-monthly; next ~Aug 6, Oct 9, Dec 4)
  { date: '2026-08-06', label: 'RBI MPC Decision', type: 'rbi' },
  { date: '2026-10-09', label: 'RBI MPC Decision', type: 'rbi' },
  { date: '2026-12-04', label: 'RBI MPC Decision', type: 'rbi' },

  // NSE F&O Expiry (last Thu of month)
  { date: '2026-08-27', label: 'NSE F&O Expiry',    type: 'macro' },
  { date: '2026-09-24', label: 'NSE F&O Expiry',    type: 'macro' },
  { date: '2026-10-29', label: 'NSE F&O Expiry',    type: 'macro' },

  // Q1 FY27 earnings season (Jul-Aug)
  { date: '2026-08-04', label: 'RELIANCE Q1 Results',   type: 'earnings', symbol: 'RELIANCE' },
  { date: '2026-08-08', label: 'HDFCBANK Q1 Results',   type: 'earnings', symbol: 'HDFCBANK' },
  { date: '2026-08-11', label: 'ICICIBANK Q1 Results',  type: 'earnings', symbol: 'ICICIBANK' },
  { date: '2026-08-14', label: 'INFY Q1 Results',       type: 'earnings', symbol: 'INFY' },
  { date: '2026-08-18', label: 'TCS Q1 Results',        type: 'earnings', symbol: 'TCS' },
  { date: '2026-08-20', label: 'WIPRO Q1 Results',      type: 'earnings', symbol: 'WIPRO' },
  { date: '2026-08-22', label: 'BHARTIARTL Q1 Results', type: 'earnings', symbol: 'BHARTIARTL' },
  { date: '2026-08-25', label: 'LT Q1 Results',         type: 'earnings', symbol: 'LT' },
  { date: '2026-08-27', label: 'KOTAKBANK Q1 Results',  type: 'earnings', symbol: 'KOTAKBANK' },
]

const TYPE_CFG = {
  earnings: { icon: TrendingUp,    bg: 'bg-[#22c55e]/10',  text: 'text-[#22c55e]',  dot: 'bg-[#22c55e]' },
  rbi:      { icon: Building2,    bg: 'bg-[#ef4444]/10',  text: 'text-[#ef4444]',  dot: 'bg-[#ef4444]' },
  macro:    { icon: IndianRupee,  bg: 'bg-[#f59e0b]/10',  text: 'text-[#f59e0b]',  dot: 'bg-[#f59e0b]' },
  ipo:      { icon: Calendar,     bg: 'bg-[#a78bfa]/10',  text: 'text-[#a78bfa]',  dot: 'bg-[#a78bfa]' },
}

function dayLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function daysUntil(iso: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const event = new Date(iso + 'T00:00:00')
  return Math.round((event.getTime() - today.getTime()) / 86400000)
}

export function EventsCalendar() {
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = EVENTS
    .filter(e => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 12)

  return (
    <div>
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-[#1e293b]">
        <Calendar size={11} className="text-[#a78bfa]" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#94a3b8]">Upcoming Events</span>
      </div>

      <div className="px-2 py-2 space-y-1">
        {upcoming.length === 0 && (
          <p className="text-[#334155] text-[9px] px-1 py-4 text-center">No upcoming events</p>
        )}
        {upcoming.map((e, i) => {
          const cfg  = TYPE_CFG[e.type]
          const days = daysUntil(e.date)
          const Icon = cfg.icon
          return (
            <div key={i} className={`flex items-start gap-2 rounded px-2 py-1.5 ${cfg.bg}`}>
              <Icon size={9} className={`${cfg.text} shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <div className="text-[9px] text-[#cbd5e1] font-semibold leading-snug truncate">{e.label}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[8px] font-bold ${cfg.text}`}>{dayLabel(e.date)}</span>
                  <span className="text-[#334155] text-[7px]">
                    {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `in ${days}d`}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="px-3 pb-2 flex flex-wrap gap-2 border-t border-[#1e293b] pt-2">
        {Object.entries(TYPE_CFG).map(([type, c]) => (
          <span key={type} className="flex items-center gap-1 text-[7px]">
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
            <span className="text-[#475569] capitalize">{type}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
