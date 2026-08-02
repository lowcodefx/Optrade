const { Router } = require('express')
const https = require('https')
const router = Router()

const CACHE_TTL = 30 * 60 * 1000
let cache = null
let cacheTime = 0

const LARGE_CAP = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'BHARTIARTL', 'ITC', 'KOTAKBANK', 'LT', 'WIPRO']
const MID_CAP   = ['MPHASIS', 'PIIND', 'LTTS', 'COFORGE', 'PERSISTENT', 'ABCAPITAL', 'SONACOMS', 'LTIM', 'KALYANKJIL', 'AARTIIND']
const SMALL_CAP = ['TEJASNET', 'CRAFTSMAN', 'HAPPYMIND', 'MEDANTA', 'BIKAJI', 'SENCO', 'NEWGEN', 'CYIENT', 'IRIS', 'GREENPANEL']
const ALL_SYMBOLS = [...LARGE_CAP, ...MID_CAP, ...SMALL_CAP]

function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Optrade/1.0', ...headers } }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) }
        catch { reject(new Error('JSON parse error')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

async function fetchKiteQuotes(apiKey, accessToken) {
  if (!apiKey || !accessToken) return { stocks: {}, niftyChange: 0 }
  const instruments = [...ALL_SYMBOLS.map(s => `NSE:${s}`), 'NSE:NIFTY 50']
  const qs = instruments.map(i => `i=${encodeURIComponent(i)}`).join('&')
  const url = `https://api.kite.trade/quote?${qs}`
  const res = await fetchJson(url, {
    'X-Kite-Version': '3',
    Authorization: `token ${apiKey}:${accessToken}`,
  })
  const data = res.data || {}
  const niftyQ = data['NSE:NIFTY 50']
  const niftyChange = (niftyQ?.ohlc?.close && niftyQ.ohlc.close > 0)
    ? ((niftyQ.last_price - niftyQ.ohlc.close) / niftyQ.ohlc.close) * 100
    : 0
  return { stocks: data, niftyChange }
}

function computeRS(stocks, niftyChange) {
  const rs = {}
  for (const sym of ALL_SYMBOLS) {
    const q = stocks[`NSE:${sym}`]
    if (q?.ohlc?.close && q.ohlc.close > 0) {
      const chg = ((q.last_price - q.ohlc.close) / q.ohlc.close) * 100
      rs[sym] = +((chg - niftyChange).toFixed(2))
    } else {
      rs[sym] = null
    }
  }
  return rs
}

function buildStockContext(stocks) {
  return ALL_SYMBOLS.map(sym => {
    const q = stocks[`NSE:${sym}`]
    if (!q) return `${sym}: no data`
    const chg = ((q.last_price - q.ohlc?.close) / (q.ohlc?.close || 1) * 100).toFixed(2)
    const vol = q.volume ? `vol ${(q.volume / 1000).toFixed(0)}K` : ''
    return `${sym}: LTP ${q.last_price} chg ${chg}% H52W ${q.ohlc?.high ?? '?'} L52W ${q.ohlc?.low ?? '?'} ${vol}`
  }).join('\n')
}

function callClaude(stockContext, newsHeadlines, claudeKey) {
  const today = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })

  const prompt = `You are an expert Indian stock analyst. Date: ${today}.

Analyze these ${ALL_SYMBOLS.length} NSE stocks for swing trading (3-10 day holds) and score each on 4 dimensions (0-100).

STOCK DATA (live quotes):
${stockContext}

RECENT MARKET NEWS:
${newsHeadlines}

SCORING DIMENSIONS:
- technical: price momentum, volume confirmation, moving average alignment, trend strength
- fundamental: business quality, profitability, sector tailwinds (use your training knowledge)
- sentiment: news sentiment, FII/DII flow signals, sector buzz
- growth: earnings trajectory, sector growth, company-specific catalysts

SIGNALS:
- BUY: totalScore >= 70 AND technical >= 65
- WATCH: totalScore 50-69
- AVOID: totalScore < 50

Respond with ONLY valid JSON, no markdown, no explanation:
{
  "largeCap": [
    {"symbol":"RELIANCE","technical":72,"fundamental":80,"sentiment":65,"growth":75,"totalScore":73,"signal":"BUY","summary":"One sentence about why this stock is interesting for swing trading"},
    ... (all 10 large cap stocks)
  ],
  "midCap": [ ... (all 10 mid cap stocks) ],
  "smallCap": [ ... (all 10 small cap stocks) ]
}`

  const body = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
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
          if (data.content?.[0]?.text) resolve(data.content[0].text)
          else reject(new Error('Unexpected Claude response: ' + JSON.stringify(data).slice(0, 200)))
        } catch (e) { reject(new Error('Claude parse error')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Claude timeout')) })
    req.write(body)
    req.end()
  })
}

function parseClaudeJson(text) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON found in Claude response')
  const parsed = JSON.parse(match[0])
  // Ensure totalScore is calculated correctly if missing
  for (const bucket of ['largeCap', 'midCap', 'smallCap']) {
    if (!Array.isArray(parsed[bucket])) throw new Error(`Missing ${bucket} in response`)
    parsed[bucket] = parsed[bucket].map(s => ({
      ...s,
      totalScore: s.totalScore ?? Math.round((s.technical + s.fundamental + s.sentiment + s.growth) / 4),
    }))
  }
  return parsed
}

function fallbackScores() {
  function score(symbols) {
    return symbols.map(sym => ({
      symbol: sym,
      technical: 50, fundamental: 50, sentiment: 50, growth: 50,
      totalScore: 50,
      signal: 'WATCH',
      summary: 'Analysis unavailable — using placeholder scores.',
    }))
  }
  return { largeCap: score(LARGE_CAP), midCap: score(MID_CAP), smallCap: score(SMALL_CAP) }
}

router.get('/', async (req, res) => {
  const claudeKey = process.env.ANTHROPIC_API_KEY
  const newsKey   = process.env.NEWS_API_KEY
  if (!claudeKey) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' })

  if (cache && Date.now() - cacheTime < CACHE_TTL) {
    return res.set('Cache-Control', 'no-store').json(cache)
  }

  // Parse Kite auth from X-Kite-Auth header (set by kiteAuthHeaders() in frontend)
  let apiKey = '', accessToken = ''
  const auth = req.headers['x-kite-auth'] || ''
  if (auth.startsWith('token ')) {
    const parts = auth.replace('token ', '').split(':')
    apiKey = parts[0]; accessToken = parts[1] || ''
  }

  try {
    const [quotes, newsData] = await Promise.allSettled([
      fetchKiteQuotes(apiKey, accessToken),
      newsKey
        ? fetchJson(`https://newsapi.org/v2/everything?q=NSE+OR+BSE+OR+%22Indian+stock%22+OR+nifty50&language=en&sortBy=publishedAt&pageSize=10&apiKey=${newsKey}`)
        : Promise.resolve({ articles: [] }),
    ])

    const { stocks: stockQuotes = {}, niftyChange = 0 } =
      quotes.status === 'fulfilled' ? quotes.value : {}
    const articles = (newsData.status === 'fulfilled' ? newsData.value.articles || [] : [])
      .filter(a => a.title && !a.title.includes('[Removed]'))
      .slice(0, 8)
      .map(a => a.title)

    const stockContext  = buildStockContext(stockQuotes)
    const newsHeadlines = articles.length > 0
      ? articles.join('\n')
      : 'No specific news available. Use general market knowledge.'

    const rawText = await callClaude(stockContext, newsHeadlines, claudeKey)
    const result  = parseClaudeJson(rawText)

    // Attach live price + RS vs NIFTY (from quote data, not Claude)
    const rsMap = computeRS(stockQuotes, niftyChange)
    const addRS = arr => arr.map(s => {
      const q = stockQuotes[`NSE:${s.symbol}`]
      const pctChg = q?.ohlc?.close > 0 ? ((q.last_price - q.ohlc.close) / q.ohlc.close) * 100 : null
      return {
        ...s,
        rs1d:             rsMap[s.symbol] ?? null,
        last_price:       q?.last_price ?? null,
        pct_change:       pctChg !== null ? +pctChg.toFixed(2) : null,
        instrument_token: q?.instrument_token ?? null,
      }
    })
    result.largeCap  = addRS(result.largeCap)
    result.midCap    = addRS(result.midCap)
    result.smallCap  = addRS(result.smallCap)

    result.updatedAt = new Date().toISOString()
    cache = result
    cacheTime = Date.now()
    res.set('Cache-Control', 'no-store').json(result)
  } catch (err) {
    console.error('[stockAnalysis] error:', err.message)
    if (cache) return res.set('Cache-Control', 'no-store').json({ ...cache, stale: true })
    res.set('Cache-Control', 'no-store').json({ ...fallbackScores(), error: err.message })
  }
})

module.exports = router
