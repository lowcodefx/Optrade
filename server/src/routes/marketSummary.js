const { Router } = require('express')
const https = require('https')
const router = Router()

const CACHE_TTL = 30 * 60 * 1000
let cache = null
let cacheTime = 0

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Optrade/1.0' } }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    })
    req.on('error', reject)
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('feed timeout')) })
  })
}

function extractHeadlines(xml) {
  const matches = [...xml.matchAll(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/gs)]
  return matches
    .map(m => m[1].trim())
    .filter(t => t.length > 20 && t.length < 200)
    .slice(0, 12)
}

async function fetchHeadlines() {
  const feeds = [
    'https://economictimes.indiatimes.com/markets/rss.cms',
    'https://www.moneycontrol.com/rss/marketreports.xml',
  ]
  const all = []
  for (const feed of feeds) {
    try {
      const xml = await fetchUrl(feed)
      all.push(...extractHeadlines(xml))
    } catch (e) {
      console.error('[marketSummary] feed error:', feed, e.message)
    }
  }
  return [...new Set(all)].slice(0, 15)
}

function callClaude(headlines, apiKey) {
  const prompt = `You are a concise market analyst for Indian equity markets (NSE/BSE). Based on these news headlines from today, give a brief market brief in exactly 4 bullet points:
• Overall market sentiment
• Key sector or stock in focus
• Important macro/global factor if any
• One trading implication for NIFTY options

Headlines:
${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}

Be direct, specific, and under 120 words total. No fluff.`

  const body = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString())
          if (data.content && data.content[0]) {
            resolve(data.content[0].text)
          } else {
            reject(new Error('Unexpected Claude response'))
          }
        } catch (e) {
          reject(new Error('Claude parse error'))
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Claude timeout')) })
    req.write(body)
    req.end()
  })
}

router.get('/', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(503).json({ error: 'Market summary not configured' })

  if (cache && Date.now() - cacheTime < CACHE_TTL) {
    return res.set('Cache-Control', 'no-store').json(cache)
  }

  try {
    const headlines = await fetchHeadlines()
    if (headlines.length === 0) {
      if (cache) return res.set('Cache-Control', 'no-store').json({ ...cache, stale: true })
      return res.status(502).json({ error: 'No headlines available' })
    }
    const summary = await callClaude(headlines, apiKey)
    cache = { summary, headlines, updatedAt: new Date().toISOString() }
    cacheTime = Date.now()
    res.set('Cache-Control', 'no-store').json(cache)
  } catch (err) {
    console.error('[marketSummary] error:', err.message)
    if (cache) return res.set('Cache-Control', 'no-store').json({ ...cache, stale: true })
    res.status(502).json({ error: 'Market summary unavailable' })
  }
})

module.exports = router
