const { app }         = require('@azure/functions')
const { BlobServiceClient } = require('@azure/storage-blob')
const { EmailClient } = require('@azure/communication-email')
const https           = require('https')

const STORAGE_CONN       = process.env.TOKEN_STORAGE_CONNECTION_STRING ?? ''
const ACS_CONN_STR       = process.env.AZURE_COMMUNICATION_CONNECTION_STRING ?? ''
const SENDER_ADDRESS     = process.env.SENDER_ADDRESS ?? ''
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL ?? ''
const CE_THRESHOLD       = parseInt(process.env.CE_PE_THRESHOLD ?? '700')

// ── IST market hours: 9:15–15:30, Mon–Fri ────────────────────────────────────
function isMarketHours() {
  const istMs = Date.now() + 5.5 * 3600000
  const ist   = new Date(istMs)
  const dow   = ist.getUTCDay()                     // 0=Sun 6=Sat
  if (dow === 0 || dow === 6) return false
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes()
  return mins >= 555 && mins <= 930                  // 9:15 → 15:30
}

// ── Kite REST call ────────────────────────────────────────────────────────────
function kiteGet(path, apiKey, accessToken) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.kite.trade',
        path,
        method: 'GET',
        headers: {
          'X-Kite-Version': '3',
          Authorization: `token ${apiKey}:${accessToken}`,
        },
        timeout: 6000,
      },
      res => {
        let data = ''
        res.on('data', c => { data += c })
        res.on('end', () => {
          try { resolve(JSON.parse(data)) }
          catch { reject(new Error('Invalid JSON from Kite')) }
        })
      }
    )
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Kite timeout')) })
    req.end()
  })
}

// ── Score engine (simplified — matches app logic directionally) ───────────────
function calcScores(nifty, vix) {
  const spot      = nifty.last_price
  const prevClose = nifty.ohlc?.close ?? spot
  const open      = nifty.ohlc?.open  ?? spot
  const high      = nifty.ohlc?.high  ?? spot
  const changePct = prevClose > 0 ? (spot - prevClose) / prevClose * 100 : 0
  const vixVal    = vix.last_price ?? 15

  let ce = 500

  // Momentum
  if      (changePct >  1.5) ce += 200
  else if (changePct >  1.0) ce += 150
  else if (changePct >  0.5) ce += 100
  else if (changePct >  0.0) ce +=  30
  else if (changePct < -1.5) ce -= 220
  else if (changePct < -1.0) ce -= 160
  else if (changePct < -0.5) ce -= 100
  else                       ce -=  30

  // VIX — low VIX = bullish environment
  if      (vixVal < 12) ce += 130
  else if (vixVal < 15) ce +=  60
  else if (vixVal > 22) ce -= 170
  else if (vixVal > 18) ce -=  80

  // Intraday bias: spot vs open
  const spotVsOpen = open > 0 ? (spot - open) / open * 100 : 0
  if      (spotVsOpen >  0.5) ce +=  90
  else if (spotVsOpen >  0.2) ce +=  40
  else if (spotVsOpen < -0.5) ce -=  90
  else if (spotVsOpen < -0.2) ce -=  40

  // Day range strength (high - open) / open
  const highStrength = open > 0 ? (high - open) / open * 100 : 0
  if (highStrength > 0.5) ce += 50

  ce = Math.max(0, Math.min(1000, Math.round(ce)))
  const pe = Math.max(0, Math.min(1000, 1000 - ce))
  return { ceScore: ce, peScore: pe }
}

// ── Blob helpers ──────────────────────────────────────────────────────────────
async function readBlob(container, name) {
  try {
    const buf = await container.getBlockBlobClient(name).downloadToBuffer()
    return JSON.parse(buf.toString())
  } catch { return null }
}

async function writeBlob(container, name, obj) {
  const str = JSON.stringify(obj)
  await container.getBlockBlobClient(name).upload(str, Buffer.byteLength(str), {
    blobHTTPHeaders: { blobContentType: 'application/json' },
  })
}

// ── Email via ACS ─────────────────────────────────────────────────────────────
async function sendAlert(subject, body) {
  if (!ACS_CONN_STR || !SENDER_ADDRESS || !NOTIFICATION_EMAIL) return
  const esc  = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>')
  const client = new EmailClient(ACS_CONN_STR)
  const poller = await client.beginSend({
    senderAddress: SENDER_ADDRESS,
    recipients: { to: [{ address: NOTIFICATION_EMAIL }] },
    content: {
      subject,
      plainText: body,
      html: `<pre style="font-family:sans-serif;font-size:13px;line-height:1.6">${esc(body)}</pre>`,
    },
  })
  await poller.pollUntilDone()
}

// ── Timer: every 5 min, UTC 3–10 (= IST 8:30–15:30), Mon–Fri ─────────────────
app.timer('marketMonitor', {
  schedule: '0 */5 3-10 * * 1-5',
  handler: async (_timer, context) => {
    if (!isMarketHours()) return

    if (!STORAGE_CONN) {
      context.log.warn('TOKEN_STORAGE_CONNECTION_STRING not configured')
      return
    }

    const blobSvc   = BlobServiceClient.fromConnectionString(STORAGE_CONN)
    const container = blobSvc.getContainerClient('tokens')

    // ── Read stored Zerodha session ───────────────────────────────────────────
    const session = await readBlob(container, 'zerodha-session.json')
    if (!session?.apiKey || !session?.accessToken) {
      context.log('No Zerodha session — user needs to log in first')
      return
    }

    // Zerodha tokens expire daily — reject if older than 14h
    const ageHours = (Date.now() - new Date(session.setAt).getTime()) / 3_600_000
    if (ageHours > 14) {
      context.log(`Token is ${ageHours.toFixed(1)}h old — skipping (user must re-login)`)
      return
    }

    // ── Fetch NIFTY + VIX ────────────────────────────────────────────────────
    let nifty, vix
    try {
      const resp = await kiteGet(
        '/quote?i=NSE%3ANIFTY+50&i=NSE%3AINDIA+VIX',
        session.apiKey,
        session.accessToken
      )
      nifty = resp.data?.['NSE:NIFTY 50']
      vix   = resp.data?.['NSE:INDIA VIX']
    } catch (err) {
      context.log.error('Kite API error:', err.message)
      return
    }

    if (!nifty || !vix) { context.log('Empty quote response'); return }

    const spot = nifty.last_price
    const vixVal = vix.last_price
    const { ceScore, peScore } = calcScores(nifty, vix)
    context.log(`NIFTY ${spot.toFixed(0)} | VIX ${vixVal.toFixed(2)} | CE ${ceScore} | PE ${peScore}`)

    // ── Rate-limit: one alert per signal per hour ─────────────────────────────
    const state   = await readBlob(container, 'alert-state.json') ?? {}
    const hourKey = new Date().toISOString().slice(0, 13) // e.g. "2026-06-22T06"
    let stateChanged = false

    if (ceScore >= CE_THRESHOLD && state.ceHourKey !== hourKey) {
      context.log(`CE ${ceScore} >= ${CE_THRESHOLD} — sending email`)
      await sendAlert(
        `[Optrade] Strong CE Buy Signal – Score ${ceScore}/1000`,
        `Strong CE buy opportunity detected by background monitor:\n\n` +
        `CE Score : ${ceScore}/1000\n` +
        `NIFTY    : ${spot.toFixed(0)}\n` +
        `VIX      : ${vixVal.toFixed(2)}\n` +
        `Time     : ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST\n\n` +
        `Open Optrade to review and place your trade.\n\n---\nOptrade Background Monitor`
      )
      state.ceHourKey = hourKey
      stateChanged = true
    }

    if (peScore >= CE_THRESHOLD && state.peHourKey !== hourKey) {
      context.log(`PE ${peScore} >= ${CE_THRESHOLD} — sending email`)
      await sendAlert(
        `[Optrade] Strong PE Buy Signal – Score ${peScore}/1000`,
        `Strong PE buy opportunity detected by background monitor:\n\n` +
        `PE Score : ${peScore}/1000\n` +
        `NIFTY    : ${spot.toFixed(0)}\n` +
        `VIX      : ${vixVal.toFixed(2)}\n` +
        `Time     : ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST\n\n` +
        `Open Optrade to review and place your trade.\n\n---\nOptrade Background Monitor`
      )
      state.peHourKey = hourKey
      stateChanged = true
    }

    if (stateChanged) await writeBlob(container, 'alert-state.json', state)
  },
})
