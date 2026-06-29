import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Customized } from 'recharts'
import type { Candle, PivotPoints } from '@/core/types'
import { formatNumber } from '@/lib/utils'

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

interface Props {
  candles: Candle[]
  entry?: number
  sl?: number
  target?: number
  pivotPoints?: PivotPoints | null
  height?: number | string
}

const PIVOT_LINES = [
  { key: 'r2' as keyof PivotPoints, label: 'R2', color: '#22c55e', dash: '3 4' },
  { key: 'r1' as keyof PivotPoints, label: 'R1', color: '#86efac', dash: '3 4' },
  { key: 'pp' as keyof PivotPoints, label: 'PP', color: '#f59e0b', dash: '5 3' },
  { key: 's1' as keyof PivotPoints, label: 'S1', color: '#fca5a5', dash: '3 4' },
  { key: 's2' as keyof PivotPoints, label: 'S2', color: '#ef4444', dash: '3 4' },
]

export function CandlestickChart({ candles, entry, sl, target, pivotPoints, height }: Props) {
  if (candles.length === 0) return null

  const data = candles.map((c, i) => ({ ...c, index: i }))
  const allPrices = candles.flatMap(c => [c.high, c.low])
  const priceMin = Math.min(...allPrices) - 20
  const priceMax = Math.max(...allPrices) + 20

  return (
    <div style={{ height: height ?? '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 50, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="2 6" stroke="#0f1f35" vertical={false} />
          <XAxis dataKey="index" tick={{ fill: '#334155', fontSize: 9 }} axisLine={false} tickLine={false} interval={5}
            tickFormatter={(i: number) => candles[i]?.time ?? ''} />
          <YAxis domain={[priceMin, priceMax]} tick={{ fill: '#334155', fontSize: 9 }} axisLine={false} tickLine={false} width={50}
            tickFormatter={v => formatNumber(v, 0)} orientation="right" />
          <Tooltip
            contentStyle={{ background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: 4, fontSize: 10 }}
            labelStyle={{ color: '#64748b' }}
            formatter={(value: number, name: string) => [formatNumber(value, 2), name]}
          />

          <Line dataKey="ema9" stroke="#22c55e" strokeWidth={1.5} dot={false} isAnimationActive={false} name="EMA 9" />
          <Line dataKey="ema20" stroke="#38bdf8" strokeWidth={1.5} dot={false} isAnimationActive={false} name="EMA 20" />
          <Line dataKey="ema50" stroke="#f59e0b" strokeWidth={1.5} dot={false} isAnimationActive={false} name="EMA 50" />
          <Line dataKey="vwap" stroke="#a855f7" strokeWidth={1.2} strokeDasharray="4 3" dot={false} isAnimationActive={false} name="VWAP" />

          {/* Pivot point lines */}
          {pivotPoints && PIVOT_LINES.map(({ key, label, color, dash }) => {
            const val = pivotPoints[key] as number
            if (val < priceMin || val > priceMax) return null
            return (
              <ReferenceLine
                key={key}
                y={val}
                stroke={color}
                strokeDasharray={dash}
                strokeWidth={1}
                label={{ value: `${label} ${formatNumber(val, 0)}`, fill: color, fontSize: 8, position: 'right' }}
              />
            )
          })}

          {/* PA Setup lines */}
          {entry && <ReferenceLine y={entry} stroke="#22c55e" strokeDasharray="5 3" strokeWidth={1.5} label={{ value: `ENTRY ${formatNumber(entry, 0)}`, fill: '#22c55e', fontSize: 9, position: 'right' }} />}
          {sl && <ReferenceLine y={sl} stroke="#ef4444" strokeDasharray="5 3" strokeWidth={1.2} label={{ value: `SL ${formatNumber(sl, 0)}`, fill: '#ef4444', fontSize: 9, position: 'right' }} />}
          {target && <ReferenceLine y={target} stroke="#38bdf8" strokeDasharray="5 3" strokeWidth={1.5} label={{ value: `TGT ${formatNumber(target, 0)}`, fill: '#38bdf8', fontSize: 9, position: 'right' }} />}

          <Customized component={(props: Record<string, unknown>) => <Candles {...props as Parameters<typeof Candles>[0]} data={candles} />} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
