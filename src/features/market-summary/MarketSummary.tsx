import { useEffect, useState } from 'react'
import { API_BASE, vmHeaders } from '@/core/services/apiClient'
import { Zap, RefreshCw, Clock } from 'lucide-react'

interface SummaryData {
  summary: string
  updatedAt: string
  stale?: boolean
}

export function MarketSummary() {
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/market-summary`, { headers: vmHeaders() })
      if (!res.ok) throw new Error(`${res.status}`)
      setData(await res.json())
    } catch {
      setError('Alerts unavailable')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const updatedTime = data?.updatedAt
    ? new Date(data.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="p-3 border-b border-[#1e293b]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Zap size={11} className="text-[#f59e0b]" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#94a3b8]">Market Alerts</span>
          {data?.stale && <span className="text-[8px] text-[#f59e0b]">(cached)</span>}
        </div>
        <div className="flex items-center gap-2">
          {updatedTime && (
            <div className="flex items-center gap-1 text-[8px] text-[#475569]">
              <Clock size={8} />
              {updatedTime}
            </div>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="text-[#475569] hover:text-[#94a3b8] transition-colors disabled:opacity-40"
          >
            <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="flex items-center gap-2 py-3">
          <RefreshCw size={10} className="animate-spin text-[#f59e0b]" />
          <span className="text-[10px] text-[#475569]">Scanning market news…</span>
        </div>
      )}

      {error && !data && (
        <p className="text-[10px] text-[#ef4444]">{error}</p>
      )}

      {data && (
        <div className="space-y-2">
          {data.summary.split('\n').filter(l => l.trim()).map((line, i) => (
            <p key={i} className="text-[10px] text-[#cbd5e1] leading-relaxed">{line}</p>
          ))}
        </div>
      )}
    </div>
  )
}
