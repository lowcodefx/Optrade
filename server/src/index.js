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

app.listen(PORT, () => console.log(`optrade-api listening on ${PORT}`))

module.exports = app   // exported for supertest
