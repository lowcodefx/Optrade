# Both Modules 100% Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all remaining gaps in the Optrade Options Buying module and the Optrade Swing module, making both production-ready.

**Architecture:** Six focused tasks — three per module. Options gaps: discipline gate at order entry, score explainability panels, and a NIFTY 15min trend filter. Swing gaps: CNC equity buy button, sector momentum overlay computed from existing data, and a trade log for journalling entry reasons.

**Tech Stack:** React 18, TypeScript strict, Tailwind CSS, TanStack Query, Zustand, Express proxy, Kite API (via VM proxy only), node `https` module on backend.

## Global Constraints

- **SECURITY HARD RULE**: React MUST NEVER call Zerodha APIs (`api.kite.trade`) directly. ALL Kite calls go through the backend VM proxy at `/api/kite?kite_path=...` with header `X-Kite-Auth: token <apiKey>:<accessToken>` via `kiteAuthHeaders()` from `@/core/services/apiClient`.
- TypeScript strict — zero TS6133 unused-variable errors. Any unused import/var causes a blank page via MIME error on Azure SWA. Always run `npx tsc -b --noEmit` before committing.
- Dark theme constants: bg `#060d1a`, panel `#0a1628`, border `#1e293b`, accent `#38bdf8`, green `#22c55e`, red `#ef4444`, amber `#f59e0b`. Base font `text-[10px]`.
- Build gate: `npx tsc -b --noEmit` + `npx vite build` must both pass before any commit.
- No new npm packages — use only what's already in `package.json`.
- Commit after every task.

---

## File Map

**Options module:**
- Modify: `src/features/order-entry/OrderEntry.tsx` (Tasks 1, 2, 3)
- Create: `server/src/routes/niftyTrend.js` (Task 3)
- Modify: `server/src/index.js` (Task 3)

**Swing module:**
- Modify: `src/features/stocks/components/TopStocksBucket.tsx` (Tasks 4, 5)
- Create: `src/features/stocks/components/TradeLog.tsx` (Task 6)
- Modify: `src/features/stocks/StocksPage.tsx` (Task 6)
- Modify: `src/features/stocks/components/StockPortfolioSummary.tsx` (Task 6)

---

### Task 1: Options — Discipline gate in OrderEntry

**Files:**
- Modify: `src/features/order-entry/OrderEntry.tsx`

**Interfaces:**
- Consumes: `useDisciplineStore()` from `@/core/store` — `isLocked: boolean`, `lockReason: string`, `checkCanTrade(): { allowed: boolean, reason?: string, warning?: string }`
- Produces: `canPlace` extended; discipline banner visible when locked or warned

**Context:** `OrderEntry.tsx` currently sets `canPlace = rrOk && !mutation.isPending`. It imports nothing from `useDisciplineStore`. The discipline store is already wired with `isLocked`, `lockReason`, and `checkCanTrade()` (returns `{ allowed, reason?, warning? }`). The store is persisted — `isLocked` survives refreshes.

- [ ] **Step 1: Read the current canPlace logic in OrderEntry.tsx**

Open `src/features/order-entry/OrderEntry.tsx`. Find `const canPlace` (search for `rrOk`). Note the exact line and surrounding imports. Also note where the BUY button is rendered (search for `mutation.isPending`).

- [ ] **Step 2: Add useDisciplineStore import and read state**

At the top of the import block (after existing `@/core/store` imports), add:

```tsx
import { useDisciplineStore } from '@/core/store'
```

Inside the component body (near the top, after existing store reads):

```tsx
const { isLocked, lockReason, checkCanTrade } = useDisciplineStore()
const canTrade = checkCanTrade()
```

- [ ] **Step 3: Extend canPlace**

Find the existing `canPlace` line. Replace it so discipline blocks the order:

```tsx
// Before:
const canPlace = rrOk && !mutation.isPending

// After:
const canPlace = rrOk && !mutation.isPending && !isLocked && canTrade.allowed
```

- [ ] **Step 4: Add discipline banner above the BUY button**

Directly above the `<button>` that places the order (search for `mutation.isPending` in JSX), insert:

```tsx
{/* Discipline lock banner */}
{(isLocked || !canTrade.allowed) && (
  <div className="mx-2 mb-2 px-3 py-2 rounded bg-[#ef4444]/10 border border-[#ef4444]/30 text-[9px] text-[#ef4444] leading-relaxed">
    🔒 {lockReason || canTrade.reason || 'Trading locked by discipline rules'}
  </div>
)}
{/* Discipline warning banner */}
{!isLocked && canTrade.allowed && canTrade.warning && (
  <div className="mx-2 mb-2 px-3 py-2 rounded bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[9px] text-[#f59e0b] leading-relaxed">
    ⚠️ {canTrade.warning}
  </div>
)}
```

- [ ] **Step 5: TypeScript check**

```
npx tsc -b --noEmit
```
Expected: no errors.

- [ ] **Step 6: Build + commit**

```
npx vite build
git add src/features/order-entry/OrderEntry.tsx
git commit -m "Options: wire discipline gate into OrderEntry canPlace and show lock/warning banners"
```

---

### Task 2: Options — Score breakdown panels (explainability)

**Files:**
- Modify: `src/features/order-entry/OrderEntry.tsx`

**Interfaces:**
- Consumes from `useMarketStore`: `scoreBreakdown: ScoreBreakdown[]` (shape: `{ factor, cePoints, pePoints, maxPoints }`), `tradeStrength: TradeStrengthResult | null` (has `.signals: Array<{ name, value, passed, weight }>`)
- Consumes from component-local: `riskScore` (returned by `calculateRiskScore()`, already called inline) — shape: `{ score, label, signals: Array<{ name, points, maxPoints, passed, detail }> }`
- Produces: each score badge gets a toggle button that reveals a breakdown table

**Context:** The `OrderEntry` component renders 4 `ScoreBadge` cards in a grid: CE Score, PE Score, Trade Strength, Risk Score. `scoreBreakdown` (CE/PE factor breakdown) is already in the store. `tradeStrength.signals` is already in the store. `riskScore` is computed inline. None of these are currently shown to the user.

- [ ] **Step 1: Read the ScoreBadge section in OrderEntry.tsx**

Search for `ScoreBadge` in the file — find the component definition and all 4 usages. Note how the grid is structured.

- [ ] **Step 2: Add expanded state per badge**

Inside the component, add state for which badge is expanded:

```tsx
const [expandedBadge, setExpandedBadge] = useState<'ce' | 'pe' | 'strength' | 'risk' | null>(null)
```

- [ ] **Step 3: Read scoreBreakdown and tradeStrength from the store**

Ensure these are destructured from `useMarketStore`:

```tsx
const { ..., scoreBreakdown, tradeStrength } = useMarketStore()
```

(They may already be partially destructured — just add the missing ones.)

- [ ] **Step 4: Create BreakdownTable helper component**

Add this above the main component definition (or inline as a local function):

```tsx
function BreakdownRow({ label, val, max, passed }: { label: string; val: number; max: number; passed?: boolean }) {
  const pct = max > 0 ? Math.round((val / max) * 100) : 0
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${passed !== false ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`} />
      <span className="flex-1 text-[8px] text-[#94a3b8] truncate">{label}</span>
      <span className="text-[8px] font-semibold text-white">{val}/{max}</span>
      <div className="w-10 h-1 bg-[#1e293b] rounded-full overflow-hidden">
        <div className="h-full bg-[#38bdf8] rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Modify the CE Score badge to be expandable**

Find the CE Score `ScoreBadge` usage. Wrap it in a `<div>` with a toggle button and a conditional breakdown:

```tsx
<div>
  <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedBadge(expandedBadge === 'ce' ? null : 'ce')}>
    <ScoreBadge ... />
    <ChevronDown size={8} className={`text-[#475569] transition-transform ${expandedBadge === 'ce' ? 'rotate-180' : ''}`} />
  </div>
  {expandedBadge === 'ce' && scoreBreakdown.length > 0 && (
    <div className="mt-1 px-2 py-1.5 bg-[#0a1628] rounded border border-[#1e293b] space-y-0.5">
      {scoreBreakdown.map(b => (
        <BreakdownRow key={b.factor} label={b.factor} val={b.cePoints} max={b.maxPoints} passed={b.cePoints > 0} />
      ))}
    </div>
  )}
</div>
```

Do the same for PE Score (use `b.pePoints`).

- [ ] **Step 6: Make Trade Strength badge expandable**

```tsx
{expandedBadge === 'strength' && tradeStrength?.signals && tradeStrength.signals.length > 0 && (
  <div className="mt-1 px-2 py-1.5 bg-[#0a1628] rounded border border-[#1e293b] space-y-0.5">
    {tradeStrength.signals.map(s => (
      <BreakdownRow key={s.name} label={s.name} val={s.passed ? s.weight : 0} max={s.weight} passed={s.passed} />
    ))}
  </div>
)}
```

- [ ] **Step 7: Make Risk Score badge expandable**

`riskScore` is already computed inline from `calculateRiskScore(...)`. Store it in a variable (it may already be):

```tsx
const riskScore = calculateRiskScore({ entry, stopLoss, target, ... })
```

Then in JSX:

```tsx
{expandedBadge === 'risk' && riskScore.signals.length > 0 && (
  <div className="mt-1 px-2 py-1.5 bg-[#0a1628] rounded border border-[#1e293b] space-y-0.5">
    {riskScore.signals.map(s => (
      <BreakdownRow key={s.name} label={s.name} val={s.points} max={s.maxPoints} passed={s.passed} />
    ))}
  </div>
)}
```

- [ ] **Step 8: Ensure ChevronDown is imported**

```tsx
import { ..., ChevronDown } from 'lucide-react'
```

- [ ] **Step 9: TypeScript check + build + commit**

```
npx tsc -b --noEmit
npx vite build
git add src/features/order-entry/OrderEntry.tsx
git commit -m "Options: add score breakdown panels (CE/PE factors, trade strength signals, risk signals)"
```

---

### Task 3: Options — NIFTY 15min trend filter

**Files:**
- Create: `server/src/routes/niftyTrend.js`
- Modify: `server/src/index.js`
- Modify: `src/features/order-entry/OrderEntry.tsx`

**Interfaces:**
- Backend produces: `GET /api/nifty-trend` → `{ bias: 'UP'|'DOWN'|'NEUTRAL', ema20: number, spot: number, note: string }`
- Frontend consumes via `useQuery(['niftyTrend'], ...)`, reads `bias` field
- Produces: trend badge in OrderEntry; CE blocked when bias=DOWN, PE blocked when bias=UP

**Context:** NIFTY 50 Kite instrument token is `256265`. The backend calls Kite historical API at `https://api.kite.trade/instruments/historical/256265/15minute?from=...&to=...` using the `X-Kite-Auth` header passed from the frontend. EMA is a simple exponential moving average. The `server/src/routes/kite.js` proxy allows paths starting with `instruments`, but for this we want server-side EMA computation, so we create a dedicated route.

- [ ] **Step 1: Create server/src/routes/niftyTrend.js**

```js
const https  = require('https')
const router = require('express').Router()

const NIFTY_TOKEN = 256265
const EMA_PERIOD  = 20

// Simple EMA computation
function ema(closes, period) {
  if (closes.length < period) return null
  const k  = 2 / (period + 1)
  let e    = closes.slice(0, period).reduce((s, v) => s + v, 0) / period
  for (let i = period; i < closes.length; i++) e = closes[i] * k + e * (1 - k)
  return +e.toFixed(2)
}

function kiteHistorical(token, interval, from, to, authHeader) {
  return new Promise((resolve, reject) => {
    const path = `/instruments/historical/${token}/${interval}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&continuous=0&oi=0`
    const req  = https.get(`https://api.kite.trade${path}`, {
      headers: { 'X-Kite-Version': '3', Authorization: authHeader },
    }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())) }
        catch { reject(new Error('parse error')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

router.get('/', async (req, res) => {
  const auth = req.headers['x-kite-auth']
  if (!auth) return res.status(401).json({ error: 'missing x-kite-auth' })

  // IST offset: UTC+5:30
  const now      = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  const istNow   = new Date(now.getTime() + istOffset)
  const todayIST = istNow.toISOString().slice(0, 10)
  // Fetch 3 days of 15min candles (enough for 30+ candles on a trading day)
  const d = new Date(istNow)
  d.setDate(d.getDate() - 4)
  const fromDate = d.toISOString().slice(0, 10)
  const from = `${fromDate} 09:15:00`
  const to   = `${todayIST} 15:30:00`

  try {
    const kiteRes = await kiteHistorical(NIFTY_TOKEN, '15minute', from, to, auth)
    const candles = kiteRes.data?.candles ?? []   // [timestamp, open, high, low, close, volume, oi]
    if (candles.length < EMA_PERIOD) {
      return res.json({ bias: 'NEUTRAL', ema20: null, spot: null, note: 'Insufficient candle data' })
    }
    const closes = candles.map(c => c[4])
    const spot   = closes[closes.length - 1]
    const e20    = ema(closes, EMA_PERIOD)
    const diff   = e20 ? ((spot - e20) / e20) * 100 : 0
    const bias   = diff > 0.15 ? 'UP' : diff < -0.15 ? 'DOWN' : 'NEUTRAL'
    const note   = `NIFTY ${spot.toFixed(0)} vs EMA20 ${e20} (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%)`
    return res.json({ bias, ema20: e20, spot, note })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

module.exports = router
```

- [ ] **Step 2: Register in server/src/index.js**

After the existing route registrations, add:

```js
app.use('/api/nifty-trend', require('./routes/niftyTrend'))
```

- [ ] **Step 3: Add trend query to OrderEntry.tsx**

In the imports, add `useQuery` if not already imported from `@tanstack/react-query`. Also import `API_BASE`, `kiteAuthHeaders` if not already imported.

Inside the component, add:

```tsx
const { data: trendData } = useQuery({
  queryKey: ['niftyTrend'],
  queryFn: async () => {
    const res = await fetch(`${API_BASE}/api/nifty-trend`, { headers: kiteAuthHeaders() })
    if (!res.ok) return { bias: 'NEUTRAL' as const, note: '' }
    return res.json() as Promise<{ bias: 'UP' | 'DOWN' | 'NEUTRAL'; ema20: number | null; spot: number | null; note: string }>
  },
  refetchInterval: 5 * 60 * 1000,   // refresh every 5 min
  staleTime: 4 * 60 * 1000,
  retry: false,
})
const trendBias = trendData?.bias ?? 'NEUTRAL'
```

- [ ] **Step 4: Extend canPlace with trend gate**

```tsx
// CE blocked if NIFTY trend is DOWN; PE blocked if NIFTY trend is UP
const trendBlocksCE = trendBias === 'DOWN'
const trendBlocksPE = trendBias === 'UP'
const optionType = useOrderStore(s => s.optionType)  // already likely destructured
const trendBlocks = (optionType === 'CE' && trendBlocksCE) || (optionType === 'PE' && trendBlocksPE)

const canPlace = rrOk && !mutation.isPending && !isLocked && canTrade.allowed && !trendBlocks
```

- [ ] **Step 5: Add trend badge to the UI**

In the header area of OrderEntry (or near the top of the panel, before the score badges), add:

```tsx
{/* NIFTY trend indicator */}
<div className="flex items-center gap-1.5 px-3 py-1 border-b border-[#1e293b] bg-[#0a1628]">
  <span className="text-[8px] text-[#475569] uppercase tracking-wider">NIFTY 15m Trend</span>
  {trendBias === 'UP' && <span className="text-[9px] font-bold text-[#22c55e]">↑ Uptrend</span>}
  {trendBias === 'DOWN' && <span className="text-[9px] font-bold text-[#ef4444]">↓ Downtrend</span>}
  {trendBias === 'NEUTRAL' && <span className="text-[9px] font-bold text-[#475569]">→ Neutral</span>}
  {trendData?.note && <span className="text-[7px] text-[#334155] ml-auto truncate max-w-[110px]" title={trendData.note}>{trendData.note}</span>}
</div>
{/* Trend block banner */}
{trendBlocks && (
  <div className="mx-2 mb-1 px-3 py-1.5 rounded bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[9px] text-[#f59e0b]">
    ⚠️ NIFTY trend opposes this trade direction ({trendBias === 'DOWN' ? 'Downtrend — avoid CE' : 'Uptrend — avoid PE'})
  </div>
)}
```

- [ ] **Step 6: TypeScript check + build + commit**

```
npx tsc -b --noEmit
npx vite build
git add server/src/routes/niftyTrend.js server/src/index.js src/features/order-entry/OrderEntry.tsx
git commit -m "Options: NIFTY 15min trend filter — backend EMA route, frontend badge, CE/PE gate"
```

---

### Task 4: Swing — CNC Equity Buy button

**Files:**
- Modify: `src/features/stocks/components/TopStocksBucket.tsx`

**Interfaces:**
- Consumes: `last_price` and `instrument_token` on each `StockScore` (already present from `/api/stock-analysis`)
- Produces: "Buy" button in each stock row → confirm modal with qty → POST CNC order via proxy

**Context:** The Kite proxy at `/api/kite` handles POST. Order placement uses `kite_path=orders/regular`. Request body must be `application/x-www-form-urlencoded`. The proxy forwards the body and content-type as-is. Fields: `exchange=NSE&tradingsymbol=INFY&transaction_type=BUY&quantity=10&product=CNC&order_type=LIMIT&price=1590.00&validity=DAY`.

- [ ] **Step 1: Add buy modal state to TopStocksBucket**

Inside the main component (near `selectedSector` state), add:

```tsx
const [buyStock, setBuyStock] = useState<{ symbol: string; price: number } | null>(null)
const [buyQty, setBuyQty] = useState('1')
const [buyError, setBuyError] = useState<string | null>(null)
const [buyLoading, setBuyLoading] = useState(false)
const [buySuccess, setBuySuccess] = useState<string | null>(null)
```

- [ ] **Step 2: Implement placeCNCOrder function**

Add this inside the component (or as a module-level async function):

```tsx
async function placeCNCOrder(symbol: string, price: number, qty: number): Promise<string> {
  const body = new URLSearchParams({
    exchange: 'NSE',
    tradingsymbol: symbol,
    transaction_type: 'BUY',
    quantity: String(qty),
    product: 'CNC',
    order_type: 'LIMIT',
    price: price.toFixed(2),
    validity: 'DAY',
  }).toString()

  const res = await fetch(`${API_BASE}/api/kite?kite_path=orders/regular`, {
    method: 'POST',
    headers: { ...kiteAuthHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`)
  return json.data?.order_id ?? 'placed'
}
```

- [ ] **Step 3: Add Buy icon button to StockRow**

In the `StockRow` component, after the existing action buttons (Info, Bookmark, Chart), add:

```tsx
<button
  title="Buy CNC"
  onClick={e => { e.stopPropagation(); onBuy(s.symbol, s.last_price ?? 0) }}
  className="p-1 rounded text-[#22c55e]/60 hover:text-[#22c55e] hover:bg-[#22c55e]/10 transition-colors"
>
  <ShoppingCart size={11} />
</button>
```

Add `ShoppingCart` to the lucide-react import. Add `onBuy: (symbol: string, price: number) => void` to `StockRow` props interface.

- [ ] **Step 4: Wire onBuy through Top10View and AccordionSection**

Pass `onBuy={s => setBuyStock({ symbol: s, price: ... })}` from the main component down through `Top10View` and `AccordionSection` to `StockRow`. For price, pass `s.last_price ?? 0`. Each intermediary needs `onBuy` in its props interface.

- [ ] **Step 5: Build the Buy Confirm modal**

After the existing `infoStock` modal (or ChartModal), add:

```tsx
{buyStock && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setBuyStock(null)}>
    <div className="bg-[#0a1628] border border-[#1e293b] rounded-xl p-5 w-72 shadow-2xl" onClick={e => e.stopPropagation()}>
      <h3 className="text-white font-bold text-sm mb-3">Place CNC Buy — {buyStock.symbol}</h3>
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-[10px]">
          <span className="text-[#475569]">Limit Price</span>
          <span className="text-white font-semibold">₹{buyStock.price.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#475569]">Quantity</span>
          <input
            type="number" min="1" value={buyQty}
            onChange={e => setBuyQty(e.target.value)}
            className="flex-1 bg-[#060d1a] border border-[#1e293b] rounded px-2 py-1 text-white text-[10px] text-right focus:outline-none focus:border-[#38bdf8]"
          />
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-[#475569]">Order Value</span>
          <span className="text-white font-semibold">₹{(buyStock.price * (parseInt(buyQty) || 1)).toLocaleString('en-IN')}</span>
        </div>
      </div>
      {buyError && <p className="text-[9px] text-[#ef4444] mb-2">{buyError}</p>}
      {buySuccess && <p className="text-[9px] text-[#22c55e] mb-2">✓ Order placed — {buySuccess}</p>}
      <div className="flex gap-2">
        <button onClick={() => setBuyStock(null)} className="flex-1 py-1.5 rounded border border-[#1e293b] text-[10px] text-[#475569] hover:text-white">Cancel</button>
        <button
          disabled={buyLoading}
          onClick={async () => {
            setBuyError(null); setBuySuccess(null); setBuyLoading(true)
            try {
              const orderId = await placeCNCOrder(buyStock.symbol, buyStock.price, parseInt(buyQty) || 1)
              setBuySuccess(`Order ID ${orderId}`)
              setTimeout(() => setBuyStock(null), 2000)
            } catch (err: unknown) {
              setBuyError(err instanceof Error ? err.message : 'Order failed')
            } finally {
              setBuyLoading(false)
            }
          }}
          className="flex-1 py-1.5 rounded bg-[#22c55e]/90 hover:bg-[#22c55e] disabled:opacity-50 text-white text-[10px] font-bold"
        >
          {buyLoading ? 'Placing…' : 'Confirm Buy'}
        </button>
      </div>
      <p className="text-[7px] text-[#334155] text-center mt-2">CNC · LIMIT · NSE · DAY</p>
    </div>
  </div>
)}
```

- [ ] **Step 6: TypeScript check + build + commit**

```
npx tsc -b --noEmit
npx vite build
git add src/features/stocks/components/TopStocksBucket.tsx
git commit -m "Swing: add CNC equity buy button with confirm modal and Kite order placement"
```

---

### Task 5: Swing — Sector momentum overlay

**Files:**
- Modify: `src/features/stocks/components/TopStocksBucket.tsx`

**Interfaces:**
- Consumes: `AnalysisResult` (already loaded) — each `StockScore` has `rs1d: number | null`; `SECTOR_STOCKS` maps sector → symbol list
- Produces: small trend arrow on each sector pill showing average RS1d vs NIFTY for that sector

**Context:** `rs1d` = stock's day change % minus NIFTY's day change %. If the average `rs1d` of stocks in a sector is above +1.0%, the sector is outperforming NIFTY → bullish. Below -1.0% → underperforming → bearish. This requires no new API call.

- [ ] **Step 1: Write the sector momentum helper**

Add this pure function above the component (or as a module-level function) in `TopStocksBucket.tsx`:

```tsx
function sectorMomentum(sectorName: string, data: AnalysisResult): number | null {
  const symbols  = SECTOR_STOCKS[sectorName] ?? []
  const allStocks = [...data.largeCap, ...data.midCap, ...data.smallCap]
  const matched  = allStocks.filter(s => symbols.includes(s.symbol) && s.rs1d !== null)
  if (!matched.length) return null
  const avg = matched.reduce((sum, s) => sum + (s.rs1d ?? 0), 0) / matched.length
  return +avg.toFixed(2)
}
```

- [ ] **Step 2: Add momentum display to sector pills**

In the sector pills render block (inside the `{Object.keys(SECTOR_STOCKS).map(name => { ... })}` loop), after the sector name text, add momentum arrow:

```tsx
{data && (() => {
  const mom = sectorMomentum(name, data)
  if (mom === null) return null
  if (mom >= 1.0) return <span className="text-[7px] text-[#22c55e] leading-none">↑</span>
  if (mom <= -1.0) return <span className="text-[7px] text-[#ef4444] leading-none">↓</span>
  return <span className="text-[7px] text-[#475569] leading-none">→</span>
})()}
```

Also add a `title` attribute on the pill button showing the numeric momentum:

```tsx
title={data ? `Avg RS vs NIFTY: ${sectorMomentum(name, data)?.toFixed(2) ?? 'n/a'}%` : name}
```

- [ ] **Step 3: Ensure `data` is accessible at the pill render site**

The `data` variable (from `useQuery`) is in scope in the main `TopStocksBucket` component, and the sector pills are rendered in the same component body. Confirm the pills are inside the main component (not a sub-component). If they are in a sub-component, pass `data` as a prop.

- [ ] **Step 4: TypeScript check + build + commit**

```
npx tsc -b --noEmit
npx vite build
git add src/features/stocks/components/TopStocksBucket.tsx
git commit -m "Swing: sector momentum overlay — RS1d avg arrow on each sector pill (no new API)"
```

---

### Task 6: Swing — Trade log

**Files:**
- Create: `src/features/stocks/components/TradeLog.tsx`
- Modify: `src/features/stocks/StocksPage.tsx`
- Modify: `src/features/stocks/components/StockPortfolioSummary.tsx`

**Interfaces:**
- Produces: `TradeLog` component that reads/writes `localStorage('sw_trade_log')`; `LogEntryModal` triggered when a stock is bookmarked; log viewer in the right panel
- Consumes (from parent): `onLogEntry: (symbol: string, price: number) => void` callback; parents call this on bookmark/buy

**Context:** When a user bookmarks (adds to watchlist) or places a CNC buy, we prompt them to record *why* (optional — they can skip). The log entry is appended to `localStorage('sw_trade_log')` as `{ id, symbol, date, price, action, signal, note }`. The log is displayed in the right panel (StockPortfolioSummary), below EventsCalendar.

- [ ] **Step 1: Create src/features/stocks/components/TradeLog.tsx**

```tsx
import { useState } from 'react'
import { BookOpen, X } from 'lucide-react'

export interface TradeEntry {
  id: string
  symbol: string
  date: string       // ISO
  price: number
  action: 'Watchlist' | 'CNC Buy'
  signal: string
  note: string
}

const LOG_KEY = 'sw_trade_log'

export function loadTradeLog(): TradeEntry[] {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]') } catch { return [] }
}

export function appendTradeLog(e: Omit<TradeEntry, 'id' | 'date'>) {
  const entries = loadTradeLog()
  entries.unshift({ ...e, id: Date.now().toString(), date: new Date().toISOString() })
  localStorage.setItem(LOG_KEY, JSON.stringify(entries.slice(0, 100)))  // keep last 100
}

const SIGNALS = ['Volume Spike', 'EMA Bounce', 'Breakout', 'RS Strength', 'Pattern Signal', 'News Catalyst', 'Other']

interface LogEntryModalProps {
  symbol: string
  price: number
  action: 'Watchlist' | 'CNC Buy'
  onClose: () => void
}

export function LogEntryModal({ symbol, price, action, onClose }: LogEntryModalProps) {
  const [signal, setSignal] = useState(SIGNALS[0])
  const [note, setNote] = useState('')

  function save() {
    appendTradeLog({ symbol, price, action, signal, note })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-[#0a1628] border border-[#1e293b] rounded-xl p-5 w-72 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold text-sm">Log Trade Entry</h3>
          <button onClick={onClose} className="text-[#334155] hover:text-white"><X size={13} /></button>
        </div>
        <div className="space-y-3 mb-4">
          <div className="flex justify-between text-[9px]">
            <span className="text-[#475569]">{action}</span>
            <span className="text-white font-semibold">{symbol} @ ₹{price.toFixed(2)}</span>
          </div>
          <div>
            <label className="text-[8px] text-[#475569] uppercase tracking-wider block mb-1">Signal that triggered entry</label>
            <select
              value={signal} onChange={e => setSignal(e.target.value)}
              className="w-full bg-[#060d1a] border border-[#1e293b] rounded px-2 py-1 text-white text-[9px] focus:outline-none focus:border-[#38bdf8]"
            >
              {SIGNALS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[8px] text-[#475569] uppercase tracking-wider block mb-1">Note (optional)</label>
            <textarea
              value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder="Why this stock, why now…"
              className="w-full bg-[#060d1a] border border-[#1e293b] rounded px-2 py-1 text-white text-[9px] resize-none focus:outline-none focus:border-[#38bdf8] placeholder-[#334155]"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-1.5 rounded border border-[#1e293b] text-[9px] text-[#475569] hover:text-white">Skip</button>
          <button onClick={save} className="flex-1 py-1.5 rounded bg-[#38bdf8]/90 hover:bg-[#38bdf8] text-[#060d1a] text-[9px] font-bold">Save Log</button>
        </div>
      </div>
    </div>
  )
}

export function TradeLogPanel() {
  const [entries, setEntries] = useState<TradeEntry[]>(loadTradeLog)

  function remove(id: string) {
    const next = entries.filter(e => e.id !== id)
    setEntries(next)
    localStorage.setItem(LOG_KEY, JSON.stringify(next))
  }

  return (
    <div className="p-3">
      <div className="flex items-center gap-1.5 mb-3">
        <BookOpen size={11} className="text-[#38bdf8]" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#94a3b8]">Trade Log</span>
        <span className="ml-auto text-[8px] text-[#334155]">{entries.length} entries</span>
      </div>
      {entries.length === 0 && (
        <p className="text-[8px] text-[#334155] text-center py-4">No entries yet. Log your entry reasons when bookmarking or buying stocks.</p>
      )}
      <div className="space-y-2">
        {entries.map(e => (
          <div key={e.id} className="bg-[#060d1a] border border-[#1e293b] rounded p-2 relative group">
            <button
              onClick={() => remove(e.id)}
              className="absolute top-1 right-1 text-[#1e293b] group-hover:text-[#334155] hover:!text-[#ef4444] transition-colors"
            >
              <X size={8} />
            </button>
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[9px] font-bold text-white">{e.symbol}</span>
              <span className="text-[7px] text-[#334155]">·</span>
              <span className={`text-[7px] font-semibold ${e.action === 'CNC Buy' ? 'text-[#22c55e]' : 'text-[#38bdf8]'}`}>{e.action}</span>
            </div>
            <div className="flex justify-between text-[8px]">
              <span className="text-[#f59e0b]">{e.signal}</span>
              <span className="text-[#475569]">₹{e.price.toFixed(0)}</span>
            </div>
            {e.note && <p className="text-[7px] text-[#334155] mt-0.5 leading-tight">{e.note}</p>}
            <p className="text-[7px] text-[#1e293b] mt-0.5">{new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add LogEntryModal to StocksPage.tsx**

In `src/features/stocks/StocksPage.tsx`, add state for pending log prompt:

```tsx
import { LogEntryModal } from './components/TradeLog'
// ...
const [pendingLog, setPendingLog] = useState<{ symbol: string; price: number; action: 'Watchlist' | 'CNC Buy' } | null>(null)
```

Modify `addToWatchlist` to trigger the log prompt:

```tsx
function addToWatchlist(symbol: string, price?: number) {
  setWatchlist(prev => {
    if (prev.includes(symbol)) return prev
    const next = [...prev, symbol]
    localStorage.setItem('sw_watchlist', JSON.stringify(next))
    return next
  })
  setPendingLog({ symbol, price: price ?? 0, action: 'Watchlist' })
}
```

Update `TopStocksBucket`'s `onAddToWatchlist` prop to pass price. In `TopStocksBucket`, where `onAddToWatchlist(s.symbol)` is called in the bookmark button, change to `onAddToWatchlist(s.symbol, s.last_price ?? 0)`. Update the prop type:

```tsx
// In TopStocksBucket props:
onAddToWatchlist: (symbol: string, price?: number) => void
```

In `StocksPage.tsx` JSX, render the modal:

```tsx
{pendingLog && (
  <LogEntryModal
    symbol={pendingLog.symbol}
    price={pendingLog.price}
    action={pendingLog.action}
    onClose={() => setPendingLog(null)}
  />
)}
```

- [ ] **Step 3: Add TradeLogPanel to StockPortfolioSummary**

```tsx
import { TradeLogPanel } from './TradeLog'

// Inside StockPortfolioSummary render, below EventsCalendar:
<div className="border-t border-[#1e293b]">
  <TradeLogPanel />
</div>
```

- [ ] **Step 4: Wire CNC Buy to trade log**

In `TopStocksBucket.tsx`, after a successful `placeCNCOrder`, call the parent's log callback. Add `onLogEntry?: (symbol: string, price: number, action: 'CNC Buy') => void` to `TopStocksBucket` props (optional). In `StocksPage.tsx`, pass `onLogEntry={(sym, price) => setPendingLog({ symbol: sym, price, action: 'CNC Buy' })}` to `TopStocksBucket`.

In `TopStocksBucket`'s buy success handler:

```tsx
// After: setBuySuccess(`Order ID ${orderId}`)
props.onLogEntry?.(buyStock.symbol, buyStock.price, 'CNC Buy')
```

- [ ] **Step 5: TypeScript check + build + commit**

```
npx tsc -b --noEmit
npx vite build
git add src/features/stocks/components/TradeLog.tsx src/features/stocks/StocksPage.tsx src/features/stocks/components/StockPortfolioSummary.tsx src/features/stocks/components/TopStocksBucket.tsx
git commit -m "Swing: trade log — entry modal on bookmark/buy, localStorage persistence, log viewer in right panel"
```

---

## Post-Plan Checklist

After all 6 tasks:
- [ ] Full TypeScript check: `npx tsc -b --noEmit` — zero errors
- [ ] Full build: `npx vite build` — success
- [ ] Server restart on VM: `pm2 restart optrade-api` (for Task 3's new route)
- [ ] Test discipline gate: lock trading via DisciplinePanel's "override" → OrderEntry should show lock banner
- [ ] Test trend filter: badge shows UP/DOWN/NEUTRAL; CE/PE correctly blocked
- [ ] Test CNC buy: with live Zerodha session, place a 1-share CNC LIMIT order
- [ ] Test sector momentum: sector pills should show ↑/↓/→ when stock-analysis data is loaded
- [ ] Test trade log: bookmark a stock → LogEntryModal appears → entry saved → visible in right panel
