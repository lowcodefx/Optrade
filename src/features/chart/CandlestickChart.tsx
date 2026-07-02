import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Customized } from 'recharts'
import type { Candle, PivotPoints } from '@/core/types'
import { formatNumber } from '@/lib/utils'

// ── Candlestick renderer ─────────────────────────────────────────────────────

function Candles({ xAxisMap, yAxisMap, data }: { xAxisMap?: Record<string, { scale: (v: number) => number; bandwidth: () => number }>, yAxisMap?: Record<string, { scale: (v: number) => number }>, data?: Candle[] }) {
  if (!xAxisMap || !yAxisMap || !data) return null
  const xScale = Object.values(xAxisMap)[0]?.scale
  const yScale = Object.values(yAxisMap)[0]?.scale
  if (!xScale || !yScale) return null

  return (
    <g>
      {data.map((d, i) => {
        const bwHalf = ((xScale as unknown as { bandwidth?: () => number }).bandwidth?.() ?? 0) / 2
        const cx = xScale(i) + bwHalf
        const isGreen = d.close >= d.open
        const color = isGreen ? '#22c55e' : '#ef4444'
        const bodyTop = yScale(Math.max(d.open, d.close))
        const bodyBot = yScale(Math.min(d.open, d.close))
        const bodyH = Math.max(bodyBot - bodyTop, 1)
        const wickTop = yScale(d.high)
        const wickBot = yScale(d.low)
        const bw = 8

        return (
          <g key={i}>
            <line x1={cx} y1={wickTop} x2={cx} y2={wickBot} stroke={color} strokeWidth={1} />
            <rect x={cx - bw / 2} y={bodyTop} width={bw} height={bodyH} fill={color} opacity={0.9} />
          </g>
        )
      })}
    </g>
  )
}

// ── Future prediction overlay ────────────────────────────────────────────────

const FUTURE_SLOTS = 10  // phantom x-slots added to the right of last candle
const PRED_OFFSET  = 6   // prediction marker sits 6 slots into the future

interface PredictionProps {
  xAxisMap?: Record<string, { scale: (v: number) => number; bandwidth: () => number }>
  yAxisMap?: Record<string, { scale: (v: number) => number }>
  prediction: { entry: number; sl: number; target: number }
  lastIdx: number
  lastClose: number
}

function PredictionOverlay({ xAxisMap, yAxisMap, prediction, lastIdx, lastClose }: PredictionProps) {
  if (!xAxisMap || !yAxisMap) return null
  const xScale = Object.values(xAxisMap)[0]?.scale
  const yScale = Object.values(yAxisMap)[0]?.scale
  if (!xScale || !yScale) return null

  const bwHalf = ((xScale as unknown as { bandwidth?: () => number }).bandwidth?.() ?? 0) / 2
  const predIdx = lastIdx + PRED_OFFSET
  const px = xScale(predIdx) + bwHalf
  const lastX = xScale(lastIdx) + bwHalf
  const lastY = yScale(lastClose)
  const entryY = yScale(prediction.entry)
  const tgtY   = yScale(prediction.target)
  const slY    = yScale(prediction.sl)
  const SQ = 9 // square half-size

  return (
    <g>
      {/* Shaded future zone background */}
      <rect
        x={xScale(lastIdx + 1) + bwHalf}
        y={0}
        width={px - (xScale(lastIdx + 1) + bwHalf) + SQ + 40}
        height={9999}
        fill="#1e3a5f"
        opacity={0.07}
      />

      {/* Projection line from last close → entry */}
      <line x1={lastX} y1={lastY} x2={px} y2={entryY}
        stroke="#22c55e" strokeWidth={1} strokeDasharray="5 3" opacity={0.55} />

      {/* Entry: filled circle */}
      <circle cx={px} cy={entryY} r={5} fill="#22c55e" stroke="#060d1a" strokeWidth={1.5} />
      <text x={px + 10} y={entryY - 4} fontSize={8} fill="#22c55e" fontWeight="bold">ENTRY</text>
      <text x={px + 10} y={entryY + 7} fontSize={8} fill="#22c55e">{formatNumber(prediction.entry, 1)}</text>

      {/* Target: blue square */}
      <rect x={px - SQ} y={tgtY - SQ} width={SQ * 2} height={SQ * 2}
        fill="#0c2744" stroke="#38bdf8" strokeWidth={1.5} />
      <text x={px + SQ + 4} y={tgtY - 3} fontSize={8} fill="#38bdf8" fontWeight="bold">TGT</text>
      <text x={px + SQ + 4} y={tgtY + 7} fontSize={8} fill="#38bdf8">{formatNumber(prediction.target, 1)}</text>

      {/* SL: red square */}
      <rect x={px - SQ} y={slY - SQ} width={SQ * 2} height={SQ * 2}
        fill="#2d0a0a" stroke="#ef4444" strokeWidth={1.5} />
      <text x={px + SQ + 4} y={slY - 3} fontSize={8} fill="#ef4444" fontWeight="bold">SL</text>
      <text x={px + SQ + 4} y={slY + 7} fontSize={8} fill="#ef4444">{formatNumber(prediction.sl, 1)}</text>
    </g>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

interface Props {
  candles: Candle[]
  entry?: number
  sl?: number
  target?: number
  pivotPoints?: PivotPoints | null
  height?: number | string
  prediction?: { entry: number; sl: number; target: number } | null
  timeframeMinutes?: number
}

const PIVOT_LINES = [
  { key: 'r2' as keyof PivotPoints, label: 'R2', color: '#22c55e', dash: '3 4' },
  { key: 'r1' as keyof PivotPoints, label: 'R1', color: '#86efac', dash: '3 4' },
  { key: 'pp' as keyof PivotPoints, label: 'PP', color: '#f59e0b', dash: '5 3' },
  { key: 's1' as keyof PivotPoints, label: 'S1', color: '#fca5a5', dash: '3 4' },
  { key: 's2' as keyof PivotPoints, label: 'S2', color: '#ef4444', dash: '3 4' },
]

function addMinutes(timeStr: string, mins: number): string {
  const [h, m] = timeStr.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function CandlestickChart({ candles, entry, sl, target, pivotPoints, height, prediction, timeframeMinutes = 5 }: Props) {
  if (candles.length === 0) return null

  const lastCandle = candles[candles.length - 1]

  // Phantom slots for the future zone
  const phantom = Array.from({ length: FUTURE_SLOTS }, (_, i) => ({
    index: candles.length + i,
    time: addMinutes(lastCandle.time, (i + 1) * timeframeMinutes),
    open: 0, high: 0, low: 0, close: 0, volume: 0,
  }))

  const data = [
    ...candles.map((c, i) => ({ ...c, index: i })),
    ...phantom,
  ]

  const allPrices = candles.flatMap(c => [c.high, c.low])
  // Include prediction prices in y-domain so they're always visible
  if (prediction) {
    allPrices.push(prediction.entry, prediction.sl, prediction.target)
  }
  const priceMin = Math.min(...allPrices) - 20
  const priceMax = Math.max(...allPrices) + 20

  const showPrediction = prediction && prediction.entry > 0 && prediction.sl > 0 && prediction.target > 0

  return (
    <div style={{ height: height ?? '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 60, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="2 6" stroke="#0f1f35" vertical={false} />
          <XAxis dataKey="index" tick={{ fill: '#334155', fontSize: 9 }} axisLine={false} tickLine={false} interval={5}
            tickFormatter={(i: number) => data[i]?.time ?? ''} />
          <YAxis domain={[priceMin, priceMax]} tick={{ fill: '#334155', fontSize: 9 }} axisLine={false} tickLine={false} width={50}
            tickFormatter={v => formatNumber(v, 0)} orientation="right" />
          <Tooltip
            contentStyle={{ background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: 4, fontSize: 10 }}
            labelStyle={{ color: '#64748b' }}
            formatter={(value: number, name: string) => [formatNumber(value, 2), name]}
          />

          <Line dataKey="ema9"  stroke="#22c55e" strokeWidth={1.5} dot={false} isAnimationActive={false} name="EMA 9" />
          <Line dataKey="ema20" stroke="#38bdf8" strokeWidth={1.5} dot={false} isAnimationActive={false} name="EMA 20" />
          <Line dataKey="ema50" stroke="#f59e0b" strokeWidth={1.5} dot={false} isAnimationActive={false} name="EMA 50" />
          <Line dataKey="vwap"  stroke="#a855f7" strokeWidth={1.2} strokeDasharray="4 3" dot={false} isAnimationActive={false} name="VWAP" />

          {/* Pivot lines */}
          {pivotPoints && PIVOT_LINES.map(({ key, label, color, dash }) => {
            const val = pivotPoints[key] as number
            if (val < priceMin || val > priceMax) return null
            return (
              <ReferenceLine key={key} y={val} stroke={color} strokeDasharray={dash} strokeWidth={1}
                label={{ value: `${label} ${formatNumber(val, 0)}`, fill: color, fontSize: 8, position: 'right' }} />
            )
          })}

          {/* PA Setup lines (from Price Action Analyser) */}
          {entry  && <ReferenceLine y={entry}  stroke="#22c55e" strokeDasharray="5 3" strokeWidth={1.5} label={{ value: `ENTRY ${formatNumber(entry, 0)}`,  fill: '#22c55e', fontSize: 9, position: 'right' }} />}
          {sl     && <ReferenceLine y={sl}     stroke="#ef4444" strokeDasharray="5 3" strokeWidth={1.2} label={{ value: `SL ${formatNumber(sl, 0)}`,         fill: '#ef4444', fontSize: 9, position: 'right' }} />}
          {target && <ReferenceLine y={target} stroke="#38bdf8" strokeDasharray="5 3" strokeWidth={1.5} label={{ value: `TGT ${formatNumber(target, 0)}`,    fill: '#38bdf8', fontSize: 9, position: 'right' }} />}

          {/* Candlestick SVG layer */}
          <Customized component={(props: Record<string, unknown>) => <Candles {...props as Parameters<typeof Candles>[0]} data={candles} />} />

          {/* Future entry-prediction overlay */}
          {showPrediction && (
            <Customized component={(props: Record<string, unknown>) => (
              <PredictionOverlay
                {...props as unknown as Parameters<typeof PredictionOverlay>[0]}
                prediction={prediction}
                lastIdx={candles.length - 1}
                lastClose={lastCandle.close}
              />
            )} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
