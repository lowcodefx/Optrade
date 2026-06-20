# Optrade — NIFTY Options Trading Dashboard
**Design Spec · 2026-06-20**

---

## 1. Project Summary

A personal, production-ready React + TypeScript trading dashboard for NIFTY options buying. Integrates with Zerodha Kite Connect for live data and order execution. Dark-themed, laptop-first, single-screen layout.

---

## 2. Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Layout | Hybrid: fixed left/right docks + scrollable center | Order Entry always accessible; works on 1366×768 |
| Data source | Mock + Live toggle (`USE_MOCK` env flag) | Build without market-hours dependency; swap in one line |
| Journal persistence | IndexedDB (via `idb` library) | Handles thousands of records; no 5MB localStorage limit |
| Build scope | Phase 1 core panels first, Phase 2 extras | Ship tradeable dashboard fast; extras follow |
| Architecture | Hybrid: Core layers + Feature modules | Shared services centralised; each panel isolated |
| Primary device | Laptop-first (1366×768) | Scales up to desktop; mobile gets simplified read-only view |

---

## 3. Technology Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS + Shadcn UI |
| Server state | TanStack Query (React Query v5) |
| Client state | Zustand |
| Charts | Recharts |
| Icons | Lucide React |
| DB (journal) | IndexedDB via `idb` |
| HTTP | Axios (Zerodha Kite Connect REST) |
| Realtime | WebSocket (Kite Connect ticker) — Phase 2 |

---

## 4. Architecture — Hybrid Core Layers + Feature Modules

```
src/
├── core/                          # Shared infrastructure
│   ├── services/
│   │   ├── zerodha/
│   │   │   ├── zerodhaService.ts  # Real Kite Connect API calls
│   │   │   ├── mockService.ts     # Mock data matching same interface
│   │   │   └── index.ts           # Exports based on USE_MOCK flag
│   │   └── journal/
│   │       └── journalService.ts  # IndexedDB read/write
│   ├── store/
│   │   ├── marketStore.ts         # NIFTY spot, VIX, PCR, breadth
│   │   ├── orderStore.ts          # Order entry form state
│   │   ├── positionsStore.ts      # Open positions, P&L
│   │   ├── settingsStore.ts       # Capital, risk %, credentials
│   │   └── index.ts
│   ├── types/
│   │   ├── market.ts              # NiftyQuote, OptionChain, Strike
│   │   ├── order.ts               # Order, Position, Trade
│   │   ├── journal.ts             # JournalEntry, Analytics
│   │   └── index.ts
│   ├── hooks/
│   │   ├── useNiftyQuote.ts       # TanStack Query wrapper for spot
│   │   ├── useOptionChain.ts      # Option chain query + polling
│   │   ├── usePositions.ts        # Positions query
│   │   └── useRiskCalc.ts         # Pure calculation hook
│   └── utils/
│       ├── indicators.ts          # EMA, RSI, ADX calculations
│       ├── patternDetector.ts     # Candlestick pattern detection
│       ├── tradeStrength.ts       # 0-100 scoring engine
│       └── formatters.ts          # ₹ formatting, lot size, etc.
│
├── features/                      # One folder per dashboard panel
│   ├── header/
│   ├── market-context/
│   ├── trade-strength/
│   ├── chart/                     # Chart + Price Action Analyser
│   ├── options-chain/
│   ├── option-selection/
│   ├── order-entry/
│   ├── positions/
│   ├── risk-management/
│   ├── journal/                   # Phase 2
│   ├── alerts/                    # Phase 2
│   └── settings/
│
├── components/                    # Truly shared UI primitives
│   ├── InfoTooltip.tsx            # ⓘ icon + Shadcn Tooltip + Dialog
│   ├── StatusBadge.tsx            # Bullish/Bearish/Neutral chip
│   ├── PnlCell.tsx                # Coloured P&L number
│   └── SectionCard.tsx            # Dark card wrapper with header
│
├── layouts/
│   └── DashboardLayout.tsx        # Left dock + Center + Right dock
│
├── App.tsx
├── main.tsx
└── vite-env.d.ts
```

---

## 5. Screen Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  HEADER — NIFTY spot · change · % · time · market status · ⓘ       │
├──────────────┬──────────────────────────────────┬───────────────────┤
│  LEFT DOCK   │  CENTER (scrollable)             │  RIGHT DOCK       │
│  260px fixed │                                  │  280px fixed      │
│              │  [📈 Chart] [📊 Options Chain]   │                   │
│  Market      │  toggle + [Price Action Analyser]│  Order Entry      │
│  Context     │  [⛶ Fullscreen]                 │  (always visible) │
│  ─────────── │  ─────────────────────────────   │  ───────────────  │
│  Trade       │  Chart view:                     │  Risk Management  │
│  Strength    │  · 5-min NIFTY candlesticks      │                   │
│  Engine      │  · EMA 9/20/50 + VWAP overlays  │                   │
│  ─────────── │  · PA Analyser: trendlines,      │                   │
│  Trend       │    pattern badges, Entry/SL/Tgt  │                   │
│  Analysis    │  · Setup recommendation panel    │                   │
│  (EMA/RSI/   │  ─────────────────────────────   │                   │
│   ADX)       │  Options Chain view:             │                   │
│              │  · ATM±3 strikes                 │                   │
│              │  · CE OI/Chng/Vol/IV | Strike |  │                   │
│              │    IV/Vol/Chng/OI PE             │                   │
│              │  · ATM highlighted               │                   │
│              │  · Highest OI badges             │                   │
│              │  ─────────────────────────────   │                   │
│              │  Smart Option Selection          │                   │
│              │  · ATM CE / ATM PE / OTM cards   │                   │
│              │  · Best Buy / Moderate / Avoid   │                   │
│              │  · Greeks: Δ Γ θ ν IV            │                   │
│              │  ─────────────────────────────   │                   │
│              │  Open Positions                  │                   │
│              │  · Table: Instr/Qty/Entry/LTP/   │                   │
│              │    P&L / Exit button             │                   │
│              │  · Day P&L + Exposure footer     │                   │
└──────────────┴──────────────────────────────────┴───────────────────┘
```

---

## 6. Feature Specs — Phase 1

### 6.1 Header
- Displays: NIFTY spot, absolute change, % change, current time (live clock), market status (Open / Closed / Pre-open)
- Live indicator dot (green pulse animation when `USE_MOCK=false`)
- ⓘ tooltip explaining NIFTY index and its relevance to options

### 6.2 Market Context (Left Dock)
Four mini-cards: **VIX** · **PCR** · **Market Breadth** · **Trend Direction**

Color rules:
- Green = bullish (PCR > 1.2, Breadth > 60%, Spot > VWAP + EMA aligned up)
- Red = bearish (PCR < 0.8, Breadth < 40%, Spot < VWAP + EMA aligned down)
- Amber = neutral

### 6.3 Trade Strength Engine (Left Dock)
Score 0–100. Gauge chart (SVG arc, Recharts RadialBarChart).

| Signal | Weight |
|---|---|
| Above VWAP | 15 |
| EMA 9 > EMA 20 > EMA 50 | 20 |
| RSI 50–70 (bullish zone) | 15 |
| ADX > 25 (trending) | 10 |
| PCR > 1.0 | 15 |
| Put writing detected | 10 |
| Market Breadth > 55% | 10 |
| Volume > 20-bar avg | 5 |

Labels: 0–30 Weak · 31–60 Moderate · 61–80 Strong · 81–100 High Conviction

### 6.4 Trend Analysis (Left Dock)
Table of: EMA 9, EMA 20, EMA 50, RSI, ADX — each row shows current value + status chip + ⓘ tooltip explaining the indicator.

EMA values calculated locally from OHLC data via `utils/indicators.ts`. In Phase 1, OHLC data comes from Kite Connect's historical API (polled) or mock data array — not a live tick stream (that's Phase 2 WebSocket).

### 6.5 Chart Panel (Center, toggleable)
**Normal mode:** compact, ~220px tall SVG/Recharts candlestick chart.
**Fullscreen mode:** `position:fixed` overlay covering 100vw × 100vh. Triggered by ⛶ button; closed by ✕ button or Escape key. PA state syncs when entering fullscreen.

Toolbar (fullscreen only): timeframe selector (1m / 5m / 15m / 1h / 1D) · indicator toggles (EMA / VWAP / BB / Volume)

**Overlays always visible:** EMA 9 (green) · EMA 20 (blue) · EMA 50 (amber) · VWAP (purple dashed) · live price dashed line

**Price Action Analyser (toggle button):**
When ON:
- Rising support trendline (yellow dashed)
- Resistance trendline (red dashed)
- Candlestick pattern badge(s): Bullish Engulfing · Inside Bar · Doji · Hammer · Shooting Star · EMA Crossover
- Three horizontal level lines: **Entry** (green) · **SL** (red) · **Target** (blue)
- Left-side colored flag labels (SL / BUY / TGT)
- Right-side price labels
- **Setup Recommendation Panel** slides open below chart:
  - Bullish/Bearish badge + confidence %
  - Four cards: Entry (NIFTY price + option premium) · SL · Target · R:R ratio
  - "⚡ Use This Setup in Order Entry" button → auto-fills right dock
  - "Dismiss" button

When OFF: all overlays hidden, chart returns to clean EMA/VWAP view.

### 6.6 Options Chain Panel (Center, toggleable)
Toggled from same tab bar as chart.

Columns: `CE OI | CE Chng | CE Vol | CE IV | STRIKE | PE IV | PE Vol | PE Chng | PE OI`

- ATM row: highlighted background + left border accent
- Highest Call OI strike: red bold
- Highest Put OI strike: green bold
- Highest volume: amber bold
- Filters: ATM ±3 / Top OI / Top Volume
- Footer: Highest Call OI · Highest Put OI · Max Pain

### 6.7 Smart Option Selection (Center)
Auto-selects and ranks: ATM CE · ATM PE · ATM+1 CE · ATM+1 PE · OTM CE · OTM PE · ITM CE · ITM PE

Each card shows: strike + type · premium · OI · volume · IV · Δ · Γ · θ · ν

Recommendation badge: **★ Best Buy** (green border) · **◆ Moderate** (amber) · **✗ Avoid** (grey)

Ranking logic: volume rank + OI change rank + momentum (EMA alignment) + delta range (0.35–0.65 preferred)

Clicking a card auto-fills the Order Entry dock.

### 6.8 Open Positions (Center)
Table: Instrument · Qty · Entry Price · LTP · P&L (coloured) · Exit button

Footer: Day P&L · Total MTM · Total Exposure

Buttons: Exit (single) · Exit All · Trail SL · Move SL to Cost

### 6.9 Order Entry (Right Dock — always visible)
Fields:
- Instrument display (auto-filled from option selection click, or manually selectable)
- CE / PE toggle
- Quantity (lots, integer input with ± buttons)
- Order Type: Market / Limit (shows price input when Limit)
- Product Type: MIS / NRML
- Premium display (live LTP)

Buttons (stacked, full width):
1. **⚡ BUY** — market/limit order, no SL
2. **BUY + STOP LOSS** — opens SL input inline
3. **BUY + SL + TARGET** — opens both SL and Target inputs inline

Zerodha execution flow: `orderStore` → `zerodhaService.placeOrder()` → TanStack Query mutation → toast notification → positions refresh.

### 6.10 Risk Management (Right Dock)
User-configurable inputs (persisted to `settingsStore` → localStorage):
- Capital (₹)
- Risk Per Trade %
- Max Daily Loss %
- Max Trades Per Day
- Max Consecutive Losses

Auto-calculated and displayed:
- Risk Amount = Capital × Risk%
- Suggested Qty = Risk Amount / (Entry − SL) / lot size
- Potential Loss · Potential Profit · R:R ratio

---

## 7. Data Service Layer

### Interface (both mock and live implement this)
```typescript
interface TradingService {
  getNiftyQuote(): Promise<NiftyQuote>
  getOptionChain(expiry: string): Promise<OptionChain>
  getPositions(): Promise<Position[]>
  placeOrder(order: OrderRequest): Promise<OrderResponse>
  modifyOrder(orderId: string, changes: Partial<OrderRequest>): Promise<void>
  cancelOrder(orderId: string): Promise<void>
  exitPosition(positionId: string): Promise<void>
}
```

### Mock service
- Realistic NIFTY data (spot ~24,500–25,500 range)
- Option chain with 7 strikes ATM±3, realistic OI/IV values
- Polling interval: 3 seconds (simulates live feed)
- Configurable via `USE_MOCK=true` in `.env`

### Live Zerodha service
- Base URL: `https://api.kite.trade`
- Auth: API Key + Access Token stored in `settingsStore` (never in localStorage/env in production — Settings panel)
- Polling: TanStack Query with `refetchInterval: 3000` for quotes, `60000` for option chain

---

## 8. InfoTooltip Component

Every card and panel has an ⓘ icon. On hover: Shadcn `Tooltip` with a one-liner. On click: Shadcn `Dialog` with:
1. What this metric means
2. Why it matters for options buying
3. How traders use it
4. Bullish interpretation
5. Bearish interpretation

Tooltip content is co-located in each feature's folder (e.g., `features/trade-strength/tooltips.ts`).

---

## 9. Keyboard Shortcuts (Phase 1)
| Key | Action |
|---|---|
| `B` | Focus Buy button in Order Entry |
| `E` | Exit all positions (with confirm dialog) |
| `F` | Toggle chart fullscreen |
| `P` | Toggle Price Action Analyser |
| `1` | Switch center panel to Chart |
| `2` | Switch center panel to Options Chain |

---

## 10. Phase 1 vs Phase 2 Scope

### Phase 1 — Core trading panels (this build)
- Header
- Market Context
- Trade Strength Engine
- Trend Analysis
- Chart (with PA Analyser + fullscreen)
- Options Chain
- Smart Option Selection
- Order Entry
- Risk Management
- Open Positions
- Settings (Zerodha credentials + risk config)
- Keyboard shortcuts (B / E / F / P / 1 / 2)

### Phase 2 — Extras (separate build cycle)
- Trade Journal (IndexedDB, win rate, profit factor analytics)
- Alerts Engine (PCR change, VIX spike, OI surge, breakout)
- Toast notifications
- Smart Money Flow panel (top call/put writing)
- WebSocket real-time ticker (replace polling)
- Voice alerts
- Screenshot trade
- Export journal to CSV/JSON
- Watchlist
- Light theme toggle
- Multiple broker support

---

## 11. Mock Data Shape (key types)

```typescript
// NiftyQuote
{ spot: 24650.35, change: 145.20, changePct: 0.59, vix: 14.25,
  pcr: 1.32, breadth: 68, vwap: 24580, timestamp: Date }

// Strike
{ strike: 24650, ce: { oi: 1280000, oiChange: 24000, volume: 120000, iv: 12.4, ltp: 185.50,
    delta: 0.52, gamma: 0.04, theta: -12.4, vega: 8.2 },
  pe: { oi: 2240000, oiChange: 31000, volume: 98000, iv: 12.8, ltp: 142.30,
    delta: -0.48, gamma: 0.04, theta: -11.8, vega: 7.9 } }

// PriceActionSetup
{ pattern: 'BullishEngulfing', direction: 'bullish', confidence: 78,
  entry: 24650, sl: 24615, target: 24710, rr: 1.7,
  optionEntry: 185, optionSL: 155, optionTarget: 235 }
```

---

## 12. Deployment

- `npm run dev` — local dev with mock data
- `USE_MOCK=false npm run build` — production build (requires Zerodha credentials in Settings)
- Vite builds to `dist/` — deployable to any static host (Netlify, Vercel, GitHub Pages, Azure Static Web Apps)
- No backend required for Phase 1 (all Zerodha calls are client-side via Kite Connect JS SDK or REST)

---

## 13. .gitignore additions needed
```
.superpowers/
.env.local
dist/
```
