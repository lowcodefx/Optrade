const { app } = require('@azure/functions')
const https = require('https')

// Module-level cache: warm Azure Function instances serve this without re-downloading.
// Invalidated daily (instruments change on expiry days).
let _cachedInstruments = null
let _cacheDay = ''

function getTodayUtcDate() {
  return new Date().toISOString().slice(0, 10)
}

function fetchKite(authToken) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.kite.trade',
      path: '/instruments/NFO',
      method: 'GET',
      headers: { 'X-Kite-Version': '3', 'Authorization': authToken },
    }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }))
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')) })
    req.end()
  })
}

function parseNiftyOptions(csv) {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []

  const h = lines[0].split(',')
  const col = n => h.indexOf(n)
  const tiI = col('instrument_token'), siI = col('tradingsymbol'), niI = col('name')
  const eiI = col('expiry'), kiI = col('strike'), liI = col('lot_size'), iiI = col('instrument_type')

  const today = new Date().toISOString().slice(0, 10)

  return lines.slice(1)
    .map(line => {
      const c = line.split(',')
      if (c[niI] !== 'NIFTY') return null
      const itype = c[iiI]
      if (itype !== 'CE' && itype !== 'PE') return null
      const expiry = c[eiI]
      if (expiry < today) return null
      return {
        instrument_token: parseInt(c[tiI]),
        tradingsymbol: c[siI],
        name: 'NIFTY',
        expiry,
        strike: parseFloat(c[kiI]),
        lot_size: parseInt(c[liI]),
        instrument_type: itype,
      }
    })
    .filter(Boolean)
}

app.http('niftyInstruments', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'nifty-instruments',
  handler: async (request, context) => {
    const authToken = request.headers.get('x-kite-auth') || ''
    if (!authToken) {
      return { status: 401, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing X-Kite-Auth header' }) }
    }

    try {
      const today = getTodayUtcDate()

      // Serve from module-level cache if same day (avoids re-downloading 5MB CSV)
      if (_cachedInstruments && _cacheDay === today) {
        context.log(`niftyInstruments: served ${_cachedInstruments.length} items from memory cache`)
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600', 'X-Cache': 'HIT' },
          body: JSON.stringify({ instruments: _cachedInstruments }),
        }
      }

      const result = await fetchKite(authToken)
      if (result.status !== 200) {
        context.log.warn('niftyInstruments: Kite returned', result.status)
        return { status: result.status, headers: { 'Content-Type': 'application/json' }, body: result.body }
      }

      const instruments = parseNiftyOptions(result.body)
      context.log(`niftyInstruments: ${instruments.length} NIFTY options fetched from Kite, caching in memory`)

      _cachedInstruments = instruments
      _cacheDay = today

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600', 'X-Cache': 'MISS' },
        body: JSON.stringify({ instruments }),
      }
    } catch (err) {
      context.log.error('niftyInstruments error:', err.message)
      return { status: 502, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.message }) }
    }
  },
})
