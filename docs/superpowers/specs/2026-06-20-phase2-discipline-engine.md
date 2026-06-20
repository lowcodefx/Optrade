# Phase 2 — Trading Discipline Engine, Quick Decision Popup, Azure SQL Analytics
**Saved: 2026-06-20 | Status: Pending (Build Phase 1 first)**

---

## Core Principle
The application behaves like a trading coach. Before every trade it verifies:
- Is this trade allowed?
- Does it match the strategy?
- Am I violating daily limits?
- Am I revenge trading / overtrading?

If any rule is violated → **block trade execution**.

---

## 1. Daily Rules Configuration (Configurable Settings)
- Capital
- Risk Per Trade %
- Maximum Daily Loss
- Maximum Daily Profit
- Maximum Trades Per Day
- Maximum Consecutive Losses
- Maximum Consecutive Wins
- Maximum Exposure
- Maximum Open Positions
- Cooling Period Between Trades

**Example:** Capital ₹1,00,000 · Risk 1% · Max Daily Loss ₹3,000 · Max Trades 5 · Max Consecutive Losses 2 · Cooling 15 min

---

## 2. Trade Validation Engine (7 Rules)

| Rule | Condition | Action |
|---|---|---|
| 1 | Daily loss limit reached | Block + "Daily loss limit reached. Trading disabled until next session." |
| 2 | Max trades reached | Block |
| 3 | Consecutive losses exceeded | Block + "Discipline lock activated. Review previous trades." |
| 4 | Trade risk exceeds configured risk % | Block |
| 5 | Position size exceeds allowed qty | Block |
| 6 | Trade confidence score below threshold (e.g. min 75, current 61) | Warning: "Low Conviction Setup" |
| 7 | Prev trade was loss AND new trade within 5 min | Warning: "Potential revenge trade detected." |

---

## 3. Discipline Dashboard
Displays: Trades Taken Today · Daily P&L · Remaining Risk · Remaining Trades · Consecutive Wins · Consecutive Losses · Current Discipline Score

---

## 4. Discipline Score
- 100 = Perfect Discipline
- Deductions for: Overtrade · Forced Entry · Manual Override · Revenge Trade Attempt
- Discipline Grade: A+ / A / B / C / D

---

## 5. Quick Decision Popup
- **Hotkey:** SPACEBAR or CTRL+Q
- **Purpose:** Decide within 10 seconds. No complex charts. Highest-value info only.

**Displays:**
- Market Direction (Bullish / Bearish / Neutral)
- Trade Strength (0–100)
- Bullish / Bearish / No Trade Probability
- ATM CE Strength · ATM PE Strength
- Current Market Regime (Trending Up / Down / Range Bound / Volatile / Expiry Mode)
- Support Level · Resistance Level
- Top Smart Money Activity (Put Writing / Call Writing / Unwinding)
- **Suggested Action:** BUY ATM CE / BUY ATM PE / WAIT / NO TRADE
- **Reasoning:** e.g. "Price above VWAP. Strong Put Writing. Positive Breadth. ADX > 25."
- **One-click actions:** BUY CE · BUY PE · CLOSE POPUP

---

## 6. Trade Execution Audit System
Capture data **before**, **during**, and **after** every trade.

---

## 7. Azure SQL Schema

### TradeExecution
TradeId · UserId · TradeDate · TradeTime · StrategyName · MarketRegime · Instrument · Strike · OptionType · EntryPrice · ExitPrice · Quantity · StopLoss · Target · RiskRewardRatio · TradeScore · ConfidenceScore · VWAPStatus · RSIValue · ADXValue · PCRValue · VIXValue · MarketBreadth · OIData · EntryReason · ExitReason · PnL · Result · TradeDuration · BrokerOrderId · CreatedDate

### DailySummary
Date · TotalTrades · Wins · Losses · WinRate · GrossProfit · GrossLoss · NetProfit · DisciplineScore · BestTrade · WorstTrade

### StrategyPerformance
StrategyName · Trades · Wins · Losses · WinRate · AverageProfit · AverageLoss · ProfitFactor · Expectancy

---

## 8. Analytics Screen (Dedicated Page)

### Tabs
- **Overview:** Total Trades · Win Rate · Profit Factor · Net Profit · Avg RR · Discipline Score
- **Performance:** Monthly/Weekly/Daily P&L charts
- **Setup Analysis:** Performance by Market Regime / Trade Score / Time of Day / Strike Selection / Day of Week
- **Insights:** AI-generated insights e.g. "Trades with score >80 have 68% win rate" / "Trades after 2 PM show lower profitability"
- **Discipline:** Revenge Trade Attempts · Blocked Trades · Rule Violations · Overtrading Incidents · Manual Overrides

---

## 9. AI Coach Module
Using historical trade data, generate:
- "You perform best in trending markets."
- "Avoid trading during lunch session (12–1 PM)."
- "ATM CE setups with score >85 show strongest performance."
- "Win rate drops after 3rd trade of the day."

---

## 10. Architecture Services
- `TradeDisciplineService`
- `TradeAuditService`
- `AnalyticsService`
- `TradeJournalRepository`
- `AzureSqlRepository`
- `InsightsEngine`

---

## Success Criteria
1. Trading Dashboard
2. Trading Journal
3. Trading Coach
4. Discipline Enforcer
5. Personal Performance Analytics Platform
