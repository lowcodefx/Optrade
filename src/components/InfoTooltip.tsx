import { useState } from 'react'
import { Info } from 'lucide-react'

export interface TooltipContent {
  title: string
  what: string
  why: string
  how: string
  bullish: string
  bearish: string
}

interface Props {
  content: TooltipContent
}

export function InfoTooltip({ content }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="ml-1 text-[#334155] hover:text-[#38bdf8] transition-colors"
        title={content.title}
      >
        <Info size={11} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-[#0a1628] border border-[#1e3a5f] rounded-lg p-5 max-w-sm w-full mx-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[#38bdf8] font-semibold text-sm">{content.title}</h3>
              <button onClick={() => setOpen(false)} className="text-[#475569] hover:text-white text-lg leading-none">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div><div className="text-[#64748b] uppercase tracking-wider text-[9px] mb-1">What it means</div><p className="text-[#cbd5e1]">{content.what}</p></div>
              <div><div className="text-[#64748b] uppercase tracking-wider text-[9px] mb-1">Why it matters</div><p className="text-[#cbd5e1]">{content.why}</p></div>
              <div><div className="text-[#64748b] uppercase tracking-wider text-[9px] mb-1">How traders use it</div><p className="text-[#cbd5e1]">{content.how}</p></div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1e293b]">
                <div className="bg-[#0d2b0d] rounded p-2"><div className="text-[#22c55e] text-[9px] font-semibold mb-1">BULLISH</div><p className="text-[#86efac] text-[10px]">{content.bullish}</p></div>
                <div className="bg-[#2d0a0a] rounded p-2"><div className="text-[#ef4444] text-[9px] font-semibold mb-1">BEARISH</div><p className="text-[#fca5a5] text-[10px]">{content.bearish}</p></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
