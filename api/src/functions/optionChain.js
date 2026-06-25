const { app } = require('@azure/functions')
const https = require('https')
const { getNiftyInstruments, getNearestExpiry } = require('../shared/instruments')

function kiteQuote(symbols, authToken) {
  return new Promise((resolve, reject) => {
    const qs = symbols.map(s => `i=${encodeURIComponent(s)}`).join('&')
    const req = https.request({
      hostname: 'api.kite.trade',
      path: `/quote?${qs}`,
      method: 'GET',
      headers: { 'X-Kite-Version': '3', 'Authorization': authToken },
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
  const RANGE = 5
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
      const instruments = await getNiftyInstruments(authToken)
      const expiry = getNearestExpiry(instruments)
      const atm = Math.round(spot / 50) * 50
      context.log(`optionChain: expiry=${expiry} atm=${atm} instruments=${instruments.length}`)

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
        try {
          const qr = await kiteQuote(symbols, authToken)
          if (qr.status === 200) {
            const j = JSON.parse(qr.body)
            quotes = j.data ?? {}
          } else {
            context.log(`optionChain: quote ${qr.status}: ${qr.body.slice(0, 150)}`)
          }
        } catch (qErr) {
          context.log(`optionChain: quote fetch failed: ${qErr.message}`)
        }
      }

      const chain = buildChain(instruments, expiry, atm, quotes)
      context.log(`optionChain: ${chain.strikes.length} rows, totalCEOI=${chain.totalCEOI}`)

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify(chain),
      }
    } catch (err) {
      console.error('[optionChain] error:', err.message)
      return { status: 502, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.message }) }
    }
  },
})
