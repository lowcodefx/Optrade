const { Router } = require('express')
const { getNiftyInstruments } = require('../shared/instruments')
const router = Router()

router.get('/', async (req, res) => {
  const authToken = req.headers['x-kite-auth'] || ''
  if (!authToken) return res.status(401).json({ error: 'Missing X-Kite-Auth' })

  try {
    const instruments = await getNiftyInstruments(authToken)
    res.set('Cache-Control', 'private, max-age=3600').json(instruments)
  } catch (err) {
    console.error('[niftyInstruments] error:', err.message)
    res.status(502).json({ error: err.message })
  }
})

module.exports = router
