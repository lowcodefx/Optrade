const { Router } = require('express')
const https  = require('https')
const crypto = require('crypto')
const router = Router()

router.post('/', async (req, res) => {
  const { apiKey, apiSecret, requestToken } = req.body ?? {}
  if (!apiKey || !apiSecret || !requestToken) {
    return res.status(400).json({ error: 'Missing apiKey, apiSecret, or requestToken' })
  }

  const checksum = crypto.createHash('sha256')
    .update(apiKey + requestToken + apiSecret)
    .digest('hex')

  const bodyStr = new URLSearchParams({ api_key: apiKey, request_token: requestToken, checksum }).toString()

  const result = await new Promise((resolve, reject) => {
    const reqObj = https.request({
      hostname: 'api.kite.trade',
      path: '/session/token',
      method: 'POST',
      headers: {
        'X-Kite-Version': '3',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    }, kiteRes => {
      let data = ''
      kiteRes.on('data', c => { data += c })
      kiteRes.on('end', () => resolve({ status: kiteRes.statusCode, body: data }))
    })
    reqObj.on('error', reject)
    reqObj.write(bodyStr)
    reqObj.end()
  })

  try {
    res.status(result.status).json(JSON.parse(result.body))
  } catch {
    res.status(result.status).send(result.body)
  }
})

module.exports = router
