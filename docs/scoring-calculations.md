# Optrade — Scoring Calculations

Three independent scores are computed in the app. Each is documented below with exact formulas.

---

## 1. Market Score (CE / PE) — 0 to 1000

Source: `src/core/utils/scoreEngine.ts`

Both a CE score and a PE score are calculated simultaneously. The score measures how strongly market conditions favour buying a Call (CE) or Put (PE) right now. Maximum possible is 1000 per side.

### Factors and weights

| # | Factor | Max Pts | CE earns points when… | PE earns points when… |
|---|--------|---------|----------------------|----------------------|
| 1 | EMA Stack | 220 | EMA9 > EMA20 > EMA50 (full bull stack) | EMA9 < EMA20 < EMA50 (full bear stack) |
| 2 | VWAP Position | 180 | Spot is above VWAP | Spot is below VWAP |
| 3 | RSI Momentum | 150 | RSI is above 50 | RSI is below 50 |
| 4 | ADX Trend Strength | 100 | Strong trend confirmed in bull direction | Strong trend confirmed in bear direction |
| 5 | PCR (Put-Call Ratio) | 120 | PCR ≥ 1.0 (put OI dominates = bullish hedge) | PCR ≤ 1.0 (call OI dominates = bearish hedge) |
| 6 | VIX | 80 | VIX is low (< 15 = calm, CE-friendly) | VIX is high (> 20 = volatile, PE-friendly) |
| 7 | NIFTY 50 Breadth | 80 | More than 50% of NIFTY 50 stocks are up | More than 50% of NIFTY 50 stocks are down |
| 8 | Volume | 50 | Volume is above average | Volume is above average |
| 9 | Last Candle | 20 | Last 5-min candle closed green | Last 5-min candle closed red |
| | **Total** | **1000** | | |

### Exact formulas per factor

#### 1. EMA Stack — max 220 pts

```
emaBull = EMA9 > EMA20 > EMA50
emaBear = EMA9 < EMA20 < EMA50
partial = neither bull nor bear

CE = emaBull ? 220 : (EMA9 > EMA20 ? 0.4 × 220 = 88 : 0)
PE = emaBear ? 220 : (EMA9 < EMA20 ? 0.4 × 220 = 88 : 0)
```

Full 220 for a clean 3-EMA stack. 88 (40%) for a partial stack (EMA9/EMA20 aligned but EMA50 lagging).

#### 2. VWAP Position — max 180 pts

```
vwapDist = min( |spot − vwap| / vwap × 100 / 0.5 , 1 )

CE = spot > vwap ? 180 × (0.6 + 0.4 × vwapDist) : 0
PE = spot < vwap ? 180 × (0.6 + 0.4 × vwapDist) : 0
```

Minimum 60% of 180 = 108 pts just for being on the right side of VWAP.
Additional 40% = 72 pts scales with how far away spot is (caps at 0.5% distance).

#### 3. RSI Momentum — max 150 pts

```
CE = RSI ≥ 50 ? min((RSI − 50) / 20, 1) × 150 × (RSI < 75 ? 1 : 0.5) : 0
PE = RSI ≤ 50 ? min((50 − RSI) / 20, 1) × 150 × (RSI > 25 ? 1 : 0.5) : 0
```

RSI 50–70 earns full points on a linear scale. RSI > 75 (overbought) or < 25 (oversold) earns half points — extreme RSI is risky for momentum entries.

| RSI | CE pts |
|-----|--------|
| 50 | 0 |
| 60 | 75 |
| 70 | 150 |
| 80 | 75 (halved — overbought) |

#### 4. ADX Trend Strength — max 100 pts

```
adxStrength = min( max(ADX − 20, 0) / 30 , 1 )

CE = emaBull ? adxStrength × 100 : (emaBear ? 0 : adxStrength × 30)
PE = emaBear ? adxStrength × 100 : (emaBull ? 0 : adxStrength × 30)
```

ADX only starts scoring above 20 (below 20 = no trend). With a confirmed bull EMA stack, ADX amplifies CE score up to 100. Without a stack confirmation, maximum is 30 pts (flat/choppy market penalty).

| ADX | With EMA bull stack (CE) | Without stack (CE) |
|-----|--------------------------|-------------------|
| 20 | 0 | 0 |
| 35 | 50 | 15 |
| 50 | 100 | 30 |

#### 5. PCR — max 120 pts

```
CE = PCR ≥ 1.0 ? min((PCR − 1.0) / 0.5, 1) × 84 + 36 : 0
PE = PCR ≤ 1.0 ? min((1.0 − PCR) / 0.5, 1) × 120 : 0
```

CE gets a floor of 36 pts as soon as PCR crosses 1.0 (put writers are active = bullish signal). Scales to 120 at PCR = 1.5.
PE scores linearly from 0 at PCR 1.0 to 120 at PCR 0.5.

| PCR | CE pts | PE pts |
|-----|--------|--------|
| 0.5 | 0 | 120 |
| 0.8 | 0 | 48 |
| 1.0 | 36 | 0 |
| 1.25 | 78 | 0 |
| 1.5+ | 120 | 0 |

#### 6. VIX — max 80 pts

```
CE = VIX < 15 ? 80 : (VIX < 20 ? 80 × (20 − VIX) / 5 : 0)
PE = VIX > 20 ? min((VIX − 20) / 5, 1) × 80 : (VIX > 15 ? 80 × (VIX − 15) / 5 : 0)
```

Low VIX (calm market) benefits CE. High VIX (fear/panic) benefits PE. Between 15–20 both sides get partial points based on direction.

| VIX | CE pts | PE pts |
|-----|--------|--------|
| < 15 | 80 | 0 |
| 17.5 | 40 | 40 |
| > 20 | 0 | up to 80 |

#### 7. NIFTY 50 Market Breadth — max 80 pts

**With live per-stock data (preferred):**
```
total = bullishStocks + bearishStocks  (or 50 if unknown)
bullPct = bullishStocks / total × 100
bearPct = bearishStocks / total × 100

strongBullBonus = (strongBullCount / total) × 20
strongBearBonus = (strongBearCount / total) × 20

CE = bullPct > 50 ? min((bullPct − 50) / 20, 1) × 60 + strongBullBonus : 0
PE = bearPct > 50 ? min((bearPct − 50) / 20, 1) × 60 + strongBearBonus : 0
```

**Fallback (when per-stock data unavailable):**
```
CE = breadth > 50 ? min((breadth − 50) / 20, 1) × 80 : 0
PE = breadth < 50 ? min((50 − breadth) / 20, 1) × 80 : 0
```

Breadth only starts scoring when more than 50% of NIFTY 50 stocks are on one side. "Strong" stocks (green candle + price up, or red candle + price down) add a 20-pt bonus.

| Breadth | CE pts (no bonus) |
|---------|-------------------|
| 50% | 0 |
| 60% | 30 |
| 70%+ | 60 |

#### 8. Volume — max 50 pts

```
CE = volumeAboveAvg && emaBull ? 50 : (volumeAboveAvg ? 25 : 0)
PE = volumeAboveAvg && emaBear ? 50 : (volumeAboveAvg ? 25 : 0)
```

Volume alone scores 25. Volume + confirmed trend direction scores 50.

#### 9. Last Candle Direction — max 20 pts

```
CE = lastCandleGreen ? 20 : 0
PE = lastCandleGreen ? 0 : 20
```

Binary — smallest weight because a single candle is a weak signal.

---

### Prediction thresholds

After both scores are computed (capped at 1000):

| Condition | Prediction |
|-----------|------------|
| CE ≥ 700 AND CE > PE + 100 | BULLISH (strong — +100 to +200pt rise likely) |
| PE ≥ 700 AND PE > CE + 100 | BEARISH (strong — 100 to 200pt fall likely) |
| CE ≥ 600 AND CE > PE | BULLISH (mild — cautious CE entry) |
| PE ≥ 600 AND PE > CE | BEARISH (mild — cautious PE entry) |
| \|CE − PE\| < 80 | SIDEWAYS (range-bound ±50pt) |
| None of above | NEUTRAL (wait for confirmation) |

---

## 2. Discipline Score — 0 to 100

Source: `src/core/store/disciplineStore.ts`

Starts at 100 each day and deducts based on bad trading behaviour. Resets to 100 every new session date.

### Deductions

| Event | Deduction |
|-------|-----------|
| Second consecutive loss (and beyond) | −5 pts per loss |
| Daily P&L exceeds 70% of max daily loss limit | −8 pts |
| Daily loss limit breached (account locked) | −20 pts |
| Max trades per day reached (account locked) | −5 pts |
| Max consecutive losses reached (account locked) | −15 pts |
| Override lock manually | −20 pts |

Score is always clamped to `[0, 100]`.

### Grade thresholds

| Score | Grade |
|-------|-------|
| ≥ 95 | A+ |
| ≥ 85 | A |
| ≥ 70 | B |
| ≥ 55 | C |
| < 55 | D |

### Hard locks (trading disabled)

Trading is blocked (not just penalised) when any of the following are true:

- Daily P&L ≤ −maxDailyLoss
- Trades today ≥ maxTradesPerDay
- Consecutive losses ≥ maxConsecutiveLosses

### Soft warnings (trading allowed but flagged)

- Last trade was a loss AND next trade is placed within 5 minutes → "Potential revenge trade" warning
- Trade setup score below minTradeScore → "Low conviction setup" warning

---

## 3. Trade Strength Score — 0 to 100

Source: `src/core/utils/tradeStrength.ts`

A checklist-based score specifically for a CE entry. Each condition is binary (pass/fail) with a fixed weight.

| Condition | Weight | Passes when… |
|-----------|--------|--------------|
| Above VWAP | 15 | Spot > VWAP |
| EMA Aligned | 20 | EMA9 > EMA20 > EMA50 |
| RSI | 15 | RSI is between 50 and 75 |
| ADX | 10 | ADX > 25 |
| PCR | 15 | PCR > 1.0 |
| Put Writing | 10 | Put writing activity detected |
| Breadth | 10 | > 55% of NIFTY 50 stocks are up |
| Volume | 5 | Volume is above average |
| **Total** | **100** | |

```
score = sum of weights for passing conditions
label = score > 80 ? "high-conviction"
      : score > 60 ? "strong"
      : score > 30 ? "moderate"
      :              "weak"
```

Note: `confidence` adds a small random jitter (±5%) and is capped at 100. It is a display value only, not used in trading logic.

---

## Summary

| Score | Range | Resets | Used for |
|-------|-------|--------|---------|
| Market Score (CE) | 0–1000 | Every tick | Which direction to trade |
| Market Score (PE) | 0–1000 | Every tick | Which direction to trade |
| Discipline Score | 0–100 | Each new day | Whether you are allowed to trade |
| Trade Strength | 0–100 | Each calculation | How strong the current CE setup is |
