# Fixed-IP Kite Proxy Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all Zerodha Kite API calls from rotating-IP Azure SWA managed functions to a single Azure B1s VM with a reserved static public IP so exactly one IP needs whitelisting in Zerodha.

**Architecture:** A new `server/` directory holds an Express.js app that replicates all Kite-facing SWA functions (kite proxy, niftyQuote, optionChain, niftyInstruments, exchangeToken, setToken). The frontend gains two env vars (`VITE_API_BASE`, `VITE_BACKEND_KEY`) and a shared `apiClient.ts` helper that stamps every VM-bound request with the backend key. nginx terminates TLS; PM2 manages the Node process.

**Tech Stack:** Node.js 20, Express 4, PM2, nginx, certbot/Let's Encrypt, DuckDNS, Azure B1s VM, @azure/storage-blob

## Global Constraints

- Node.js 20 LTS on the VM — match the version used in the SWA functions
- No Azure Functions SDK (`@azure/functions`) in the server — plain Express only
- All routes under `/api/*` require `X-Backend-Key` header — 401 otherwise
- CORS: allow `https://black-pond-09bbb5b00.7.azurestaticapps.net` and `http://localhost:5173` only
- Never log full tokens — truncate to first 4 chars + `****` in all log lines
- `BACKEND_KEY` env var on VM set via PM2 `ecosystem.config.js` — not in source code
- `VITE_BACKEND_KEY` and `VITE_API_BASE` set in Azure SWA Application Settings — not in `.env` files committed to git

---

## File Map

**New files:**
- `server/package.json` — dependencies: express, cors, @azure/storage-blob
- `server/src/index.js` — Express app, CORS, route registration, listen
- `server/src/middleware/auth.js` — X-Backend-Key validation
- `server/src/shared/instruments.js` — NIFTY instruments CSV cache (copy of api/src/shared/instruments.js, no Azure SDK imports)
- `server/src/routes/kite.js` — generic Kite proxy (mirrors kiteProxy.js)
- `server/src/routes/niftyQuote.js` — NIFTY 50 + VIX quote (mirrors niftyQuote.js)
- `server/src/routes/optionChain.js` — option chain builder (mirrors optionChain.js)
- `server/src/routes/niftyInstruments.js` — instruments list (mirrors niftyInstruments.js)
- `server/src/routes/exchangeToken.js` — Zerodha token exchange (mirrors exchangeToken.js)
- `server/src/routes/setToken.js` — write session to Azure Blob (mirrors setToken.js)
- `server/ecosystem.config.js` — PM2 config with env vars
- `server/nginx.conf` — nginx reverse proxy + TLS config template
- `server/tests/auth.test.js` — Jest + supertest auth middleware tests
- `server/tests/kite.test.js` — kite proxy tests with nock
- `src/core/services/apiClient.ts` — `API_BASE` constant + `vmHeaders()` + `kiteAuthHeaders()` helpers

**Modified files:**
- `src/core/services/zerodhaService.ts` — import from apiClient, replace `buildKiteUrl` base and header calls
- `src/core/services/zerodhaAuth.ts` — import from apiClient, update all fetch URLs and headers
- `src/core/hooks/useMarketData.ts` — add X-Backend-Key to nifty-quote, option-chain, nifty-instruments fetches

---

## Task 1: Bootstrap Express app

**Files:**
- Create: `server/package.json`
- Create: `server/src/index.js`
- Create: `server/.gitignore`

**Interfaces:**
- Produces: `GET /health` → `{ ok: true, ts: "<ISO timestamp>" }`

- [ ] **Step 1: Create server directory and package.json**

```json
// server/package.json
{
  "name": "optrade-api",
  "version": "1.0.0",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "test": "jest --runInBand"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "@azure/storage-blob": "^12.17.0"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^6.3.4",
    "nock": "^13.5.0"
  }
}
```

- [ ] **Step 2: Create .gitignore**

```
// server/.gitignore
node_modules/
ecosystem.config.js
```

> `ecosystem.config.js` is excluded from git because it contains the `BACKEND_KEY` env var value.

- [ ] **Step 3: Create src/index.js**

```js
// server/src/index.js
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
```

- [ ] **Step 4: Install dependencies**

```bash
cd server && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 5: Smoke test**

```bash
cd server && node src/index.js &
curl http://localhost:3000/health
# Expected: {"ok":true,"ts":"..."}
kill %1
```

- [ ] **Step 6: Commit**

```bash
git add server/
git commit -m "feat(server): bootstrap Express app with health check"
```

---

## Task 2: Auth middleware

**Files:**
- Create: `server/src/middleware/auth.js`
- Create: `server/tests/auth.test.js`

**Interfaces:**
- Consumes: `process.env.BACKEND_KEY`
- Produces: calls `next()` when key matches; responds `401 { error: 'Unauthorized' }` otherwise

- [ ] **Step 1: Write the failing test**

```js
// server/tests/auth.test.js
const request = require('supertest')
const express = require('express')

// Must set env BEFORE requiring the middleware
process.env.BACKEND_KEY = 'test-secret-key'
const { authMiddleware } = require('../src/middleware/auth')

function makeApp() {
  const app = express()
  app.use('/api', authMiddleware)
  app.get('/api/test', (_req, res) => res.json({ ok: true }))
  return app
}

test('rejects request with no X-Backend-Key', async () => {
  const res = await request(makeApp()).get('/api/test')
  expect(res.status).toBe(401)
  expect(res.body.error).toBe('Unauthorized')
})

test('rejects request with wrong X-Backend-Key', async () => {
  const res = await request(makeApp()).get('/api/test').set('X-Backend-Key', 'wrong')
  expect(res.status).toBe(401)
})

test('passes request with correct X-Backend-Key', async () => {
  const res = await request(makeApp()).get('/api/test').set('X-Backend-Key', 'test-secret-key')
  expect(res.status).toBe(200)
  expect(res.body.ok).toBe(true)
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd server && npx jest tests/auth.test.js --no-coverage
```

Expected: FAIL — `Cannot find module '../src/middleware/auth'`

- [ ] **Step 3: Implement auth middleware**

```js
// server/src/middleware/auth.js
function authMiddleware(req, res, next) {
  const key = req.headers['x-backend-key']
  if (!key || key !== process.env.BACKEND_KEY) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

module.exports = { authMiddleware }
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd server && npx jest tests/auth.test.js --no-coverage
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add server/src/middleware/ server/tests/auth.test.js
git commit -m "feat(server): auth middleware — X-Backend-Key validation"
```

---

## Task 3: Kite proxy route

**Files:**
- Create: `server/src/routes/kite.js`
- Create: `server/tests/kite.test.js`

**Interfaces:**
- Consumes: `GET|POST /api/kite?kite_path=<path>[&other=params]`, headers `X-Kite-Auth`, `X-Kite-Version`
- Produces: proxied response from `api.kite.trade` with same status + body

- [ ] **Step 1: Write the failing test**

```js
// server/tests/kite.test.js
const request = require('supertest')
const nock    = require('nock')

process.env.BACKEND_KEY = 'test-secret'
const app = require('../src/index')

afterEach(() => nock.cleanAll())

test('returns 400 when kite_path is missing', async () => {
  const res = await request(app)
    .get('/api/kite')
    .set('X-Backend-Key', 'test-secret')
  expect(res.status).toBe(400)
  expect(res.body.error).toBe('Missing kite_path')
})

test('proxies GET to Kite and returns response', async () => {
  nock('https://api.kite.trade')
    .get('/quote')
    .query({ i: 'NSE:NIFTY 50' })
    .reply(200, { status: 'success', data: {} }, { 'content-type': 'application/json' })

  const res = await request(app)
    .get('/api/kite?kite_path=quote&i=NSE%3ANIFTY%2050')
    .set('X-Backend-Key', 'test-secret')
    .set('X-Kite-Auth', 'token abc:xyz')

  expect(res.status).toBe(200)
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd server && npx jest tests/kite.test.js --no-coverage
```

Expected: FAIL — route not implemented yet.

- [ ] **Step 3: Implement kite proxy route**

```js
// server/src/routes/kite.js
const { Router } = require('express')
const https = require('https')
const router = Router()

function kiteRequest(method, kitePath, kiteQuery, authHeader, body, contentType) {
  return new Promise((resolve, reject) => {
    const pathWithQuery = kiteQuery ? `${kitePath}?${kiteQuery}` : kitePath
    const reqHeaders = { 'X-Kite-Version': '3' }
    if (authHeader) reqHeaders['Authorization'] = authHeader
    if (body) {
      reqHeaders['Content-Type'] = contentType || 'application/x-www-form-urlencoded'
      reqHeaders['Content-Length'] = Buffer.byteLength(body)
    }
    const req = https.request({
      hostname: 'api.kite.trade',
      path: pathWithQuery,
      method,
      headers: reqHeaders,
    }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({
        status: res.statusCode,
        body: Buffer.concat(chunks).toString(),
        contentType: res.headers['content-type'] || 'application/json',
      }))
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Kite request timed out')) })
    req.end()
  })
}

router.all('/', async (req, res) => {
  const kitePathSuffix = req.query.kite_path
  if (!kitePathSuffix) return res.status(400).json({ error: 'Missing kite_path' })

  const kitePath = '/' + kitePathSuffix
  const kiteParams = new URLSearchParams()
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'kite_path') continue
    if (key === 'instruments') {
      String(value).split(',').filter(Boolean).forEach(sym => kiteParams.append('i', sym))
    } else {
      kiteParams.append(key, String(value))
    }
  }
  const kiteQuery = kiteParams.toString().replace(/\+/g, '%20')
  const authHeader = req.headers['x-kite-auth'] || ''
  const body = req.method === 'POST' ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) : ''
  const contentType = req.headers['content-type'] || ''

  try {
    const result = await kiteRequest(req.method, kitePath, kiteQuery, authHeader, body, contentType)
    res.status(result.status).type(result.contentType).send(result.body)
  } catch (err) {
    console.error('[kite] proxy error:', err.message)
    res.status(502).json({ error: 'Proxy failed', detail: err.message })
  }
})

module.exports = router
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd server && npx jest tests/kite.test.js --no-coverage
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/kite.js server/tests/kite.test.js
git commit -m "feat(server): generic Kite proxy route /api/kite"
```

---

## Task 4: NIFTY quote + instruments routes

**Files:**
- Create: `server/src/shared/instruments.js`
- Create: `server/src/routes/niftyQuote.js`
- Create: `server/src/routes/niftyInstruments.js`

**Interfaces:**
- `GET /api/nifty-quote` header `X-Kite-Auth` → Kite `/quote` for `NSE:NIFTY 50` + `NSE:INDIA VIX`
- `GET /api/nifty-instruments` header `X-Kite-Auth` → array of `{ tradingsymbol, expiry, strike, instrument_type }`
- Produces: `getNiftyInstruments(authToken)`, `getNearestExpiry(instruments)` for use by optionChain route

- [ ] **Step 1: Copy instruments shared module**

```js
// server/src/shared/instruments.js
// Identical to api/src/shared/instruments.js — copy verbatim.
// No changes needed; it uses only Node built-ins (https, console).
```

Copy the file:

```bash
cp "api/src/shared/instruments.js" "server/src/shared/instruments.js"
```

- [ ] **Step 2: Create niftyQuote route**

```js
// server/src/routes/niftyQuote.js
const { Router } = require('express')
const https = require('https')
const router = Router()

router.get('/', async (req, res) => {
  const authHeader = req.headers['x-kite-auth'] || ''
  if (!authHeader) return res.status(401).json({ error: 'Missing X-Kite-Auth' })

  const reqObj = https.request({
    hostname: 'api.kite.trade',
    path: '/quote?i=NSE%3ANIFTY%2050&i=NSE%3AINDIA%20VIX',
    method: 'GET',
    headers: { Authorization: authHeader, 'X-Kite-Version': '3' },
  }, kiteRes => {
    const chunks = []
    kiteRes.on('data', c => chunks.push(c))
    kiteRes.on('end', () => {
      res.status(kiteRes.statusCode)
        .type(kiteRes.headers['content-type'] || 'application/json')
        .set('Cache-Control', 'no-store')
        .send(Buffer.concat(chunks))
    })
  })
  reqObj.on('error', err => {
    console.error('[niftyQuote] error:', err.message)
    res.status(502).json({ error: err.message })
  })
  reqObj.setTimeout(8000, () => { reqObj.destroy(); res.status(504).json({ error: 'timeout' }) })
  reqObj.end()
})

module.exports = router
```

- [ ] **Step 3: Create niftyInstruments route**

```js
// server/src/routes/niftyInstruments.js
const { Router } = require('express')
const { getNiftyInstruments } = require('../shared/instruments')
const router = Router()

router.get('/', async (req, res) => {
  const authToken = req.headers['x-kite-auth'] || ''
  if (!authToken) return res.status(401).json({ error: 'Missing X-Kite-Auth' })

  try {
    const instruments = await getNiftyInstruments(authToken)
    res.set('Cache-Control', 'public, max-age=3600').json(instruments)
  } catch (err) {
    console.error('[niftyInstruments] error:', err.message)
    res.status(502).json({ error: err.message })
  }
})

module.exports = router
```

- [ ] **Step 4: Manual smoke test**

```bash
cd server && BACKEND_KEY=test node src/index.js &
# In a second terminal — replace TOKEN with a real test token if available,
# or confirm 401 without auth:
curl -s http://localhost:3000/api/nifty-quote -H "X-Backend-Key: test" | head -c 200
# Expected: 401 {"error":"Missing X-Kite-Auth"} (correct — auth guard is working)
kill %1
```

- [ ] **Step 5: Commit**

```bash
git add server/src/shared/ server/src/routes/niftyQuote.js server/src/routes/niftyInstruments.js
git commit -m "feat(server): niftyQuote + niftyInstruments routes"
```

---

## Task 5: Option chain route

**Files:**
- Create: `server/src/routes/optionChain.js`

**Interfaces:**
- Consumes: `getNiftyInstruments(authToken)`, `getNearestExpiry(instruments)` from `../shared/instruments`
- Produces: `GET /api/option-chain?spot=<number>` header `X-Kite-Auth` → `{ expiry, atmStrike, strikes[], totalCEOI, totalPEOI, maxPainStrike }`

- [ ] **Step 1: Create optionChain route**

```js
// server/src/routes/optionChain.js
const { Router } = require('express')
const https = require('https')
const { getNiftyInstruments, getNearestExpiry } = require('../shared/instruments')
const router = Router()

function kiteQuote(symbols, authToken) {
  return new Promise((resolve, reject) => {
    const qs = symbols.map(s => `i=${encodeURIComponent(s)}`).join('&')
    const req = https.request({
      hostname: 'api.kite.trade',
      path: `/quote?${qs}`,
      method: 'GET',
      headers: { 'X-Kite-Version': '3', Authorization: authToken },
    }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }))
    })
    req.on('error', reject)
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('quote timeout')) })
    req.end()
  })
}

function emptyOpt(delta) {
  return { oi: 0, oiChange: 0, volume: 0, iv: 0, ltp: 0, delta, gamma: 0.002, theta: -2.5, vega: 8 }
}

function buildChain(instruments, expiry, atm, quotes) {
  const RANGE = 10
  const strikeValues = Array.from({ length: RANGE * 2 + 1 }, (_, i) => atm + (i - RANGE) * 50)
  const rows = []
  for (const strike of strikeValues) {
    const ceInst = instruments.find(i => i.expiry === expiry && i.strike === strike && i.instrument_type === 'CE')
    const peInst = instruments.find(i => i.expiry === expiry && i.strike === strike && i.instrument_type === 'PE')
    if (!ceInst && !peInst) continue
    const ceQ = ceInst ? quotes[`NFO:${ceInst.tradingsymbol}`] : null
    const peQ = peInst ? quotes[`NFO:${peInst.tradingsymbol}`] : null
    rows.push({
      strike,
      ce: ceQ ? { oi: ceQ.oi ?? 0, oiChange: ceQ.oi_day_change ?? 0, volume: ceQ.volume ?? 0, iv: 0, ltp: ceQ.last_price, delta: 0.5, gamma: 0.002, theta: -2.5, vega: 8 } : emptyOpt(0.5),
      pe: peQ ? { oi: peQ.oi ?? 0, oiChange: peQ.oi_day_change ?? 0, volume: peQ.volume ?? 0, iv: 0, ltp: peQ.last_price, delta: -0.5, gamma: 0.002, theta: -2.5, vega: 8 } : emptyOpt(-0.5),
    })
  }
  const totalCEOI = rows.reduce((s, r) => s + r.ce.oi, 0)
  const totalPEOI = rows.reduce((s, r) => s + r.pe.oi, 0)
  let maxPainStrike = atm, minPain = Infinity
  for (const row of rows) {
    const pain = rows.reduce((s, r) => s + r.ce.oi * Math.max(0, r.strike - row.strike) + r.pe.oi * Math.max(0, row.strike - r.strike), 0)
    if (pain < minPain) { minPain = pain; maxPainStrike = row.strike }
  }
  return { expiry, atmStrike: atm, strikes: rows, totalCEOI, totalPEOI, maxPainStrike }
}

router.get('/', async (req, res) => {
  const authToken = req.headers['x-kite-auth'] || ''
  if (!authToken) return res.status(401).json({ error: 'Missing X-Kite-Auth' })

  const spot = parseFloat(req.query.spot || '0')
  if (!spot || spot < 10000) return res.status(400).json({ error: 'spot param required (e.g. ?spot=24000)' })

  try {
    const instruments = await getNiftyInstruments(authToken)
    const expiry = getNearestExpiry(instruments)
    const atm = Math.round(spot / 50) * 50
    const RANGE = 10
    const strikeValues = Array.from({ length: RANGE * 2 + 1 }, (_, i) => atm + (i - RANGE) * 50)
    const symbols = []
    for (const strike of strikeValues) {
      const ce = instruments.find(i => i.expiry === expiry && i.strike === strike && i.instrument_type === 'CE')
      const pe = instruments.find(i => i.expiry === expiry && i.strike === strike && i.instrument_type === 'PE')
      if (ce) symbols.push(`NFO:${ce.tradingsymbol}`)
      if (pe) symbols.push(`NFO:${pe.tradingsymbol}`)
    }
    let quotes = {}
    if (symbols.length > 0) {
      try {
        const qr = await kiteQuote(symbols, authToken)
        if (qr.status === 200) quotes = (JSON.parse(qr.body).data) ?? {}
      } catch (qErr) {
        console.error('[optionChain] quote fetch failed:', qErr.message)
      }
    }
    const chain = buildChain(instruments, expiry, atm, quotes)
    res.set('Cache-Control', 'no-store').json(chain)
  } catch (err) {
    console.error('[optionChain] error:', err.message)
    res.status(502).json({ error: err.message })
  }
})

module.exports = router
```

- [ ] **Step 2: Commit**

```bash
git add server/src/routes/optionChain.js
git commit -m "feat(server): option chain route /api/option-chain"
```

---

## Task 6: Exchange token + set token routes

**Files:**
- Create: `server/src/routes/exchangeToken.js`
- Create: `server/src/routes/setToken.js`

**Interfaces:**
- `POST /api/exchange-token` body `{ apiKey, apiSecret, requestToken }` → `{ data: { access_token } }` (Kite response passthrough)
- `POST /api/set-token` body `{ apiKey, accessToken }` → writes `zerodha-session.json` to Azure Blob container `tokens`

- [ ] **Step 1: Create exchangeToken route**

```js
// server/src/routes/exchangeToken.js
const { Router } = require('express')
const https  = require('https')
const crypto = require('crypto')
const router = Router()

router.post('/', async (req, res) => {
  const { apiKey, apiSecret, requestToken } = req.body ?? {}
  if (!apiKey || !apiSecret || !requestToken) {
    return res.status(400).json({ error: 'Missing apiKey, apiSecret, or requestToken' })
  }

  const checksum = crypto.createHash('sha256')
    .update(apiKey + requestToken + apiSecret)
    .digest('hex')

  const bodyStr = new URLSearchParams({ api_key: apiKey, request_token: requestToken, checksum }).toString()

  const result = await new Promise((resolve, reject) => {
    const reqObj = https.request({
      hostname: 'api.kite.trade',
      path: '/session/token',
      method: 'POST',
      headers: {
        'X-Kite-Version': '3',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    }, kiteRes => {
      let data = ''
      kiteRes.on('data', c => { data += c })
      kiteRes.on('end', () => resolve({ status: kiteRes.statusCode, body: data }))
    })
    reqObj.on('error', reject)
    reqObj.write(bodyStr)
    reqObj.end()
  })

  try {
    res.status(result.status).json(JSON.parse(result.body))
  } catch {
    res.status(result.status).send(result.body)
  }
})

module.exports = router
```

- [ ] **Step 2: Create setToken route**

```js
// server/src/routes/setToken.js
const { Router } = require('express')
const { BlobServiceClient } = require('@azure/storage-blob')
const router = Router()

const STORAGE_CONN   = process.env.TOKEN_STORAGE_CONNECTION_STRING ?? ''
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'https://black-pond-09bbb5b00.7.azurestaticapps.net'

router.post('/', async (req, res) => {
  const origin = req.headers['origin'] ?? ''
  const xrw    = req.headers['x-requested-with'] ?? ''

  if (origin !== ALLOWED_ORIGIN || xrw !== 'Optrade') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (!STORAGE_CONN) {
    return res.json({ success: false, reason: 'not_configured' })
  }

  const { apiKey, accessToken } = req.body ?? {}
  if (!apiKey || !accessToken) {
    return res.status(400).json({ error: 'Missing apiKey or accessToken' })
  }

  try {
    const blobSvc   = BlobServiceClient.fromConnectionString(STORAGE_CONN)
    const container = blobSvc.getContainerClient('tokens')
    await container.createIfNotExists()
    const data = JSON.stringify({ apiKey, accessToken, setAt: new Date().toISOString() })
    const blob = container.getBlockBlobClient('zerodha-session.json')
    await blob.upload(data, Buffer.byteLength(data), {
      blobHTTPHeaders: { blobContentType: 'application/json' },
    })
    console.log(`[setToken] Session stored for apiKey: ${apiKey.slice(0, 4)}****`)
    res.json({ success: true })
  } catch (err) {
    console.error('[setToken] storage error:', err.message)
    res.status(502).json({ error: 'Failed to store session' })
  }
})

module.exports = router
```

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/exchangeToken.js server/src/routes/setToken.js
git commit -m "feat(server): exchange-token and set-token routes"
```

---

## Task 7: PM2 and nginx config

**Files:**
- Create: `server/ecosystem.config.js` (excluded from git — contains secrets)
- Create: `server/nginx.conf`

- [ ] **Step 1: Create ecosystem.config.js template (save locally, do not commit)**

Create this file on the VM only (it holds the real secret). Keep a local copy at `server/ecosystem.config.js` excluded by `.gitignore`:

```js
// server/ecosystem.config.js  — NOT committed to git
module.exports = {
  apps: [{
    name: 'optrade-api',
    script: 'src/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      BACKEND_KEY: 'REPLACE_WITH_GENERATED_SECRET',
      TOKEN_STORAGE_CONNECTION_STRING: 'REPLACE_WITH_AZURE_STORAGE_CONN_STRING',
      ALLOWED_ORIGIN: 'https://black-pond-09bbb5b00.7.azurestaticapps.net',
    },
  }],
}
```

Generate the secret:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
# Copy the output — this is your BACKEND_KEY
```

- [ ] **Step 2: Create nginx.conf**

```nginx
# server/nginx.conf
server {
    listen 80;
    server_name optrade.duckdns.org;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name optrade.duckdns.org;

    ssl_certificate     /etc/letsencrypt/live/optrade.duckdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/optrade.duckdns.org/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_read_timeout 30s;
    }
}
```

- [ ] **Step 3: Commit nginx config**

```bash
git add server/nginx.conf
git commit -m "feat(server): nginx reverse proxy config"
```

---

## Task 8: Provision Azure VM (manual steps)

No code — infrastructure setup. Follow these steps in order.

- [ ] **Step 1: Create VM in Azure Portal**

  1. New resource → Virtual Machine
  2. Resource group: `Optrade_Resource_Group`
  3. Name: `optrade-api-vm`
  4. Region: **East Asia** (same as SWA)
  5. Image: Ubuntu Server 22.04 LTS
  6. Size: **Standard B1s** (1 vCPU, 1 GB RAM)
  7. Authentication: SSH public key — paste your `~/.ssh/id_rsa.pub`
  8. Public inbound ports: None (configured via NSG below)
  9. Review + Create

- [ ] **Step 2: Create and attach reserved static public IP**

  1. In the VM → Networking → Network interface → IP configurations → ipconfig1
  2. Public IP address → Create new
  3. Name: `optrade-api-pip`, SKU: Standard, Assignment: **Static**
  4. Save — note the static IP address (you'll whitelist this in Zerodha)

- [ ] **Step 3: Configure NSG rules**

  In the VM → Networking → Add inbound port rule:
  - Rule 1: Source=Internet, Port=443, Protocol=TCP, Action=Allow, Priority=100, Name=`Allow-HTTPS`
  - Rule 2: Source=**your home/office IP**, Port=22, Protocol=TCP, Action=Allow, Priority=110, Name=`Allow-SSH-Dev`
  - Rule 3: Source=Any, Port=22, Protocol=TCP, Action=Deny, Priority=200, Name=`Deny-SSH-Public`

- [ ] **Step 4: SSH into VM and install dependencies**

```bash
ssh azureuser@<VM-STATIC-IP>

# Update and install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install nginx
sudo apt-get install -y nginx

# Install certbot
sudo apt-get install -y certbot python3-certbot-nginx
```

- [ ] **Step 5: Set up DuckDNS subdomain**

  1. Go to https://www.duckdns.org — log in with Google
  2. Create subdomain: `optrade`
  3. Set IP to the VM static IP
  4. Copy your DuckDNS token

Set up auto-refresh cron on the VM:

```bash
mkdir -p ~/duckdns
cat > ~/duckdns/duck.sh << 'EOF'
echo url="https://www.duckdns.org/update?domains=optrade&token=YOUR_DUCKDNS_TOKEN&ip=" | curl -k -o ~/duckdns/duck.log -K -
EOF
chmod 700 ~/duckdns/duck.sh
~/duckdns/duck.sh   # run once to set IP

# Add to crontab — refresh every 5 minutes
(crontab -l 2>/dev/null; echo "*/5 * * * * ~/duckdns/duck.sh >/dev/null 2>&1") | crontab -
```

Verify: `ping optrade.duckdns.org` from local machine → should resolve to VM IP.

- [ ] **Step 6: Obtain Let's Encrypt TLS certificate**

On the VM:

```bash
# Temporarily allow port 80 in NSG (certbot needs it for HTTP challenge)
# In Azure Portal: add NSG inbound rule Allow-HTTP port 80 temporarily

sudo certbot --nginx -d optrade.duckdns.org
# Follow prompts — enter email, agree to terms
# Expected: "Congratulations! Your certificate and chain have been saved"

# Remove the temporary HTTP NSG rule after cert is obtained
```

Verify certbot auto-renewal:

```bash
sudo systemctl status certbot.timer
# Expected: active (waiting)
```

---

## Task 9: Deploy server to VM

- [ ] **Step 1: Copy server code to VM**

From local machine:

```bash
# From repo root
rsync -avz --exclude node_modules --exclude ecosystem.config.js \
  server/ azureuser@<VM-STATIC-IP>:~/optrade-api/
```

- [ ] **Step 2: Install dependencies on VM**

```bash
ssh azureuser@<VM-STATIC-IP>
cd ~/optrade-api && npm install --omit=dev
```

- [ ] **Step 3: Create ecosystem.config.js on VM**

```bash
# On VM — paste the content from Task 7 Step 1, filling in real values
nano ~/optrade-api/ecosystem.config.js
# Fill in: BACKEND_KEY (generated secret), TOKEN_STORAGE_CONNECTION_STRING
```

- [ ] **Step 4: Start app with PM2**

```bash
cd ~/optrade-api
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # copy and run the printed systemd command
```

Expected output from `pm2 list`: `optrade-api` with status `online`.

- [ ] **Step 5: Install nginx config and reload**

```bash
sudo cp ~/optrade-api/nginx.conf /etc/nginx/sites-available/optrade-api
sudo ln -s /etc/nginx/sites-available/optrade-api /etc/nginx/sites-enabled/
sudo nginx -t   # Expected: "syntax is ok" and "test is successful"
sudo systemctl reload nginx
```

- [ ] **Step 6: End-to-end smoke test**

From local machine:

```bash
curl https://optrade.duckdns.org/health
# Expected: {"ok":true,"ts":"..."}

curl -s https://optrade.duckdns.org/api/kite -H "X-Backend-Key: wrong"
# Expected: {"error":"Unauthorized"}
```

- [ ] **Step 7: Commit**

```bash
# No new files — VM setup is manual. Just note the VM IP in a comment.
git commit --allow-empty -m "ops: VM optrade-api deployed at optrade.duckdns.org"
```

---

## Task 10: Frontend — API base URL and backend key header

**Files:**
- Create: `src/core/services/apiClient.ts`
- Modify: `src/core/services/zerodhaService.ts`
- Modify: `src/core/services/zerodhaAuth.ts`
- Modify: `src/core/hooks/useMarketData.ts` (only the nifty-quote / option-chain / nifty-instruments fetch calls)

**Interfaces:**
- Produces: `API_BASE: string`, `vmHeaders(extra?): Record<string,string>`, `kiteAuthHeaders(): Record<string,string>`

- [ ] **Step 1: Create apiClient.ts**

```typescript
// src/core/services/apiClient.ts
import { useSettingsStore } from '@/core/store'

// Empty string = same origin (SWA) — set VITE_API_BASE to VM URL in production
export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''

function backendKey(): string {
  return (import.meta.env.VITE_BACKEND_KEY as string | undefined) ?? ''
}

// Adds X-Backend-Key to any headers object — no-op when key is not configured
export function vmHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra }
  const key = backendKey()
  if (key) headers['X-Backend-Key'] = key
  return headers
}

// Returns all headers needed for a Kite API call through the VM proxy
export function kiteAuthHeaders(): Record<string, string> {
  const { apiKey, accessToken } = useSettingsStore.getState()
  return vmHeaders({
    'X-Kite-Auth': `token ${apiKey}:${accessToken}`,
    'X-Kite-Version': '3',
  })
}
```

- [ ] **Step 2: Update zerodhaService.ts**

Replace the `buildKiteUrl` function and add `kiteAuthHeaders` import. Find these lines (around line 17–34):

```typescript
// All Kite API calls go through /api/kite Azure Function proxy to avoid CORS.
// kite_path is built manually (not via URLSearchParams) so slashes in paths
// like /instruments/historical/256265/5minute stay unencoded.
function buildKiteUrl(path: string, params?: Record<string, string | string[]>): string {
  // path = '/quote' → kite_path=quote (no leading slash, no %2F encoding)
  let qs = `kite_path=${path.replace(/^\//, '')}`
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (Array.isArray(v)) v.forEach(val => { qs += `&${encodeURIComponent(k)}=${encodeURIComponent(val)}` })
      else qs += `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`
    })
  }
  return `/api/kite?${qs}`
}

async function kiteGet<T>(path: string, params?: Record<string, string | string[]>): Promise<T> {
  const res = await fetch(buildKiteUrl(path, params), {
    headers: { 'X-Kite-Auth': authHeader(), 'X-Kite-Version': '3' },
  })
```

Replace with:

```typescript
import { API_BASE, kiteAuthHeaders } from './apiClient'

// All Kite API calls go through the VM proxy at API_BASE/api/kite.
function buildKiteUrl(path: string, params?: Record<string, string | string[]>): string {
  let qs = `kite_path=${path.replace(/^\//, '')}`
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (Array.isArray(v)) v.forEach(val => { qs += `&${encodeURIComponent(k)}=${encodeURIComponent(val)}` })
      else qs += `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`
    })
  }
  return `${API_BASE}/api/kite?${qs}`
}

async function kiteGet<T>(path: string, params?: Record<string, string | string[]>): Promise<T> {
  const res = await fetch(buildKiteUrl(path, params), {
    headers: kiteAuthHeaders(),
  })
```

Also find and update the `/api/nifty-quote` fetch (around line 118):

```typescript
    const res = await fetch('/api/nifty-quote', {
```

Replace with:

```typescript
    const res = await fetch(`${API_BASE}/api/nifty-quote`, {
```

And update the headers on that fetch to use `kiteAuthHeaders()` instead of `{ 'X-Kite-Auth': ... }`.

- [ ] **Step 3: Update zerodhaAuth.ts**

Add import at top:

```typescript
import { API_BASE, vmHeaders, kiteAuthHeaders } from './apiClient'
```

Replace the three fetch calls:

```typescript
// exchangeRequestToken — line 14
  const res = await fetch(`${API_BASE}/api/exchange-token`, {
    method: 'POST',
    headers: vmHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ apiKey, apiSecret, requestToken }),
  })

// fetchUserMargins — line 38
    const res = await fetch(`${API_BASE}/api/kite?kite_path=user/margins`, {
      headers: kiteAuthHeaders(),
    })

// fetchUserProfile — line 58
    const res = await fetch(`${API_BASE}/api/kite?kite_path=user/profile`, {
      headers: kiteAuthHeaders(),
    })
```

Also update `set-token` call in `App.tsx` (around line 187):

```typescript
          fetch(`${API_BASE}/api/set-token`, {
            method: 'POST',
            headers: vmHeaders({ 'Content-Type': 'application/json', 'X-Requested-With': 'Optrade' }),
            body: JSON.stringify({ apiKey, accessToken }),
          })
```

Add the import to App.tsx:

```typescript
import { API_BASE, vmHeaders } from '@/core/services/apiClient'
```

- [ ] **Step 4: Update useMarketData.ts option-chain and nifty-instruments fetches**

Find all fetch calls to `/api/option-chain` and `/api/nifty-instruments` in `src/core/hooks/useMarketData.ts`. Add `API_BASE` prefix and `vmHeaders` / `kiteAuthHeaders` where needed.

```bash
grep -n "fetch('/api/" src/core/hooks/useMarketData.ts
```

For each result, apply the same pattern:
- `/api/option-chain` → `` `${API_BASE}/api/option-chain` ``
- `/api/nifty-instruments` → `` `${API_BASE}/api/nifty-instruments` ``
- Add `kiteAuthHeaders()` import from `./apiClient` (relative path may need adjustment)

- [ ] **Step 5: Type-check**

```bash
cd c:\Users\Prajakta\Desktop\Optrade && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/services/apiClient.ts src/core/services/zerodhaService.ts \
        src/core/services/zerodhaAuth.ts src/core/hooks/useMarketData.ts src/App.tsx
git commit -m "feat(frontend): route all Kite calls through VM via API_BASE + X-Backend-Key"
```

---

## Task 11: Configure SWA env vars and redeploy

- [ ] **Step 1: Add env vars in Azure Portal**

  1. Azure Portal → Static Web Apps → `optrade-dashboard` → Configuration → Application settings
  2. Add two settings:
     - Name: `VITE_API_BASE` → Value: `https://optrade.duckdns.org`
     - Name: `VITE_BACKEND_KEY` → Value: `<the BACKEND_KEY you generated in Task 7>`
  3. Save

- [ ] **Step 2: Trigger redeploy**

```bash
git commit --allow-empty -m "ops: trigger SWA redeploy for VM env vars"
git push origin main
```

Wait for SWA build to complete (~2 min). Check Azure Portal → Static Web Apps → `optrade-dashboard` → Deployments.

- [ ] **Step 3: Verify deployment**

Open the SWA URL in browser dev tools → Network tab. Confirm that:
- Kite API calls now go to `https://optrade.duckdns.org/api/kite` (not `/api/kite`)
- Responses are `200` (once Zerodha whitelist is updated in next task)

---

## Task 12: Whitelist VM IP and final validation

- [ ] **Step 1: Whitelist static IP in Zerodha**

  1. Log in to https://developers.kite.trade
  2. Your Apps → select your app
  3. IP Whitelist → clear existing entries → add **VM static IP only**
  4. Save

- [ ] **Step 2: End-to-end live test**

Log in to the Optrade dashboard. Verify:

```
✓ NIFTY quote loads (top of page shows spot price)
✓ Option chain loads
✓ Score engine computes (CE/PE scores appear)
✓ Candles load on chart
✓ Guided Trade Entry wizard opens — checklist shows live data
✓ No 401/403 errors in browser console
```

- [ ] **Step 3: Confirm outbound IP**

On the VM, make a test call and capture the IP Kite sees:

```bash
curl -s https://api.ipify.org
# Should print the VM static IP — this is the only IP hitting Zerodha
```

- [ ] **Step 4: Push final state**

```bash
git push origin main
```

Done. All Zerodha API traffic now flows exclusively through `optrade.duckdns.org` (VM static IP).
