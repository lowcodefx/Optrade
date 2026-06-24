const { app } = require('@azure/functions')
const https = require('https')

// ── Server-side caches ────────────────────────────────────────────────────────
let _instruments = null
let _instrDay    = ''
let _instrPromise = null   // de-dup concurrent downloads

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

// ── Instruments (cached per day, de-duped) ───────────────────────────────────
function parseNiftyOptions(csv) {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []
  const h = lines[0].split(',')
  const col = n => h.indexOf(n)
  const tiI = col('instrument_token'), siI = col('tradingsymbol'), niI = col('name')
  const eiI = col('expiry'), kiI = col('strike'), iiI = col('instrument_type')
  const today = new Date().toISOString().slice(0, 10)
  return lines.slice(1).map(line => {
    const c = line.split(',')
    const name = (c[niI] || '').trim()
    if (name !== 'NIFTY') return null
    const itype = (c[iiI] || '').trim()
    if (itype !== 'CE' && itype !== 'PE') return null
    const expiry = (c[eiI] || '').trim()
    if (!expiry || expiry < today) return null
    const strike = parseFloat(c[kiI])
    if (isNaN(strike)) return null
    return { tradingsymbol: (c[siI] || '').trim(), expiry, strike, instrument_type: itype }
  }).filter(Boolean)
}

async function getInstruments(authToken) {
  const today = new Date().toISOString().slice(0, 10)
  if (_instruments && _instrDay === today) return _instruments

  // De-dup: if a download is already in-flight, wait for it
  if (_instrPromise) return _instrPromise

  _instrPromise = (async () => {
    const r = await kiteRequest('/instruments/NFO', authToken)
    if (r.status !== 200) throw new Error(`Kite instruments returned ${r.status}: ${r.body.slice(0, 100)}`)
    const parsed = parseNiftyOptions(r.body)
    if (parsed.length === 0) throw new Error('Parsed 0 instruments — check token or CSV format')
    _instruments = parsed
    _instrDay = today
    return _instruments
  })()

  try {
    return await _instrPromise
  } finally {
    _instrPromise = null  // clear so next day triggers a fresh fetch
  }
}

// ── Nearest expiry ────────────────────────────────────────────────────────────
function getNearestExpiry(instruments) {
  const today = new Date().toISOString().slice(0, 10)
  const expiries = [...new Set(instruments.map(i => i.expiry))].filter(e => e >= today).sort()
  return expiries[0] ?? today
}

// ── Empty option data fallback ────────────────────────────────────────────────
function emptyOpt(delta) {
  return { oi: 0, oiChange: 0, volume: 0, iv: 0, ltp: 0, delta, gamma: 0.002, theta: -2.5, vega: 8 }
}

// ── Option chain builder ──────────────────────────────────────────────────────
function buildChain(instruments, expiry, atm, quotes) {
  const RANGE = 5
  const strikeValues = Array.from({ length: RANGE * 2 + 1 }, (_, i) => atm + (i - RANGE) * 50)

  const rows = []
  for (const strike of strikeValues) {
    const ceInst = instruments.find(i => i.expiry === expiry && i.strike === strike && i.instrument_type === 'CE')
    const peInst = instruments.find(i => i.expiry === expiry && i.strike === strike && i.instrument_type === 'PE')
    if (!ceInst && !peInst) continue   // no instruments at all for this strike

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

  let maxPainStrike = atm
  let minPain = Infinity
  for (const row of rows) {
    const pain = rows.reduce((s, r) => s + r.ce.oi * Math.max(0, r.strike - row.strike) + r.pe.oi * Math.max(0, row.strike - r.strike), 0)
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
      const instruments = await getInstruments(authToken)
      const expiry = getNearestExpiry(instruments)
      const atm = Math.round(spot / 50) * 50

      context.log(`optionChain: expiry=${expiry} atm=${atm} instruments=${instruments.length}`)

      // Build symbol list for ATM ±5 range
      const RANGE = 5
      const strikeValues = Array.from({ length: RANGE * 2 + 1 }, (_, i) => atm + (i - RANGE) * 50)
      const symbols = []
      for (const strike of strikeValues) {
        const ce = instruments.find(i => i.expiry === expiry && i.strike === strike && i.instrument_type === 'CE')
        const pe = instruments.find(i => i.expiry === expiry && i.strike === strike && i.instrument_type === 'PE')
        if (ce) symbols.push(`NFO:${ce.tradingsymbol}`)
        if (pe) symbols.push(`NFO:${pe.tradingsymbol}`)
      }

      context.log(`optionChain: querying ${symbols.length} symbols`)

      let quotes = {}
      if (symbols.length > 0) {
        const qs = symbols.map(s => `i=${encodeURIComponent(s)}`).join('&')
        const quoteRes = await kiteRequest(`/quote?${qs}`, authToken)
        if (quoteRes.status === 200) {
          try {
            const quoteJson = JSON.parse(quoteRes.body)
            quotes = quoteJson.data ?? {}
          } catch (_) {
            context.log(`optionChain: quote JSON parse failed, body: ${quoteRes.body.slice(0, 200)}`)
          }
        } else {
          context.log(`optionChain: quote returned ${quoteRes.status}: ${quoteRes.body.slice(0, 200)}`)
        }
      }

      const chain = buildChain(instruments, expiry, atm, quotes)
      context.log(`optionChain: built ${chain.strikes.length} strike rows`)

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify(chain),
      }
    } catch (err) {
      console.error('optionChain error:', err.message, err.stack)
      return { status: 502, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.message }) }
    }
  },
})
