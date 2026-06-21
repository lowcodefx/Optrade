import { useEffect, useState } from 'react'
import { useLiveModeStore } from '@/core/services/tradingService'
import { AlertTriangle, X } from 'lucide-react'

export function SquareOffReminder() {
  const isLive = useLiveModeStore(s => s.isLive)
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!isLive || dismissed) return

    function check() {
      const now = new Date()
      const h = now.getHours()
      const m = now.getMinutes()
      // Show between 15:00 and 15:15
      if (h === 15 && m < 15) {
        setShow(true)
      } else if (h > 15 || (h === 15 && m >= 15)) {
        setShow(false)
      }
    }

    check()
    const t = setInterval(check, 30000)
    return () => clearInterval(t)
  }, [isLive, dismissed])

  if (!show) return null

  const now = new Date()
  const minutesLeft = 15 - now.getMinutes()

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div className="bg-[#1a0a00] border-2 border-[#f59e0b] rounded-xl p-4 shadow-2xl flex items-start gap-3">
        <AlertTriangle size={22} className="text-[#f59e0b] shrink-0 mt-0.5 animate-pulse" />
        <div className="flex-1 min-w-0">
          <div className="text-[#f59e0b] font-bold text-sm">⚡ Auto Square-off in ~{minutesLeft} min</div>
          <div className="text-[#d97706] text-xs mt-0.5">
            Zerodha will close all MIS positions at 3:15 PM. Exit now if you want to control your price.
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="mt-2 text-[10px] text-[#92400e] hover:text-[#f59e0b] underline transition-colors"
          >
            Dismiss for today
          </button>
        </div>
        <button
          onClick={() => setShow(false)}
          className="text-[#92400e] hover:text-[#f59e0b] transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
