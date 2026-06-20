const crypto = require('crypto')
const https = require('https')

function kitePost(body) {
  return new Promise((resolve, reject) => {
    const bodyStr = new URLSearchParams(body).toString()
    const options = {
      hostname: 'api.kite.trade',
      path: '/session/token',
      method: 'POST',
      headers: {
        'X-Kite-Version': '3',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    }
    const req = https.request(options, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', reject)
    req.write(bodyStr)
    req.end()
  })
}

module.exports = async function (context, req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: corsHeaders(), body: '' }
    return
  }

  const { apiKey, apiSecret, requestToken } = req.body || {}

  if (!apiKey || !apiSecret || !requestToken) {
    context.res = {
      status: 400,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing apiKey, apiSecret, or requestToken' }),
    }
    return
  }

  const checksum = crypto
    .createHash('sha256')
    .update(apiKey + requestToken + apiSecret)
    .digest('hex')

  try {
    const result = await kitePost({ api_key: apiKey, request_token: requestToken, checksum })
    const parsed = JSON.parse(result.body)

    context.log(`Kite token exchange status: ${result.status}`)
    if (result.status !== 200) {
      context.log(`Kite error response: ${result.body}`)
    }

    context.res = {
      status: result.status,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    }
  } catch (err) {
    context.log.error('Token exchange error:', err.message)
    context.res = {
      status: 502,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to reach Zerodha API', detail: err.message }),
    }
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}
