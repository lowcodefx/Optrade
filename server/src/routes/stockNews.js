const { Router } = require('express')
const https = require('https')
const router = Router()

const COMPANY_NAMES = {
  RELIANCE: 'Reliance Industries', TCS: 'Tata Consultancy Services',
  HDFCBANK: 'HDFC Bank', INFY: 'Infosys', ICICIBANK: 'ICICI Bank',
  BHARTIARTL: 'Bharti Airtel', ITC: 'ITC Limited India', KOTAKBANK: 'Kotak Mahindra Bank',
  LT: 'Larsen Toubro', WIPRO: 'Wipro', MPHASIS: 'Mphasis', PIIND: 'PI Industries',
  LTTS: 'LT Technology Services', COFORGE: 'Coforge', PERSISTENT: 'Persistent Systems',
  ABCAPITAL: 'Aditya Birla Capital', SONACOMS: 'Sona Comstar', LTIM: 'LTIMindtree',
  KALYANKJIL: 'Kalyan Jewellers', AARTIIND: 'Aarti Industries', MEDANTA: 'Medanta hospital',
  BIKAJI: 'Bikaji Foods', SENCO: 'Senco Gold', NEWGEN: 'Newgen Software',
  CYIENT: 'Cyient', CRAFTSMAN: 'Craftsman Automation',
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Optrade/1.0' } }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) }
        catch { reject(new Error('parse error')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

const cache = new Map()
const CACHE_TTL = 30 * 60 * 1000

router.get('/', async (req, res) => {
  const { symbol } = req.query
  if (!symbol) return res.status(400).json({ error: 'symbol required' })

  const newsKey = process.env.NEWS_API_KEY
  if (!newsKey) return res.json({ articles: [] })

  const sym = String(symbol).toUpperCase().replace(/^NSE:|^BSE:/, '')
  const hit = cache.get(sym)
  if (hit && Date.now() - hit.t < CACHE_TTL) return res.json(hit.d)

  const company = COMPANY_NAMES[sym] || sym
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(company)}&language=en&sortBy=publishedAt&pageSize=5&apiKey=${newsKey}`

  try {
    const data = await fetchJson(url)
    const articles = (data.articles || [])
      .filter(a => a.title && !a.title.includes('[Removed]'))
      .slice(0, 4)
      .map(a => ({ title: a.title, source: a.source?.name ?? '', publishedAt: a.publishedAt }))
    const result = { articles }
    cache.set(sym, { d: result, t: Date.now() })
    res.json(result)
  } catch (err) {
    console.error('[stockNews]', err.message)
    res.json({ articles: [] })
  }
})

module.exports = router
