const { Router } = require('express')
const https = require('https')
const router = Router()

const cache = new Map()
const CACHE_TTL = 20 * 60 * 1000

function kiteGet(path, apiKey, accessToken) {
  return new Promise((resolve, reject) => {
    const req = https.get(`https://api.kite.trade${path}`, {
      headers: { 'X-Kite-Version': '3', Authorization: `token ${apiKey}:${accessToken}` },
    }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())) }
        catch { reject(new Error('parse error')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

router.get('/', async (req, res) => {
  const { tokens } = req.query
  if (!tokens) return res.status(400).json({ error: 'tokens required' })

  const auth = req.headers['x-kite-auth'] || ''
  let apiKey = '', accessToken = ''
  if (auth.startsWith('token ')) {
    const parts = auth.replace('token ', '').split(':')
    apiKey = parts[0]; accessToken = parts[1] || ''
  }
  if (!apiKey || !accessToken) return res.status(401).json({ error: 'Kite auth required' })

  const tokenList = tokens.split(',').map(t => t.trim()).filter(Boolean).slice(0, 25)

  const to   = new Date().toISOString().split('T')[0]
  const from = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const results = {}
  await Promise.allSettled(tokenList.map(async token => {
    const key = `${token}-${to}`
    const hit = cache.get(key)
    if (hit && Date.now() - hit.t < CACHE_TTL) { results[token] = hit.d; return }

    try {
      const data = await kiteGet(
        `/instruments/historical/${token}/day?from=${from}&to=${to}`,
        apiKey, accessToken,
      )
      // candle format: [timestamp, open, high, low, close, volume, oi?]
      const candles = (data.data?.candles ?? []).slice(-12)
      const d = {
        prices:  candles.map(c => c[4]),
        volumes: candles.map(c => c[5]),
        candles: candles.map(c => ({ t: c[0], o: c[1], h: c[2], l: c[3], c: c[4], v: c[5] })),
      }
      cache.set(key, { d, t: Date.now() })
      results[token] = d
    } catch { results[token] = { prices: [], volumes: [] } }
  }))

  res.set('Cache-Control', 'no-store').json(results)
})

module.exports = router
