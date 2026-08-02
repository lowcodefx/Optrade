const https  = require('https')
const router = require('express').Router()

const NIFTY_TOKEN = 256265
const EMA_PERIOD  = 20

// Simple EMA computation
function ema(closes, period) {
  if (closes.length < period) return null
  const k  = 2 / (period + 1)
  let e    = closes.slice(0, period).reduce((s, v) => s + v, 0) / period
  for (let i = period; i < closes.length; i++) e = closes[i] * k + e * (1 - k)
  return +e.toFixed(2)
}

function kiteHistorical(token, interval, from, to, authHeader) {
  return new Promise((resolve, reject) => {
    const path = `/instruments/historical/${token}/${interval}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&continuous=0&oi=0`
    const req  = https.get(`https://api.kite.trade${path}`, {
      headers: { 'X-Kite-Version': '3', Authorization: authHeader },
    }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())) }
        catch { reject(new Error('parse error')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

router.get('/', async (req, res) => {
  const auth = req.headers['x-kite-auth']
  if (!auth) return res.status(401).json({ error: 'missing x-kite-auth' })

  // IST offset: UTC+5:30
  const now       = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  const istNow    = new Date(now.getTime() + istOffset)
  const todayIST  = istNow.toISOString().slice(0, 10)
  // Fetch last 4 calendar days of 15min candles (enough candles on any trading day)
  const d = new Date(istNow)
  d.setDate(d.getDate() - 4)
  const fromDate = d.toISOString().slice(0, 10)
  const from = `${fromDate} 09:15:00`
  const to   = `${todayIST} 15:30:00`

  try {
    const kiteRes = await kiteHistorical(NIFTY_TOKEN, '15minute', from, to, auth)
    const candles = kiteRes.data?.candles ?? []   // [timestamp, open, high, low, close, volume, oi]
    if (candles.length < EMA_PERIOD) {
      return res.json({ bias: 'NEUTRAL', ema20: null, spot: null, note: 'Insufficient candle data' })
    }
    const closes = candles.map(c => c[4])
    const spot   = closes[closes.length - 1]
    const e20    = ema(closes, EMA_PERIOD)
    const diff   = e20 ? ((spot - e20) / e20) * 100 : 0
    const bias   = diff > 0.15 ? 'UP' : diff < -0.15 ? 'DOWN' : 'NEUTRAL'
    const note   = `NIFTY ${spot.toFixed(0)} vs EMA20 ${e20} (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%)`
    return res.json({ bias, ema20: e20, spot, note })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

module.exports = router
