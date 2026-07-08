const { Router } = require('express')
const https = require('https')
const router = Router()

const CACHE_TTL = 10 * 60 * 1000
let cache = null
let cacheTime = 0

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Optrade/1.0' } }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) }
        catch (e) { reject(new Error('JSON parse error')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

async function fetchNews(apiKey) {
  const url = `https://newsapi.org/v2/everything?q=NIFTY+OR+sensex+OR+%22Indian+market%22+OR+RBI+OR+%22stock+market%22&language=en&sortBy=publishedAt&pageSize=15&apiKey=${apiKey}`
  const data = await fetchJson(url)
  if (data.status !== 'ok') throw new Error(data.message || 'NewsAPI error')
  return (data.articles || [])
    .filter(a => a.title && !a.title.includes('[Removed]'))
    .slice(0, 12)
    .map(a => ({ title: a.title, publishedAt: a.publishedAt }))
}

function callClaude(articles, claudeKey) {
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })
  const newsText = articles.map((a, i) => {
    const t = a.publishedAt ? new Date(a.publishedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : ''
    return `${i + 1}. [${t}] ${a.title}`
  }).join('\n')

  const prompt = `You are a market alert assistant for an Indian NIFTY options trader. Current IST time: ${now}.

Read these headlines and give 2-4 short plain-English alerts about anything that could move NIFTY in the next few hours.

Headlines:
${newsText}

Format each alert exactly like this (no bold, no markdown, no emojis):
Alert 1: <what happened and what it means for NIFTY in plain simple English>
Alert 2: <next alert>

Rules:
- Each alert must be one sentence, max 15 words
- Say "bullish" or "bearish" and roughly how long the move might last
- Ignore company-specific news unless it affects the index
- If nothing important, write: Alert 1: No major news. Market likely to move on technicals today.
- Do not use any formatting, asterisks, or special characters`

  const body = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 350,
    messages: [{ role: 'user', content: prompt }],
  })

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString())
          if (data.content?.[0]) resolve(data.content[0].text)
          else reject(new Error('Unexpected Claude response'))
        } catch (e) { reject(new Error('Claude parse error')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Claude timeout')) })
    req.write(body)
    req.end()
  })
}

router.get('/', async (req, res) => {
  const claudeKey = process.env.ANTHROPIC_API_KEY
  const newsKey = process.env.NEWS_API_KEY
  if (!claudeKey || !newsKey) return res.status(503).json({ error: 'Market summary not configured' })

  if (cache && Date.now() - cacheTime < CACHE_TTL) {
    return res.set('Cache-Control', 'no-store').json(cache)
  }

  try {
    const articles = await fetchNews(newsKey)
    if (articles.length === 0) {
      if (cache) return res.set('Cache-Control', 'no-store').json({ ...cache, stale: true })
      return res.status(502).json({ error: 'No headlines available' })
    }
    const summary = await callClaude(articles, claudeKey)
    cache = { summary, updatedAt: new Date().toISOString() }
    cacheTime = Date.now()
    res.set('Cache-Control', 'no-store').json(cache)
  } catch (err) {
    console.error('[marketSummary] error:', err.message)
    if (cache) return res.set('Cache-Control', 'no-store').json({ ...cache, stale: true })
    res.status(502).json({ error: 'Market summary unavailable' })
  }
})

module.exports = router
