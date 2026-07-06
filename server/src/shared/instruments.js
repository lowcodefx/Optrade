// Shared instruments cache — required by both niftyInstruments.js and optionChain.js
// so a single download populates both functions on the same Azure instance.
const https = require('https')

let _instruments = null
let _instrDay    = ''
let _instrPromise = null

function kiteGet(path, authToken) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.kite.trade',
      path,
      method: 'GET',
      headers: { 'X-Kite-Version': '3', 'Authorization': authToken },
    }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }))
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('instruments download timed out')) })
    req.end()
  })
}

function stripQ(s) { return (s || '').trim().replace(/^"|"$/g, '') }

function parseNiftyOptions(csv) {
  const lines = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n')
  if (lines.length < 2) return []

  const h = lines[0].split(',').map(s => s.trim())
  const col = n => h.indexOf(n)

  const siI = col('tradingsymbol'), niI = col('name')
  const eiI = col('expiry'), kiI = col('strike'), iiI = col('instrument_type')

  if ([siI, niI, eiI, kiI, iiI].some(i => i === -1)) {
    console.error('[instruments] Missing columns in header:', h.join(','))
    return []
  }

  // Log first 5 data rows so we can see actual name/expiry values
  console.log('[instruments] Sample rows:', lines.slice(1, 6).map(l => l.slice(0, 200)).join('\n'))

  const today = new Date().toISOString().slice(0, 10)
  let failName = 0, failType = 0, failExpiry = 0, failStrike = 0

  const result = lines.slice(1).map(line => {
    if (!line.trim()) return null
    const c = line.split(',')
    const name = stripQ(c[niI])
    const tradingsymbol = stripQ(c[siI])
    // Accept 'NIFTY' name OR tradingsymbol starting with NIFTY+digit (weekly/monthly format)
    const isNifty = name === 'NIFTY' || (/^NIFTY\d/.test(tradingsymbol) && name === '')
    if (!isNifty) { failName++; return null }
    const itype = stripQ(c[iiI])
    if (itype !== 'CE' && itype !== 'PE') { failType++; return null }
    const expiry = stripQ(c[eiI])
    if (!expiry || expiry < today) { failExpiry++; return null }
    const strike = parseFloat(c[kiI])
    if (isNaN(strike)) { failStrike++; return null }
    return { tradingsymbol, expiry, strike, instrument_type: itype }
  }).filter(Boolean)

  console.log(`[instruments] Filter stats — name:${failName} type:${failType} expiry:${failExpiry} strike:${failStrike} passed:${result.length}`)
  return result
}

async function getNiftyInstruments(authToken) {
  const today = new Date().toISOString().slice(0, 10)
  if (_instruments && _instrDay === today) return _instruments

  // De-dup: concurrent requests share one in-flight download
  if (_instrPromise) return _instrPromise

  _instrPromise = (async () => {
    console.log('[instruments] Downloading NFO CSV from Kite...')
    const r = await kiteGet('/instruments/NFO', authToken)
    if (r.status !== 200) {
      console.error('[instruments] Kite body (first 150):', r.body.slice(0, 150).replace(/[\r\n]/g, ' '))
      throw new Error(`Kite /instruments/NFO returned status ${r.status}`)
    }
    const parsed = parseNiftyOptions(r.body)
    if (parsed.length === 0) {
      const firstLine = r.body.slice(0, 300).split('\n')[0]
      console.error('[instruments] CSV parse failed. bytes:', r.body.length, 'firstLine:', firstLine.replace(/[\r\n]/g, ' '))
      throw new Error('CSV parsed 0 NIFTY instruments — check server logs')
    }
    _instruments = parsed
    _instrDay = today
    console.log(`[instruments] Cached ${parsed.length} NIFTY options for ${today}`)
    return _instruments
  })()

  try {
    return await _instrPromise
  } finally {
    _instrPromise = null
  }
}

function getNearestExpiry(instruments) {
  const today = new Date().toISOString().slice(0, 10)
  const expiries = [...new Set(instruments.map(i => i.expiry))].filter(e => e >= today).sort()
  return expiries[0] ?? today
}

module.exports = { getNiftyInstruments, getNearestExpiry, parseNiftyOptions }
