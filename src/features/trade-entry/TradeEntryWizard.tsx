import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMarketStore, useOrderStore, useSettingsStore } from '@/core/store'
import { tradingService, useLiveModeStore } from '@/core/services/tradingService'
import { usePositions } from '@/core/hooks/useMarketData'
import { CheckCircle2, XCircle, AlertTriangle, X, Zap, ChevronRight, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── constants ─────────────────────────────────────────────────────────────────
const RISK_PCT         = 0.05       // 5% of balance per trade
const SL_POINTS        = 20         // fixed ₹20 SL
const LOT              = 75         // NIFTY lot size
const MAX_LOTS         = 10
const DAILY_LOSS_LIMIT = 10_000
const fmt  = (n: number) => Math.abs(n).toLocaleString('en-IN')
const fmtS = (n: number) => (n >= 0 ? '+' : '−') + '₹' + fmt(n)

// ── types ─────────────────────────────────────────────────────────────────────
interface CheckItem {
  id: string; label: string; detail: string
  passed: boolean; required: boolean; value?: string
}
interface TradeSetup {
  strike: number; optionType: 'CE' | 'PE'; entry: number; sl: number
  lots: number; totalRisk: number; capitalRequired: number
  ltp: number; delta: number; iv: number; isAtm: boolean
}
interface OrderResult { orderId: string; status: string; message: string }

// ── fetch balance ─────────────────────────────────────────────────────────────
function useKiteBalance() {
  const { apiKey, accessToken } = useSettingsStore()
  const isLive = useLiveModeStore(s => s.isLive)
  return useQuery({
    queryKey: ['kite-balance'],
    queryFn: async () => {
      const res = await fetch('/api/kite?kite_path=user/margins', {
        headers: { 'X-Kite-Auth': `token ${apiKey}:${accessToken}`, 'X-Kite-Version': '3' },
      })
      const json = await res.json()
      return (json.data?.equity?.available?.live_balance ?? 0) as number
    },
    enabled: isLive && !!apiKey && !!accessToken,
    staleTime: 30_000,
  })
}

// ── checklist items ───────────────────────────────────────────────────────────
function useChecklist(direction: 'CE' | 'PE', dailyPnL: number): { items: CheckItem[]; canProceed: boolean } {
  const ceScore      = useMarketStore(s => s.ceScore)
  const peScore      = useMarketStore(s => s.peScore)
  const noTradeReason = useMarketStore(s => s.noTradeReason)
  const candles      = useMarketStore(s => s.candles)
  const quote        = useMarketStore(s => s.quote)
  const pivotPoints  = useMarketStore(s => s.pivotPoints)
  const prediction   = useMarketStore(s => s.prediction1h)

  const last  = candles[candles.length - 1]
  const spot  = quote?.spot ?? 0
  const score = direction === 'CE' ? ceScore : peScore
  const ema9  = last?.ema9  ?? 0
  const ema20 = last?.ema20 ?? 0
  const ema50 = last?.ema50 ?? 0
  const vwap  = last?.vwap  ?? 0

  const now  = new Date(Date.now() + 5.5 * 3600000)
  const h = now.getUTCHours(), m = now.getUTCMinutes()
  const t = h * 60 + m
  const inWindow = (t >= 9 * 60 + 45 && t < 11 * 60) || (t >= 14 * 60 && t < 15 * 60 + 15)
  const timeLabel = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`

  const emaBull  = ema9 > ema20 && ema20 > ema50
  const emaBear  = ema9 < ema20 && ema20 < ema50
  const partBull = !emaBull && !emaBear && ema9 > ema20
  const partBear = !emaBull && !emaBear && ema9 < ema20
  const emaOk  = direction === 'CE' ? (emaBull || partBull) : (emaBear || partBear)
  const vwapOk = direction === 'CE' ? spot > vwap : spot < vwap
  const ppOk   = pivotPoints
    ? (direction === 'CE' ? spot > pivotPoints.pp : spot < pivotPoints.pp)
    : null

  const dirOk = direction === 'CE'
    ? (prediction === 'BULLISH')
    : (prediction === 'BEARISH')

  const lossOk = dailyPnL > -DAILY_LOSS_LIMIT

  const items: CheckItem[] = [
    {
      id: 'score', required: true,
      label: `Market Score ≥ 500 (${direction})`,
      detail: `${direction} score: ${score} / 1000`,
      value: String(score),
      passed: score >= 500,
    },
    {
      id: 'direction', required: true,
      label: `Prediction is ${direction === 'CE' ? 'BULLISH' : 'BEARISH'}`,
      detail: `Current: ${prediction ?? 'N/A'}`,
      passed: dirOk,
    },
    {
      id: 'daily-loss', required: true,
      label: `Daily Loss < ₹${fmt(DAILY_LOSS_LIMIT)}`,
      detail: `Today P&L: ${fmtS(dailyPnL)}`,
      passed: lossOk,
    },
    {
      id: 'no-trade', required: true,
      label: 'No Trade Block Active',
      detail: noTradeReason ?? 'No block — clear to trade',
      passed: !noTradeReason,
    },
    {
      id: 'ema', required: false,
      label: `EMA Alignment (${direction === 'CE' ? 'EMA9 > EMA20' : 'EMA9 < EMA20'})`,
      detail: ema9 > 0 ? `EMA9 ${ema9.toFixed(0)} · EMA20 ${ema20.toFixed(0)} · EMA50 ${ema50.toFixed(0)}` : 'Awaiting data',
      passed: ema9 > 0 ? emaOk : false,
    },
    {
      id: 'vwap', required: false,
      label: `Spot ${direction === 'CE' ? 'above' : 'below'} VWAP`,
      detail: vwap > 0 ? `Spot ${spot.toFixed(0)} · VWAP ${vwap.toFixed(0)}` : 'Awaiting data',
      passed: vwap > 0 ? vwapOk : false,
    },
    {
      id: 'time', required: false,
      label: 'Prime Trading Window',
      detail: inWindow ? `${timeLabel} IST — prime window active` : `${timeLabel} IST — outside 9:45-11:00 / 14:00-15:15`,
      passed: inWindow,
    },
    ...(ppOk !== null ? [{
      id: 'pivot', required: false,
      label: `Spot ${direction === 'CE' ? 'above' : 'below'} Pivot (PP)`,
      detail: `PP ${pivotPoints!.pp.toFixed(0)} · Spot ${spot.toFixed(0)}`,
      passed: ppOk,
    }] : []),
  ]

  const canProceed = items.filter(i => i.required).every(i => i.passed)
  return { items, canProceed }
}

// ── setup suggestions from option chain ───────────────────────────────────────
function useSetupSuggestions(direction: 'CE' | 'PE', balance: number): TradeSetup[] {
  const chain = useMarketStore(s => s.optionChain)
  const quote = useMarketStore(s => s.quote)

  return useMemo(() => {
    if (!chain || !quote || balance <= 0) return []
    const spot = quote.spot
    const atm  = Math.round(spot / 50) * 50
    const side = direction === 'CE' ? 'ce' : 'pe'

    return chain.strikes
      .filter(s => direction === 'CE' ? s.strike <= atm + 50 : s.strike >= atm - 50)
      .sort((a, b) => direction === 'CE' ? b.strike - a.strike : a.strike - b.strike)
      .slice(0, 4)
      .map(s => {
        const data   = s[side]
        const entry  = Math.round(data.ltp)
        const sl     = Math.max(entry - SL_POINTS, 1)
        const maxRisk = balance * RISK_PCT
        const lots   = Math.min(Math.max(Math.floor(maxRisk / (SL_POINTS * LOT)), 1), MAX_LOTS)
        return {
          strike: s.strike, optionType: direction,
          entry, sl, lots,
          totalRisk: SL_POINTS * LOT * lots,
          capitalRequired: entry * LOT * lots,
          ltp: data.ltp, delta: data.delta, iv: data.iv,
          isAtm: s.strike === atm,
        }
      })
      .filter(s => s.ltp > 0)
  }, [chain, quote, direction, balance])
}

// ── step indicator ─────────────────────────────────────────────────────────────
const STEPS = ['Checklist', 'Setup', 'Review', 'Confirm']

function StepBar({ stage }: { stage: number }) {
  return (
    <div className="flex items-center gap-0 mb-4">
      {STEPS.map((label, i) => {
        const n = i + 1
        const done    = stage > n
        const active  = stage === n
        const inactive = stage < n
        return (
          <div key={n} className="flex items-center flex-1">
            <div className="flex flex-col items-center min-w-0">
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border-2 transition-all',
                done    ? 'bg-[#22c55e] border-[#22c55e] text-black' : '',
                active  ? 'bg-[#38bdf8] border-[#38bdf8] text-black' : '',
                inactive ? 'bg-transparent border-[#334155] text-[#475569]' : '',
              )}>
                {done ? '✓' : n}
              </div>
              <span className={cn('text-[7px] mt-0.5 whitespace-nowrap',
                active ? 'text-[#38bdf8]' : done ? 'text-[#22c55e]' : 'text-[#475569]'
              )}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('flex-1 h-px mx-1 mb-4', done ? 'bg-[#22c55e]' : 'bg-[#334155]')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Stage 1: Checklist ────────────────────────────────────────────────────────
function Stage1({ direction, dailyPnL, onNext }: { direction: 'CE' | 'PE'; dailyPnL: number; onNext: () => void }) {
  const { items, canProceed } = useChecklist(direction, dailyPnL)
  const required  = items.filter(i => i.required)
  const advisory  = items.filter(i => !i.required)
  const reqPassed = required.filter(i => i.passed).length

  return (
    <div className="space-y-3">
      {/* Required */}
      <div>
        <div className="text-[9px] text-[#64748b] uppercase tracking-widest mb-1.5">
          Required ({reqPassed}/{required.length} passed)
        </div>
        <div className="space-y-1.5">
          {required.map(item => (
            <CheckRow key={item.id} item={item} />
          ))}
        </div>
      </div>

      {/* Advisory */}
      <div>
        <div className="text-[9px] text-[#64748b] uppercase tracking-widest mb-1.5">
          Advisory ({advisory.filter(i => i.passed).length}/{advisory.length} met)
        </div>
        <div className="space-y-1.5">
          {advisory.map(item => (
            <CheckRow key={item.id} item={item} advisory />
          ))}
        </div>
      </div>

      {!canProceed && (
        <div className="flex items-start gap-2 bg-[#1a1000] border border-[#f59e0b]/50 rounded px-3 py-2.5">
          <AlertTriangle size={12} className="text-[#f59e0b] mt-0.5 shrink-0" />
          <p className="text-[9px] text-[#f59e0b] leading-relaxed">
            Entry conditions not fully met. Proceeding is restricted until all required confirmations pass.
          </p>
        </div>
      )}

      <button
        onClick={onNext}
        disabled={!canProceed}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-2.5 rounded text-xs font-bold transition-colors',
          canProceed
            ? 'bg-[#38bdf8] text-black hover:bg-[#0ea5e9]'
            : 'bg-[#0f1f35] text-[#334155] cursor-not-allowed'
        )}
      >
        Continue to Setup <ChevronRight size={13} />
      </button>
    </div>
  )
}

function CheckRow({ item, advisory }: { item: CheckItem; advisory?: boolean }) {
  const Icon = item.passed ? CheckCircle2 : advisory ? AlertTriangle : XCircle
  const color = item.passed
    ? '#22c55e'
    : advisory ? '#64748b' : '#ef4444'

  return (
    <div className="flex items-start gap-2 bg-[#060d1a] border border-[#1e293b] rounded px-2.5 py-2">
      <Icon size={12} style={{ color }} className="mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium text-[#cbd5e1]">{item.label}</span>
          {item.value && (
            <span className="text-[10px] font-bold shrink-0" style={{ color }}>
              {item.value}
            </span>
          )}
        </div>
        <p className="text-[9px] mt-0.5" style={{ color: item.passed ? '#475569' : color }}>{item.detail}</p>
      </div>
    </div>
  )
}

// ── Stage 2: Setup Selection ──────────────────────────────────────────────────
function Stage2({ direction, balance, onSelect, onBack }: {
  direction: 'CE' | 'PE'; balance: number
  onSelect: (s: TradeSetup) => void; onBack: () => void
}) {
  const setups = useSetupSuggestions(direction, balance)

  if (setups.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <AlertTriangle size={22} className="text-[#f59e0b] mx-auto" />
        <p className="text-[#94a3b8] text-xs">No option data — ensure option chain is loaded</p>
        <button onClick={onBack} className="text-[10px] text-[#38bdf8] hover:underline">← Back</button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="text-[9px] text-[#64748b] leading-relaxed">
        Select a setup. Entry ₹180–200 range highlighted. SL = Entry − ₹{SL_POINTS}. Lots from 5% risk on ₹{fmt(balance)} balance.
      </div>
      <div className="space-y-2">
        {setups.map(s => (
          <SetupCard key={`${s.strike}-${s.optionType}`} setup={s} balance={balance} onSelect={onSelect} />
        ))}
      </div>
      <button onClick={onBack} className="text-[9px] text-[#475569] hover:text-[#94a3b8] transition-colors">
        ← Back to Checklist
      </button>
    </div>
  )
}

function SetupCard({ setup: s, balance, onSelect }: { setup: TradeSetup; balance: number; onSelect: (s: TradeSetup) => void }) {
  const inRange  = s.entry >= 180 && s.entry <= 200
  const canAfford = balance >= s.capitalRequired

  return (
    <button
      onClick={() => canAfford && onSelect(s)}
      disabled={!canAfford}
      className={cn(
        'w-full text-left rounded border px-3 py-2.5 transition-all',
        inRange
          ? 'border-[#38bdf8] bg-[#0a1e35] hover:bg-[#0f2540]'
          : 'border-[#1e3a5f] bg-[#060d1a] hover:bg-[#0a1628]',
        !canAfford && 'opacity-50 cursor-not-allowed',
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-bold', s.optionType === 'CE' ? 'text-[#22c55e]' : 'text-[#ef4444]')}>
            {s.strike} {s.optionType}
          </span>
          {s.isAtm && <span className="text-[8px] bg-[#38bdf8]/20 text-[#38bdf8] px-1 rounded">ATM</span>}
          {inRange && <span className="text-[8px] bg-[#22c55e]/20 text-[#22c55e] px-1 rounded">In Range</span>}
        </div>
        <ChevronRight size={12} className="text-[#475569]" />
      </div>
      <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[9px]">
        <div><span className="text-[#64748b]">Entry</span><div className="text-[#38bdf8] font-bold">₹{s.entry}</div></div>
        <div><span className="text-[#64748b]">SL</span><div className="text-[#ef4444] font-bold">₹{s.sl}</div></div>
        <div><span className="text-[#64748b]">Lots</span><div className="text-white font-bold">{s.lots} ({s.lots * LOT})</div></div>
        <div><span className="text-[#64748b]">Risk</span><div className="text-[#f59e0b] font-bold">₹{fmt(s.totalRisk)}</div></div>
        <div><span className="text-[#64748b]">Capital</span><div className="text-white font-bold">₹{fmt(s.capitalRequired)}</div></div>
        <div><span className="text-[#64748b]">Δ / IV</span><div className="text-[#94a3b8]">{s.delta.toFixed(2)} / {s.iv}%</div></div>
      </div>
      {!canAfford && (
        <p className="text-[9px] text-[#ef4444] mt-1">Insufficient balance (need ₹{fmt(s.capitalRequired)})</p>
      )}
    </button>
  )
}

// ── Stage 3: Review & Buy ─────────────────────────────────────────────────────
function Stage3({ setup, balance, direction, dailyPnL, onConfirm, onBack, isLoading }: {
  setup: TradeSetup; balance: number; direction: 'CE' | 'PE'; dailyPnL: number
  onConfirm: () => void; onBack: () => void; isLoading: boolean
}) {
  const chain = useMarketStore(s => s.optionChain)
  const remaining = balance - setup.capitalRequired

  // Re-check critical conditions at execution time
  const { items } = useChecklist(direction, dailyPnL)
  const requiredPassed = items.filter(i => i.required).every(i => i.passed)
  const balanceOk = balance >= setup.capitalRequired
  const lossOk    = dailyPnL > -DAILY_LOSS_LIMIT
  const canBuy    = requiredPassed && balanceOk && lossOk && !isLoading

  const rows = [
    ['Instrument',         `NIFTY ${setup.strike} ${setup.optionType} ${chain?.expiry ?? ''}`],
    ['Entry Price',        `₹${setup.entry} (LIMIT)`],
    ['Order Type',         'MIS · LIMIT'],
    ['Lot Size',           `${setup.lots} lots · ${setup.lots * LOT} qty`],
    ['Stop Loss',          `₹${setup.sl}  (−₹${SL_POINTS}/share)`],
    ['Total Risk',         `₹${fmt(setup.totalRisk)}`],
    ['Capital Required',   `₹${fmt(setup.capitalRequired)}`],
    ['Remaining Balance',  `₹${fmt(remaining)}`],
  ] as const

  return (
    <div className="space-y-3">
      <div className="bg-[#060d1a] border border-[#1e3a5f] rounded overflow-hidden">
        {rows.map(([label, value], i) => (
          <div key={i} className={cn(
            'flex items-center justify-between px-3 py-1.5 text-[10px]',
            i % 2 === 0 ? 'bg-[#060d1a]' : 'bg-[#080f20]'
          )}>
            <span className="text-[#64748b]">{label}</span>
            <span className={cn('font-semibold',
              label === 'Total Risk' ? 'text-[#f59e0b]'
              : label === 'Entry Price' ? 'text-[#38bdf8]'
              : label === 'Stop Loss' ? 'text-[#ef4444]'
              : label === 'Remaining Balance' ? (remaining >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]')
              : 'text-[#e2e8f0]'
            )}>{value}</span>
          </div>
        ))}
      </div>

      {!lossOk && (
        <div className="flex items-center gap-2 bg-[#2b0000] border border-[#ef4444] rounded px-3 py-2">
          <AlertTriangle size={12} className="text-[#ef4444] shrink-0" />
          <p className="text-[9px] text-[#ef4444] font-semibold">
            Daily loss limit of ₹{fmt(DAILY_LOSS_LIMIT)} exceeded. New entries are blocked for today.
          </p>
        </div>
      )}
      {!balanceOk && (
        <div className="flex items-center gap-2 bg-[#2b0000] border border-[#ef4444] rounded px-3 py-2">
          <AlertTriangle size={12} className="text-[#ef4444] shrink-0" />
          <p className="text-[9px] text-[#ef4444]">Insufficient balance. Need ₹{fmt(setup.capitalRequired)}.</p>
        </div>
      )}
      {!requiredPassed && lossOk && balanceOk && (
        <div className="flex items-center gap-2 bg-[#1a1000] border border-[#f59e0b]/60 rounded px-3 py-2">
          <AlertTriangle size={12} className="text-[#f59e0b] shrink-0" />
          <p className="text-[9px] text-[#f59e0b]">Entry conditions changed. Re-verify the checklist before buying.</p>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onBack} className="flex-1 py-2.5 text-xs text-[#475569] border border-[#1e293b] rounded hover:text-white hover:border-[#334155] transition-colors">
          ← Back
        </button>
        <button
          onClick={onConfirm}
          disabled={!canBuy}
          className={cn(
            'flex-2 flex-grow flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded transition-colors',
            canBuy
              ? 'bg-[#22c55e] text-black hover:bg-[#16a34a]'
              : 'bg-[#0d1f0d] text-[#2d5c2d] cursor-not-allowed'
          )}
        >
          <Zap size={14} />
          {isLoading ? 'Placing Order…' : `BUY ${setup.lots} LOT — ₹${fmt(setup.capitalRequired)}`}
        </button>
      </div>
    </div>
  )
}

// ── Stage 4: Confirmation ─────────────────────────────────────────────────────
function Stage4({ result, setup, onClose }: { result: OrderResult; setup: TradeSetup; onClose: () => void }) {
  const success = result.status !== 'REJECTED'
  return (
    <div className="space-y-4 text-center">
      <div className={cn(
        'w-14 h-14 rounded-full flex items-center justify-center mx-auto',
        success ? 'bg-[#0d2b0d] border-2 border-[#22c55e]' : 'bg-[#2b0d0d] border-2 border-[#ef4444]'
      )}>
        {success
          ? <CheckCircle2 size={28} className="text-[#22c55e]" />
          : <XCircle size={28} className="text-[#ef4444]" />}
      </div>

      <div>
        <div className={cn('text-base font-bold', success ? 'text-[#22c55e]' : 'text-[#ef4444]')}>
          {success ? 'Order Placed Successfully' : 'Order Failed'}
        </div>
        <p className="text-[#475569] text-[10px] mt-0.5">{result.message}</p>
      </div>

      {success && (
        <div className="bg-[#060d1a] border border-[#1e3a5f] rounded text-left overflow-hidden">
          {[
            ['Order ID',    result.orderId],
            ['Status',      result.status],
            ['Instrument',  `NIFTY ${setup.strike} ${setup.optionType}`],
            ['Entry',       `₹${setup.entry} × ${setup.lots * LOT} qty`],
            ['SL (Manual)', `₹${setup.sl} — place your SL immediately`],
          ].map(([k, v], i) => (
            <div key={i} className={cn(
              'flex justify-between px-3 py-1.5 text-[10px]',
              i % 2 === 0 ? 'bg-[#060d1a]' : 'bg-[#080f20]'
            )}>
              <span className="text-[#64748b]">{k}</span>
              <span className={cn('font-semibold',
                k === 'SL (Manual)' ? 'text-[#f59e0b]' : 'text-[#e2e8f0]'
              )}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 bg-[#1a1000] border border-[#f59e0b]/50 rounded px-3 py-2 text-left">
          <AlertTriangle size={11} className="text-[#f59e0b] mt-0.5 shrink-0" />
          <p className="text-[9px] text-[#f59e0b]">
            Immediately place a Stop Loss order at ₹{setup.sl} for {setup.lots * LOT} qty to protect your trade.
          </p>
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full py-2.5 text-xs font-bold bg-[#1e3a5f] text-[#38bdf8] hover:bg-[#1a3358] rounded transition-colors"
      >
        Close
      </button>
    </div>
  )
}

// ── Main popup ────────────────────────────────────────────────────────────────
interface Props { onClose: () => void }

export function TradeEntryWizard({ onClose }: Props) {
  const qc        = useQueryClient()
  const isLive    = useLiveModeStore(s => s.isLive)
  const direction = useOrderStore(s => s.optionType)

  const { data: balance = 0 } = useKiteBalance()
  const { data: positions = [] } = usePositions()
  const dailyPnL = positions.reduce((sum, p) => sum + (p.pnl ?? 0), 0)

  const [stage, setStage]   = useState<1 | 2 | 3 | 4>(1)
  const [setup, setSetup]   = useState<TradeSetup | null>(null)
  const [result, setResult] = useState<OrderResult | null>(null)
  const [orderError, setOrderError] = useState('')

  const chain = useMarketStore(s => s.optionChain)

  const mutation = useMutation({
    mutationFn: () => {
      if (!setup || !chain) throw new Error('No setup or chain data')
      return tradingService.placeOrder({
        symbol: 'NIFTY',
        strike: setup.strike,
        optionType: setup.optionType,
        expiry: chain.expiry ?? '',
        quantity: setup.lots * LOT,
        orderType: 'LIMIT',
        productType: 'MIS',
        price: setup.entry,
        stopLoss: setup.sl,
      })
    },
    onSuccess: (res) => {
      setResult({ orderId: res.orderId, status: res.status, message: res.message })
      setStage(4)
      qc.invalidateQueries({ queryKey: ['positions'] })
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : 'Order placement failed'
      setOrderError(msg)
      setResult({ orderId: '—', status: 'REJECTED', message: msg })
      setStage(4)
    },
  })

  if (!isLive) {
    return (
      <Overlay onClose={onClose}>
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <ShieldCheck size={32} className="text-[#f59e0b]" />
          <p className="text-[#94a3b8] text-sm text-center">Connect to Zerodha<br />to use Guided Trade Entry</p>
          <button onClick={onClose} className="text-[#38bdf8] text-xs hover:underline">Close</button>
        </div>
      </Overlay>
    )
  }

  return (
    <Overlay onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-[#38bdf8]" />
            <span className="text-sm font-bold text-[#e2e8f0]">Guided Trade Entry</span>
            <span className={cn(
              'text-[9px] font-bold px-1.5 py-0.5 rounded',
              direction === 'CE' ? 'bg-[#22c55e]/20 text-[#22c55e]' : 'bg-[#ef4444]/20 text-[#ef4444]'
            )}>{direction}</span>
          </div>
          <p className="text-[#475569] text-[9px] mt-0.5">
            Balance ₹{fmt(balance)} · Today {fmtS(dailyPnL)}
          </p>
        </div>
        <button onClick={onClose} className="text-[#475569] hover:text-white transition-colors p-1">
          <X size={15} />
        </button>
      </div>

      <StepBar stage={stage} />

      {/* Stage content */}
      {stage === 1 && (
        <Stage1
          direction={direction}
          dailyPnL={dailyPnL}
          onNext={() => setStage(2)}
        />
      )}
      {stage === 2 && (
        <Stage2
          direction={direction}
          balance={balance}
          onSelect={s => { setSetup(s); setStage(3) }}
          onBack={() => setStage(1)}
        />
      )}
      {stage === 3 && setup && (
        <Stage3
          setup={setup}
          balance={balance}
          direction={direction}
          dailyPnL={dailyPnL}
          onConfirm={() => mutation.mutate()}
          onBack={() => setStage(2)}
          isLoading={mutation.isPending}
        />
      )}
      {stage === 4 && result && setup && (
        <Stage4 result={result} setup={setup} onClose={onClose} />
      )}

      {orderError && stage !== 4 && (
        <p className="text-[#ef4444] text-[9px] mt-2">{orderError}</p>
      )}
    </Overlay>
  )
}

// ── overlay wrapper ───────────────────────────────────────────────────────────
function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 shadow-2xl">
        {children}
      </div>
    </div>
  )
}
