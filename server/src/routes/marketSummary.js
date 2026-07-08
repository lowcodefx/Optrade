const { Router } = require('express')
const https = require('https')
const router = Router()

const CACHE_TTL = 10 * 60 * 1000  // 10 minutes — fast enough to catch breaking news
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

function extractItems(xml) {
  // Extract title + pubDate pairs from RSS
  const items = []
  const itemBlocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
  for (const block of itemBlocks) {
    const content = block[1]
    const titleMatch = content.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s)
    const dateMatch = content.match(/<pubDate>(.*?)<\/pubDate>/)
    const title = titleMatch ? titleMatch[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim() : ''
    const pubDate = dateMatch ? dateMatch[1].trim() : ''
    if (title && title.length > 15 && title.length < 250) {
      items.push({ title, pubDate })
    }
  }
  return items.slice(0, 10)
}

async function fetchAllNews() {
  const feeds = [
    'https://www.moneycontrol.com/rss/latestnews.xml',
    'https://economictimes.indiatimes.com/markets/rss.cms',
    'https://www.business-standard.com/rss/markets-106.rss',
  ]
  const all = []
  for (const feed of feeds) {
    try {
      const xml = await fetchUrl(feed)
      all.push(...extractItems(xml))
    } catch (e) {
      console.error('[marketSummary] feed error:', feed, e.message)
    }
  }
  // Deduplicate by title similarity
  const seen = new Set()
  return all.filter(item => {
    const key = item.title.toLowerCase().slice(0, 40)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 18)
}

function callClaude(items, apiKey) {
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })
  const newsText = items.map((item, i) => {
    const time = item.pubDate ? ` [${item.pubDate}]` : ''
    return `${i + 1}.${time} ${item.title}`
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
    const items = await fetchAllNews()
    if (items.length === 0) {
      if (cache) return res.set('Cache-Control', 'no-store').json({ ...cache, stale: true })
      return res.status(502).json({ error: 'No headlines available' })
    }
    const summary = await callClaude(items, apiKey)
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
