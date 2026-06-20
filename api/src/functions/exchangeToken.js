const { app } = require('@azure/functions')
const crypto = require('crypto')
const https = require('https')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function kitePost(body) {
  return new Promise((resolve, reject) => {
    const bodyStr = new URLSearchParams(body).toString()
    const reqOptions = {
      hostname: 'api.kite.trade',
      path: '/session/token',
      method: 'POST',
      headers: {
        'X-Kite-Version': '3',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    }
    const req = https.request(reqOptions, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', reject)
    req.write(bodyStr)
    req.end()
  })
}

app.http('exchange-token', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'exchange-token',
  handler: async (request, context) => {
    context.log('exchange-token function invoked, method:', request.method)

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return { status: 204, headers: CORS_HEADERS, body: '' }
    }

    let body
    try {
      body = await request.json()
    } catch (e) {
      context.log('Failed to parse request body:', e.message)
      return {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid JSON body' }),
      }
    }

    const { apiKey, apiSecret, requestToken } = body || {}

    if (!apiKey || !apiSecret || !requestToken) {
      context.log('Missing fields:', { apiKey: !!apiKey, apiSecret: !!apiSecret, requestToken: !!requestToken })
      return {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing apiKey, apiSecret, or requestToken' }),
      }
    }

    const checksum = crypto
      .createHash('sha256')
      .update(apiKey + requestToken + apiSecret)
      .digest('hex')

    try {
      const result = await kitePost({ api_key: apiKey, request_token: requestToken, checksum })
      context.log('Kite response status:', result.status)

      let parsed
      try {
        parsed = JSON.parse(result.body)
      } catch {
        parsed = { raw: result.body }
      }

      return {
        status: result.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      }
    } catch (err) {
      context.log.error('Token exchange error:', err.message)
      return {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to reach Zerodha API', detail: err.message }),
      }
    }
  },
})
