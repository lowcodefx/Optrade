const { app } = require('@azure/functions')
const https = require('https')

// Dedicated NIFTY 50 + INDIA VIX quote endpoint.
// Bypasses the generic kiteProxy so we can hardcode the exact path with
// correctly percent-encoded spaces (%20, not +) that Zerodha requires.
function kiteRequest(authHeader) {
  return new Promise((resolve, reject) => {
    // Spaces MUST be %20 here — Zerodha does not decode + as space.
    const path = '/quote?i=NSE%3ANIFTY%2050&i=NSE%3AINDIA%20VIX'
    const req = https.request(
      {
        hostname: 'api.kite.trade',
        path,
        method: 'GET',
        headers: { Authorization: authHeader, 'X-Kite-Version': '3' },
      },
      res => {
        const chunks = []
        res.on('data', c => chunks.push(c))
        res.on('end', () =>
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') })
        )
      }
    )
    req.on('error', reject)
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')) })
    req.end()
  })
}

app.http('niftyQuote', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'nifty-quote',
  handler: async (request, context) => {
    const authHeader = request.headers.get('x-kite-auth') || ''
    if (!authHeader) {
      return { status: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing X-Kite-Auth' }) }
    }

    try {
      const result = await kiteRequest(authHeader)
      context.log(`niftyQuote: status=${result.status} body=${result.body.slice(0, 200)}`)
      return {
        status: result.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
        },
        body: result.body,
      }
    } catch (err) {
      context.log.error('niftyQuote error:', err.message)
      return {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.message }),
      }
    }
  },
})
