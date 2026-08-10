const express = require('express')
const cors    = require('cors')

const ALLOWED_ORIGINS = [
  'https://black-pond-09bbb5b00.7.azurestaticapps.net',
  'http://localhost:5173',
]

const app  = express()
const PORT = process.env.PORT || 3000

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
  allowedHeaders: ['Content-Type', 'X-Kite-Auth', 'X-Kite-Version', 'X-Backend-Key', 'X-Requested-With'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}))

app.use(express.text({ type: 'application/x-www-form-urlencoded', limit: '2mb' }))
app.use(express.json({ limit: '2mb' }))

app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }))

const { authMiddleware } = require('./middleware/auth')
app.use('/api', authMiddleware)
app.use('/api/kite',               require('./routes/kite'))
app.use('/api/nifty-quote',        require('./routes/niftyQuote'))
app.use('/api/option-chain',       require('./routes/optionChain'))
app.use('/api/nifty-instruments',  require('./routes/niftyInstruments'))
app.use('/api/exchange-token',     require('./routes/exchangeToken'))
app.use('/api/set-token',          require('./routes/setToken'))
app.use('/api/market-summary',     require('./routes/marketSummary'))
app.use('/api/stock-analysis',     require('./routes/stockAnalysis'))
// Manual trigger for testing (protected by authMiddleware already applied to /api)
app.post('/api/holdings-alert/run', async (_req, res) => {
  try {
    const { runHoldingsAlert } = require('./jobs/holdingsAlertJob')
    runHoldingsAlert().catch(err => console.error('[manual trigger]', err.message))
    res.json({ triggered: true, note: 'Job started — check server logs for result' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
app.use('/api/stock-history',      require('./routes/stockHistory'))
app.use('/api/stock-news',         require('./routes/stockNews'))
app.use('/api/nifty-trend',        require('./routes/niftyTrend'))
app.use('/api/chat',               require('./routes/chat'))

if (require.main === module) {
  app.listen(PORT, () => console.log(`optrade-api listening on ${PORT}`))

  // Daily holdings R:R alert — 1 PM IST = 07:30 UTC, weekdays only
  try {
    const cron = require('node-cron')
    const { runHoldingsAlert } = require('./jobs/holdingsAlertJob')
    cron.schedule('30 7 * * 1-5', () => {
      console.log('[cron] Firing daily holdings alert…')
      runHoldingsAlert().catch(err => console.error('[cron] Error:', err.message))
    }, { timezone: 'UTC' })
    console.log('[cron] Holdings alert scheduled — 1 PM IST on weekdays')
  } catch (err) {
    console.warn('[cron] node-cron not available, skipping schedule:', err.message)
  }
}

module.exports = app   // exported for supertest
