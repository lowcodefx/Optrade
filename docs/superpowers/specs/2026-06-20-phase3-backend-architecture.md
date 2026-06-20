# Phase 3 — Enterprise Backend Architecture (ASP.NET Core + Azure SQL + Zerodha)
**Saved: 2026-06-20 | Status: Pending (Build Phase 1 & 2 first)**

---

## Core Rule
**React MUST NEVER call Zerodha APIs directly.**
All order placement → ASP.NET Core API → Zerodha.

Reasons: API Secret Security · Access Token Management · Server-Side Validation · Audit Trail · Rule Enforcement

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React · TypeScript · Vite · Tailwind · Zustand · React Query |
| Backend | ASP.NET Core 9 Web API · EF Core · Repository Pattern · CQRS · MediatR · FluentValidation |
| Database | Azure SQL Database |
| Auth | JWT + Zerodha OAuth |
| Hosting | Azure App Service |
| Monitoring | Application Insights |
| Secrets | Azure Key Vault |
| Realtime | SignalR WebSocket Hub |

---

## Architecture Flow
```
React App
  ↓ HTTPS
ASP.NET Core API
  ↓
Trade Discipline Engine
  ↓
Trade Validation Engine
  ↓
Zerodha Service Layer
  ↓
Kite Connect APIs
  ↓
Azure SQL
```

---

## Order Execution Flow (9 Steps)
1. User clicks BUY ATM CE
2. Backend receives request
3. Discipline Engine validates
4. Risk Engine validates
5. Position Size Engine validates
6. Margin Check
7. Place Order via Zerodha
8. Save Execution Record
9. Return Response

---

## Zerodha Integration Module (ZerodhaService)
Responsibilities: Login URL · Access Token Management · Refresh Session · User Profile · Instruments Download · Live Quotes · Order Placement · Modification · Cancellation · Position Tracking · Margin Validation

### UserBrokerConnection Table
ConnectionId · UserId · BrokerName · ApiKey · EncryptedApiSecret · AccessToken · RefreshToken · TokenExpiry · IsActive · CreatedDate · UpdatedDate

---

## Trade Discipline Engine (Server-Side)
Validates: Daily Loss Limit · Max Trades · Consecutive Losses · Trade Timing · Min Confidence Score · Max Exposure · Max Quantity · Cooling Period

### Discipline Lock
TradingStatus = Locked · Reason · UnlockTime = Next Trading Session · All Buy Buttons Disabled

### Manual Override (Admin PIN required)
DisciplineOverrides table: OverrideId · UserId · Reason · OverrideType · ApprovedBy · Timestamp

---

## Market Data Service
NIFTY Spot · Option Chain · VWAP · RSI · ADX · PCR · VIX · OI Analysis · Market Breadth · Trade Score · Market Regime Detection

### Market Regime Engine
Regimes: Trending Bullish · Trending Bearish · Range Bound · Volatile · Expiry Mode · News Driven

### Trade Score Engine (0–100)
Inputs: VWAP · EMA Alignment · PCR · OI Change · Volume · VIX · Breadth · ADX · RSI
Outputs: Score · Confidence % · Bullish Probability · Bearish Probability · No Trade Probability

---

## Azure SQL Tables
Users · BrokerConnections · TradeExecution · TradeEntrySnapshot · TradeExitSnapshot · TradeDisciplineLog · DailySummary · StrategyPerformance · MarketSnapshot · Alerts · TradeNotes · AIInsights

### TradeEntrySnapshot (captured before execution)
SpotPrice · VWAP · RSI · ADX · PCR · VIX · MarketBreadth · TradeScore · MarketRegime · ATMStrike · ATMPremium · CEStrength · PEStrength · Timestamp

### TradeExitSnapshot
ExitPrice · ExitTime · PnL · Duration · ExitReason (Target Hit / SL Hit / Manual / Trailing SL)

---

## Analytics API Endpoints
```
GET /analytics/dashboard
GET /analytics/performance
GET /analytics/trades
GET /analytics/winrate
GET /analytics/discipline
GET /analytics/market-regime
GET /analytics/time-analysis
GET /analytics/strategy-analysis
GET /analytics/insights
```

---

## SignalR WebSocket Hub
Push events: Live Quotes · Open Position Updates · PnL Updates · Trade Alerts · Discipline Warnings · Market Regime Changes · Trade Score Changes

---

## Security Requirements
JWT Authentication · Role-Based Authorization · Encrypted Secrets · Azure Key Vault · Rate Limiting · Request Logging · Audit Logging · Exception Handling Middleware · Global Error Handler

---

## Clean Architecture Project Structure
```
src/
├── Domain/           # Entities, Value Objects, Domain Events
├── Application/      # CQRS Commands/Queries, MediatR Handlers, FluentValidation
├── Infrastructure/   # Zerodha Service, Market Data, External APIs
├── Persistence/      # EF Core, Repositories, Migrations, Azure SQL
├── API/              # Controllers, SignalR Hubs, Middleware, Swagger
└── Shared/           # Common types, Result pattern, Constants
```

---

## Deliverables
1. Complete Solution Structure
2. Clean Architecture Design
3. Entity Models
4. Database Schema
5. EF Core Configurations
6. Repository Layer
7. Zerodha Integration Layer
8. Discipline Engine
9. Analytics Engine
10. SignalR Implementation
11. Authentication Setup
12. Azure Deployment Guide
13. Swagger Documentation
14. Sample API Requests
15. Azure SQL Migration Scripts
