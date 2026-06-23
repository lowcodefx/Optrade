const { app } = require('@azure/functions')
const https = require('https')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Kite-Auth, X-Kite-Version',
}

function kiteRequest(method, kitePath, kiteQuery, authHeader, body, contentType) {
  return new Promise((resolve, reject) => {
    const pathWithQuery = kiteQuery ? `${kitePath}?${kiteQuery}` : kitePath
    const reqHeaders = { 'X-Kite-Version': '3' }
    if (authHeader) reqHeaders['Authorization'] = authHeader
    if (body) {
      reqHeaders['Content-Type'] = contentType || 'application/x-www-form-urlencoded'
      reqHeaders['Content-Length'] = Buffer.byteLength(body)
    }

    const options = {
      hostname: 'api.kite.trade',
      path: pathWithQuery,
      method,
      headers: reqHeaders,
    }

    const req = https.request(options, res => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve({
        status: res.statusCode,
        body: Buffer.concat(chunks).toString(),
        contentType: res.headers['content-type'] || 'application/json',
      }))
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

// Route: /api/kite?kite_path=quote&i=NSE:NIFTY+50
// kite_path is the Kite API path WITHOUT leading slash (slashes are preserved unencoded)
app.http('kite', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'kite',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return { status: 204, headers: CORS_HEADERS, body: '' }
    }

    const kitePathSuffix = request.query.get('kite_path')
    context.log('kite_path param:', kitePathSuffix, '| url:', request.url)

    if (!kitePathSuffix) {
      return {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Missing kite_path',
          url: request.url,
          allParams: Object.fromEntries(request.query.entries()),
        }),
      }
    }

    const kitePath = '/' + kitePathSuffix

    // Forward all query params except kite_path to Kite.
    // URLSearchParams.toString() encodes spaces as '+' (x-www-form-urlencoded).
    // Zerodha uses strict URI decoding so '+' is treated as a literal '+', not a space.
    // Replace '+' with '%20' so 'NSE:NIFTY 50' round-trips correctly.
    const kiteParams = new URLSearchParams()
    for (const [key, value] of request.query.entries()) {
      if (key !== 'kite_path') kiteParams.append(key, value)
    }
    const kiteQuery = kiteParams.toString().replace(/\+/g, '%20')

    // SWA strips the Authorization header before reaching functions.
    // We use X-Kite-Auth as a passthrough, then re-map it here.
    const authHeader = request.headers.get('x-kite-auth') || ''
    context.log(`Proxying ${request.method} ${kitePath} query=${kiteQuery} auth=${authHeader ? 'present' : 'MISSING'}`)

    try {
      let body = ''
      let contentType = ''
      if (request.method === 'POST') {
        body = await request.text()
        contentType = request.headers.get('content-type') || 'application/x-www-form-urlencoded'
      }

      const result = await kiteRequest(request.method, kitePath, kiteQuery, authHeader, body, contentType)
      context.log(`Kite responded ${result.status} for ${kitePath}`)

      return {
        status: result.status,
        headers: { ...CORS_HEADERS, 'Content-Type': result.contentType },
        body: result.body,
      }
    } catch (err) {
      context.log.error('Kite proxy error:', err.message)
      return {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Proxy failed', detail: err.message }),
      }
    }
  },
})
