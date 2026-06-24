const { app } = require('@azure/functions')
const https = require('https')

// ── Server-side caches ────────────────────────────────────────────────────────
let _instruments = null   // NFOInstrument[]
let _instrDay   = ''      // YYYY-MM-DD

// ── Kite fetch helper ─────────────────────────────────────────────────────────
function kiteRequest(path, authToken) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.kite.trade',
      path,
      method: 'GET',
      headers: { 'X-Kite-Version': '3', 'Authorization': authToken },
    }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }))
    })
    req.on('error', reject)
    req.setTimeout(25000, () => { req.destroy(); reject(new Error('kite timeout')) })
    req.end()
  })
}

// ── Instruments (cached per day) ──────────────────────────────────────────────
function parseNiftyOptions(csv) {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []
  const h = lines[0].split(',')
  const idx = n => h.indexOf(n)
  const tiI = idx('instrument_token'), siI = idx('tradingsymbol'), niI = idx('name')
  const eiI = idx('expiry'), kiI = idx('strike'), liI = idx('lot_size'), iiI = idx('instrument_type')
  const today = new Date().toISOString().slice(0, 10)
  return lines.slice(1).map(line => {
    const c = line.split(',')
    if (c[niI] !== 'NIFTY') return null
    const itype = c[iiI]
    if (itype !== 'CE' && itype !== 'PE') return null
    const expiry = c[eiI]
    if (expiry < today) return null
    return {
      instrument_token: parseInt(c[tiI]),
      tradingsymbol: c[siI],
      expiry,
      strike: parseFloat(c[kiI]),
      instrument_type: itype,
    }
  }).filter(Boolean)
}

async function getInstruments(authToken, context) {
  const today = new Date().toISOString().slice(0, 10)
  if (_instruments && _instrDay === today) return _instruments

  context.log('optionChain: fetching NFO instruments CSV')
  const r = await kiteRequest('/instruments/NFO', authToken)
  if (r.status !== 200) throw new Error(`Kite instruments ${r.status}`)
  _instruments = parseNiftyOptions(r.body)
  _instrDay = today
  context.log(`optionChain: cached ${_instruments.length} NIFTY options`)
  return _instruments
}

// ── Nearest expiry ────────────────────────────────────────────────────────────
function getNearestExpiry(instruments) {
  const today = new Date().toISOString().slice(0, 10)
  const expiries = [...new Set(instruments.map(i => i.expiry))].filter(e => e >= today).sort()
  return expiries[0] ?? today
}

// ── Option chain builder ──────────────────────────────────────────────────────
function buildChain(instruments, expiry, atm, quotes) {
  const RANGE = 5
  const strikes = Array.from({ length: RANGE * 2 + 1 }, (_, i) => atm + (i - RANGE) * 50)

  const rows = []
  for (const strike of strikes) {
    const ce = instruments.find(i => i.expiry === expiry && i.strike === strike && i.instrument_type === 'CE')
    const pe = instruments.find(i => i.expiry === expiry && i.strike === strike && i.instrument_type === 'PE')
    if (!ce || !pe) continue
    const ceQ = quotes[`NFO:${ce.tradingsymbol}`]
    const peQ = quotes[`NFO:${pe.tradingsymbol}`]
    if (!ceQ || !peQ) continue
    rows.push({
      strike,
      ce: { oi: ceQ.oi ?? 0, oiChange: ceQ.oi_day_change ?? 0, volume: ceQ.volume ?? 0, iv: 0, ltp: ceQ.last_price, delta: 0.5, gamma: 0.002, theta: -2.5, vega: 8 },
      pe: { oi: peQ.oi ?? 0, oiChange: peQ.oi_day_change ?? 0, volume: peQ.volume ?? 0, iv: 0, ltp: peQ.last_price, delta: -0.5, gamma: 0.002, theta: -2.5, vega: 8 },
    })
  }

  const totalCEOI = rows.reduce((s, r) => s + r.ce.oi, 0)
  const totalPEOI = rows.reduce((s, r) => s + r.pe.oi, 0)

  // Max pain: strike where total value of all options expiring worthless is minimised
  let maxPainStrike = atm
  let minPain = Infinity
  for (const row of rows) {
    const pain = rows.reduce((s, r) => {
      const ceVal = Math.max(0, r.strike - row.strike) * r.ce.oi
      const peVal = Math.max(0, row.strike - r.strike) * r.pe.oi
      return s + ceVal + peVal
    }, 0)
    if (pain < minPain) { minPain = pain; maxPainStrike = row.strike }
  }

  return { expiry, atmStrike: atm, strikes: rows, totalCEOI, totalPEOI, maxPainStrike }
}

// ── Handler ───────────────────────────────────────────────────────────────────
app.http('optionChain', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'option-chain',
  handler: async (request, context) => {
    const authToken = request.headers.get('x-kite-auth') || ''
    if (!authToken) {
      return { status: 401, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing X-Kite-Auth' }) }
    }

    const spot = parseFloat(request.query.get('spot') || '0')
    if (!spot || spot < 10000) {
      return { status: 400, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'spot param required (e.g. ?spot=24000)' }) }
    }

    try {
      const instruments = await getInstruments(authToken, context)
      const expiry = getNearestExpiry(instruments)
      const atm = Math.round(spot / 50) * 50

      // Collect symbols for ATM ±5 range
      const RANGE = 5
      const strikes = Array.from({ length: RANGE * 2 + 1 }, (_, i) => atm + (i - RANGE) * 50)
      const symbols = []
      for (const strike of strikes) {
        const ce = instruments.find(i => i.expiry === expiry && i.strike === strike && i.instrument_type === 'CE')
        const pe = instruments.find(i => i.expiry === expiry && i.strike === strike && i.instrument_type === 'PE')
        if (ce) symbols.push(`NFO:${ce.tradingsymbol}`)
        if (pe) symbols.push(`NFO:${pe.tradingsymbol}`)
      }

      if (symbols.length === 0) throw new Error('No matching instruments for calculated strikes')

      // Fetch quotes for all symbols in one Kite call
      const qs = symbols.map(s => `i=${encodeURIComponent(s)}`).join('&')
      const quoteRes = await kiteRequest(`/quote?${qs}`, authToken)
      if (quoteRes.status !== 200) throw new Error(`Kite quote ${quoteRes.status}: ${quoteRes.body.slice(0, 200)}`)

      const quoteJson = JSON.parse(quoteRes.body)
      const quotes = quoteJson.data ?? {}

      const chain = buildChain(instruments, expiry, atm, quotes)
      context.log(`optionChain: ${chain.strikes.length} strikes for expiry ${expiry}, ATM ${atm}`)

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify(chain),
      }
    } catch (err) {
      context.log.error('optionChain error:', err.message)
      return { status: 502, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.message }) }
    }
  },
})
