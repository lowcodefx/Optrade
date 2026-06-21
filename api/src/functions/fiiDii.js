const { app } = require('@azure/functions')
const https = require('https')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function httpsGet(hostname, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.nseindia.com/',
        ...headers,
      },
    }
    const req = https.request(options, res => {
      const chunks = []
      const cookies = res.headers['set-cookie'] ?? []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ body: Buffer.concat(chunks).toString(), status: res.statusCode, cookies }))
    })
    req.on('error', reject)
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')) })
    req.end()
  })
}

app.http('fiiDii', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'fii-dii',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return { status: 204, headers: CORS_HEADERS, body: '' }
    }

    try {
      // Step 1: Get NSE session cookie
      const home = await httpsGet('www.nseindia.com', '/')
      const cookieStr = home.cookies.map(c => c.split(';')[0]).join('; ')

      // Step 2: Fetch FII/DII data with cookie
      const dataRes = await httpsGet('www.nseindia.com', '/api/fiidiiTradeReact', {
        Cookie: cookieStr,
        'X-Requested-With': 'XMLHttpRequest',
      })

      if (dataRes.status !== 200) {
        throw new Error(`NSE returned ${dataRes.status}`)
      }

      const rows = JSON.parse(dataRes.body)
      if (!Array.isArray(rows) || rows.length === 0) throw new Error('No data')

      const fiiRow = rows.find(r => r.category?.includes('FII') || r.category?.includes('FPI'))
      const diiRow = rows.find(r => r.category === 'DII')

      if (!fiiRow && !diiRow) throw new Error('FII/DII rows not found')

      const result = {
        date: (fiiRow ?? diiRow)?.date ?? new Date().toLocaleDateString('en-IN'),
        fiiBuy: fiiRow?.buyValue ?? 0,
        fiiSell: fiiRow?.saleValue ?? 0,
        fiiNet: fiiRow?.netValue ?? 0,
        diiBuy: diiRow?.buyValue ?? 0,
        diiSell: diiRow?.saleValue ?? 0,
        diiNet: diiRow?.netValue ?? 0,
      }

      return {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      }
    } catch (err) {
      context.log.error('FII/DII fetch error:', err.message)
      // Return stale/fallback so UI doesn't break
      return {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date().toLocaleDateString('en-IN'),
          fiiBuy: 0, fiiSell: 0, fiiNet: 0,
          diiBuy: 0, diiSell: 0, diiNet: 0,
          error: err.message,
        }),
      }
    }
  },
})
