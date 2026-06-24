const { app } = require('@azure/functions')
const https = require('https')
const http = require('http')

// Each source has a primary URL and optional fallbacks tried in order
const FEEDS = {
  markets: [
    'https://economictimes.indiatimes.com/markets/rss.cms',
    'https://www.moneycontrol.com/rss/marketsnews.xml',
    'https://feeds.feedburner.com/ndtvprofit-latest',
  ],
  economy: [
    'https://economictimes.indiatimes.com/news/economy/rss.cms',
    'https://www.moneycontrol.com/rss/economy.xml',
    'https://feeds.feedburner.com/ndtvprofit-latest',
  ],
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
    }, res => {
      // Follow redirects (max 3)
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve, reject)
      }
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error(`HTTP ${res.statusCode}`))
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    })
    req.on('error', reject)
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

async function fetchWithFallback(urls, context) {
  for (const url of urls) {
    try {
      const xml = await fetchUrl(url)
      if (xml.includes('<item>')) return xml
    } catch (err) {
      context.log.warn(`news: ${url} failed: ${err.message}`)
    }
  }
  return null
}

function extractCdata(block, tag) {
  const cdataRe = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`)
  const plainRe  = new RegExp(`<${tag}>([^<]*)<\\/${tag}>`)
  const m = cdataRe.exec(block) || plainRe.exec(block)
  return m ? m[1].trim() : ''
}

function parseRss(xml) {
  const items = []
  const re = /<item>([\s\S]*?)<\/item>/g
  let m
  while ((m = re.exec(xml)) !== null) {
    const block = m[1]
    const title = extractCdata(block, 'title')
    const linkM = /<link>([^<]*)<\/link>/.exec(block) || /<guid[^>]*>([^<]+)<\/guid>/.exec(block)
    const link = linkM ? linkM[1].trim() : ''
    const pubDate = extractCdata(block, 'pubDate') || /<pubDate>([^<]*)<\/pubDate>/.exec(block)?.[1]?.trim() || ''
    const rawDesc = extractCdata(block, 'description')
    const description = rawDesc.replace(/<[^>]+>/g, '').trim()
    if (title) items.push({ title, link, pubDate, description })
  }
  return items
}

app.http('news', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'news',
  handler: async (request, context) => {
    const source = request.query.get('source') ?? 'markets'
    const urls = FEEDS[source] ?? FEEDS.markets

    try {
      const xml = await fetchWithFallback(urls, context)
      if (!xml) {
        context.log.warn(`news: all sources failed for ${source}`)
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
          body: JSON.stringify({ items: [] }),
        }
      }
      const items = parseRss(xml)
      context.log(`news: fetched ${items.length} items from ${source}`)
      return {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ items }),
      }
    } catch (err) {
      context.log.error('news fetch error:', err.message)
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify({ items: [] }),
      }
    }
  },
})
