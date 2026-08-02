import { ArrowLeft, BarChart2 } from 'lucide-react'

export function StocksPage() {
  return (
    <div className="min-h-screen bg-[#060d1a] flex flex-col">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1e293b]">
        <button
          onClick={() => window.location.href = '/'}
          className="text-[#475569] hover:text-[#94a3b8] transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <BarChart2 size={18} className="text-[#a78bfa]" />
          <span className="text-white font-bold text-sm">Stock Investments</span>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-6">
        <div className="w-16 h-16 rounded-2xl bg-[#7c3aed]/10 border border-[#7c3aed]/20 flex items-center justify-center">
          <BarChart2 size={32} className="text-[#a78bfa]" />
        </div>
        <h2 className="text-white font-bold text-xl">Coming Soon</h2>
        <p className="text-[#475569] text-sm max-w-xs leading-relaxed">
          The stock investments dashboard is being designed. Check back soon.
        </p>
      </div>
    </div>
  )
}
