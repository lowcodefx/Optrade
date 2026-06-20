const { app } = require('@azure/functions')
const https = require('https')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Kite-Version',
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

// Route: /api/kite/{*kitePath}
// e.g.  /api/kite/quote?i=NSE:NIFTY+50
//        /api/kite/portfolio/positions
//        /api/kite/instruments/historical/256265/5minute?from=...
app.http('kite', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'kite/{*kitePath}',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return { status: 204, headers: CORS_HEADERS, body: '' }
    }

    // Debug: log everything we receive
    const debugInfo = {
      url: request.url,
      method: request.method,
      params: request.params,
      query: Object.fromEntries(request.query.entries()),
    }
    context.log('kite proxy hit:', JSON.stringify(debugInfo))

    const rawKitePath = request.params?.kitePath || ''
    if (!rawKitePath) {
      return {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing Kite path', debug: debugInfo }),
      }
    }

    const kitePath = '/' + rawKitePath

    // Forward all query params to Kite
    const kiteParams = new URLSearchParams()
    for (const [key, value] of request.query.entries()) {
      kiteParams.append(key, value)
    }
    const kiteQuery = kiteParams.toString()

    const authHeader = request.headers.get('authorization') || ''
    context.log(`Proxying ${request.method} ${kitePath} query=${kiteQuery}`)

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
