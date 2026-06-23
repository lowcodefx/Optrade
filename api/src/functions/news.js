const { app } = require('@azure/functions')
const https = require('https')

const FEEDS = {
  markets: 'https://economictimes.indiatimes.com/markets/rss.cms',
  economy: 'https://economictimes.indiatimes.com/news/economy/rss.cms',
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    })
    req.on('error', reject)
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')) })
  })
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
    // prefer <link> text, fall back to <guid>
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
    const feedUrl = FEEDS[source] ?? FEEDS.markets

    try {
      const xml = await fetchUrl(feedUrl)
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
        status: 200, // return 200 with empty list so UI degrades gracefully
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify({ items: [] }),
      }
    }
  },
})
