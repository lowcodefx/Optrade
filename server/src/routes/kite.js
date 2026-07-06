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
    if (body) req.write(body)
    req.end()
  })
}

// Kite API paths this app actually uses — rejects anything outside this set.
const KITE_PATH_PREFIXES = [
  'quote', 'ohlc', 'ltp',
  'user/profile', 'user/margins',
  'orders', 'trades', 'positions', 'holdings', 'portfolio',
  'margins', 'charges',
  'instruments',
  'mf/',
]

function isAllowedKitePath(suffix) {
  if (suffix.includes('..') || suffix.includes('#')) return false
  return KITE_PATH_PREFIXES.some(prefix => suffix === prefix || suffix.startsWith(prefix + '/') || suffix.startsWith(prefix + '?'))
}

router.all('/', async (req, res) => {
  const kitePathSuffix = req.query.kite_path
  if (!kitePathSuffix) return res.status(400).json({ error: 'Missing kite_path' })
  if (!isAllowedKitePath(String(kitePathSuffix))) {
    return res.status(400).json({ error: 'kite_path not allowed' })
  }

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
    res.status(result.status).set('Cache-Control', 'no-store').type(result.contentType).send(result.body)
  } catch (err) {
    console.error('[kite] proxy error:', err.message)
    res.status(502).json({ error: 'Proxy failed', detail: err.message })
  }
})

module.exports = router
