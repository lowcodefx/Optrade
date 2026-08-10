import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { kiteAuthHeaders, API_BASE } from '@/core/services/apiClient'
import { Plus, X, Eye, Bell, BellOff, Zap } from 'lucide-react'

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface KiteQuote {
  instrument_token: number
  last_price: number
  volume: number
  ohlc: { close: number; open: number; high: number; low: number }
}

interface PriceAlert { target: number | null; sl: number | null }
type AlertsMap = Record<string, PriceAlert>

interface HistoryData { prices: number[]; volumes: number[] }

// â”€â”€ API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function fetchQuotes(symbols: string[]): Promise<Record<string, KiteQuote>> {
  if (symbols.length === 0) return {}
  const qs = symbols.map(s => `i=NSE:${encodeURIComponent(s)}`).join('&')
  const res = await fetch(`${API_BASE}/api/kite?kite_path=quote&${qs}`, { headers: kiteAuthHeaders() })
  if (!res.ok) return {}
  const json = await res.json()
  return (json.data ?? {}) as Record<string, KiteQuote>
}

async function fetchHistory(tokens: number[]): Promise<Record<number, HistoryData>> {
  if (tokens.length === 0) return {}
  const res = await fetch(
    `${API_BASE}/api/stock-history?tokens=${tokens.join(',')}`,
    { headers: kiteAuthHeaders() },
  )
  if (!res.ok) return {}
  return res.json()
}

// â”€â”€ Sparkline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Sparkline({ prices }: { prices: number[] }) {
  if (prices.length < 2) return <div className="w-14 h-5 bg-[#1e293b]/40 rounded shrink-0" />
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const W = 56, H = 20
  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * W
    const y = H - ((p - min) / range) * (H - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const isUp = prices[prices.length - 1] >= prices[0]
  return (
    <svg width={W} height={H} className="shrink-0">
      <polyline points={pts} fill="none" stroke={isUp ? '#22c55e' : '#ef4444'} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

// â”€â”€ Alert editor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AlertEditor({ symbol, alert, onSave, onClose }: {
  symbol: string
  alert: PriceAlert
  onSave: (a: PriceAlert) => void
  onClose: () => void
}) {
  const [target, setTarget] = useState(alert.target?.toString() ?? '')
  const [sl, setSl]         = useState(alert.sl?.toString() ?? '')
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-4 w-52 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="text-white text-xs font-bold">{symbol} Alerts</div>
        <div className="space-y-2">
          <div>
            <label className="text-[#94a3b8] text-[9px] uppercase tracking-widest">Target (Rs.)</label>
            <input
              value={target}
              onChange={e => setTarget(e.target.value)}
              placeholder="e.g. 2600"
              className="w-full mt-1 bg-[#060d1a] border border-[#1e3a5f] rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-[#22c55e]/50"
            />
          </div>
          <div>
            <label className="text-[#94a3b8] text-[9px] uppercase tracking-widest">Stop-Loss (Rs.)</label>
            <input
              value={sl}
              onChange={e => setSl(e.target.value)}
              placeholder="e.g. 2300"
              className="w-full mt-1 bg-[#060d1a] border border-[#1e3a5f] rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-[#ef4444]/50"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { onSave({ target: parseFloat(target) || null, sl: parseFloat(sl) || null }); onClose() }}
            className="flex-1 bg-[#38bdf8]/20 text-[#38bdf8] text-[10px] font-bold py-1.5 rounded hover:bg-[#38bdf8]/30 transition-colors"
          >
            Save
          </button>
          <button onClick={onClose} className="flex-1 text-[#475569] text-[10px] py-1.5 rounded hover:text-white transition-colors">
            Cancel
          </button>
        </div>
        <button
          onClick={() => { onSave({ target: null, sl: null }); onClose() }}
          className="w-full text-[#64748b] text-[9px] hover:text-[#ef4444] transition-colors"
        >
          Clear alerts
        </button>
      </div>
    </div>
  )
}

// â”€â”€ Alert state helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function loadAlerts(): AlertsMap {
  try { return JSON.parse(localStorage.getItem('sw_alerts') ?? '{}') } catch { return {} }
}
function saveAlerts(a: AlertsMap) {
  localStorage.setItem('sw_alerts', JSON.stringify(a))
}

// â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function StocksWatchlist({ watchlist, onRemove, onAdd }: {
  watchlist: string[]
  onRemove: (s: string) => void
  onAdd: (s: string) => void
}) {
  const [input, setInput]           = useState('')
  const [alerts, setAlerts]         = useState<AlertsMap>(loadAlerts)
  const [editingAlert, setEditAlert] = useState<string | null>(null)
  const [triggered, setTriggered]   = useState<Record<string, 'target' | 'sl'>>({})

  // â”€â”€ Quotes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { data: quotes = {} } = useQuery({
    queryKey: ['watchlistQuotes', watchlist],
    queryFn: () => fetchQuotes(watchlist),
    enabled: watchlist.length > 0,
    refetchInterval: 30000,
  })

  // â”€â”€ Instrument tokens from quotes â†’ history â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const tokenMap: Record<string, number> = {}
  for (const sym of watchlist) {
    const q = quotes[`NSE:${sym}`]
    if (q?.instrument_token) tokenMap[sym] = q.instrument_token
  }
  const tokenList = Object.values(tokenMap)

  const { data: history = {} } = useQuery({
    queryKey: ['watchlistHistory', tokenList.sort().join(',')],
    queryFn: () => fetchHistory(tokenList),
    enabled: tokenList.length > 0,
    staleTime: 20 * 60 * 1000,
  })

  // â”€â”€ Alert triggering â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const next: Record<string, 'target' | 'sl'> = {}
    for (const sym of watchlist) {
      const q = quotes[`NSE:${sym}`]
      const a = alerts[sym]
      if (!q || !a) continue
      if (a.target && q.last_price >= a.target) next[sym] = 'target'
      else if (a.sl && q.last_price <= a.sl) next[sym] = 'sl'
    }
    setTriggered(next)
  }, [quotes, alerts, watchlist])

  function handleAdd() {
    const sym = input.trim().toUpperCase()
    if (sym && !watchlist.includes(sym)) { onAdd(sym); setInput('') }
  }

  function updateAlert(sym: string, a: PriceAlert) {
    const next = { ...alerts, [sym]: a }
    setAlerts(next)
    saveAlerts(next)
  }

  return (
    <div className="flex flex-col h-full">

      {/* â”€â”€ Add symbol input â”€â”€ */}
      <div className="px-3 py-2.5 border-b border-[#1e293b]">
        <div className="flex items-center gap-1.5 mb-2">
          <Eye size={11} className="text-[#38bdf8]" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#94a3b8]">Watchlist</span>
        </div>
        <div className="flex gap-1">
          <input
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Add symbol..."
            className="flex-1 bg-[#060d1a] border border-[#1e3a5f] rounded px-2 py-1 text-[10px] text-white placeholder:text-[#64748b] focus:outline-none focus:border-[#38bdf8]/50"
          />
          <button onClick={handleAdd} className="bg-[#1e3a5f] hover:bg-[#38bdf8]/20 text-[#38bdf8] rounded px-1.5 transition-colors">
            <Plus size={11} />
          </button>
        </div>
      </div>

      {/* â”€â”€ Watchlist rows â”€â”€ */}
      <div className="flex-1 overflow-y-auto">
        {watchlist.length === 0 && (
          <div className="px-3 py-6 text-center text-[#64748b] text-[9px]">
            Add symbols to track
          </div>
        )}
        {watchlist.map(sym => {
          const q      = quotes[`NSE:${sym}`]
          const chg    = q ? ((q.last_price - q.ohlc.close) / q.ohlc.close) * 100 : null
          const pos    = (chg ?? 0) >= 0
          const token  = tokenMap[sym]
          const hist   = token ? history[token] : undefined
          const prices = hist?.prices ?? []

          // Volume spike: today's quote volume vs avg of last 5 candle volumes
          const avgVol = hist?.volumes.length
            ? hist.volumes.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, hist.volumes.length)
            : 0
          const spikeRatio = avgVol > 0 && q?.volume ? q.volume / avgVol : 0
          const isSpike    = spikeRatio >= 1.5

          const alert      = alerts[sym]
          const hasAlert   = alert?.target || alert?.sl
          const trig       = triggered[sym]
          const rowBorder  = trig === 'target'
            ? 'border-l-2 border-l-[#22c55e]'
            : trig === 'sl'
              ? 'border-l-2 border-l-[#ef4444]'
              : ''

          return (
            <div key={sym} className={`px-2 py-2 border-b border-[#0f1f35] hover:bg-[#0a1628] transition-colors group ${rowBorder}`}>
              <div className="flex items-center justify-between gap-1">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-white text-[10px] font-semibold">{sym}</span>
                    {isSpike && (
                      <span className="flex items-center gap-0.5 bg-[#f59e0b]/15 text-[#f59e0b] text-[7px] font-bold px-1 py-0.5 rounded border border-[#f59e0b]/30">
                        <Zap size={7} />VOL
                      </span>
                    )}
                    {trig === 'target' && (
                      <span className="text-[7px] font-bold text-[#22c55e] bg-[#22c55e]/10 px-1 py-0.5 rounded">TARGET</span>
                    )}
                    {trig === 'sl' && (
                      <span className="text-[7px] font-bold text-[#ef4444] bg-[#ef4444]/10 px-1 py-0.5 rounded">SL HIT</span>
                    )}
                  </div>
                  {q ? (
                    <div className={`text-[9px] font-semibold ${pos ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      Rs.{q.last_price.toFixed(1)} <span className="text-[8px]">{chg !== null ? `${pos ? '+' : ''}${chg.toFixed(2)}%` : ''}</span>
                    </div>
                  ) : (
                    <div className="text-[#64748b] text-[9px]">--</div>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => setEditAlert(sym)}
                    className={`transition-colors ${hasAlert ? 'text-[#f59e0b]' : 'text-[#1e293b] group-hover:text-[#475569]'}`}
                    title="Set price alerts"
                  >
                    {hasAlert ? <Bell size={9} /> : <BellOff size={9} />}
                  </button>
                  <button onClick={() => onRemove(sym)} className="text-[#1e293b] group-hover:text-[#ef4444] transition-colors">
                    <X size={9} />
                  </button>
                </div>
              </div>
              {/* Sparkline */}
              <div className="mt-1">
                <Sparkline prices={prices} />
              </div>
            </div>
          )
        })}
      </div>


      {/* Alert editor modal */}
      {editingAlert && (
        <AlertEditor
          symbol={editingAlert}
          alert={alerts[editingAlert] ?? { target: null, sl: null }}
          onSave={a => updateAlert(editingAlert, a)}
          onClose={() => setEditAlert(null)}
        />
      )}
    </div>
  )
}
