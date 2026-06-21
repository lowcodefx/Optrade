const { app } = require('@azure/functions')
const https = require('https')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const MARKETS = [
  { symbol: '%5EDJI', name: 'Dow Jones' },
  { symbol: '%5EIXIC', name: 'NASDAQ' },
  { symbol: '%5EGSPC', name: 'S&P 500' },
]

function fetchYahoo(symbol) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'query1.finance.yahoo.com',
      path: `/v8/finance/chart/${symbol}?interval=1d&range=1d`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    }

    const req = https.request(options, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString()
          const json = JSON.parse(body)
          const result = json?.chart?.result?.[0]
          if (!result) { resolve(null); return }
          const meta = result.meta
          resolve({
            price: meta.regularMarketPrice ?? meta.previousClose ?? 0,
            change: (meta.regularMarketPrice ?? 0) - (meta.chartPreviousClose ?? 0),
            changePct: meta.chartPreviousClose > 0
              ? (((meta.regularMarketPrice ?? 0) - meta.chartPreviousClose) / meta.chartPreviousClose) * 100
              : 0,
          })
        } catch {
          resolve(null)
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('Timeout')) })
    req.end()
  })
}

app.http('globalMarkets', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'global-markets',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return { status: 204, headers: CORS_HEADERS, body: '' }
    }

    try {
      const results = await Promise.allSettled(
        MARKETS.map(async m => {
          const data = await fetchYahoo(m.symbol)
          if (!data) return null
          return { symbol: m.symbol, name: m.name, price: data.price, change: data.change, changePct: data.changePct }
        })
      )

      const markets = results
        .filter(r => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value)

      return {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(markets),
      }
    } catch (err) {
      context.log.error('Global markets error:', err.message)
      return {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to fetch global markets', markets: [] }),
      }
    }
  },
})
