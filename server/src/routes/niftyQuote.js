const { Router } = require('express')
const https = require('https')
const router = Router()

router.get('/', async (req, res) => {
  const authHeader = req.headers['x-kite-auth'] || ''
  if (!authHeader) return res.status(401).json({ error: 'Missing X-Kite-Auth' })

  const reqObj = https.request({
    hostname: 'api.kite.trade',
    path: '/quote?i=NSE%3ANIFTY%2050&i=NSE%3AINDIA%20VIX',
    method: 'GET',
    headers: { Authorization: authHeader, 'X-Kite-Version': '3' },
  }, kiteRes => {
    const chunks = []
    kiteRes.on('data', c => chunks.push(c))
    kiteRes.on('end', () => {
      res.status(kiteRes.statusCode)
        .type(kiteRes.headers['content-type'] || 'application/json')
        .set('Cache-Control', 'no-store')
        .send(Buffer.concat(chunks))
    })
  })
  reqObj.on('error', err => {
    console.error('[niftyQuote] error:', err.message)
    res.status(502).json({ error: err.message })
  })
  reqObj.setTimeout(8000, () => { reqObj.destroy(); res.status(504).json({ error: 'timeout' }) })
  reqObj.end()
})

module.exports = router
