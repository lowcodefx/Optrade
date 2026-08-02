/**
 * Daily holdings R:R alert — runs at 1 PM IST (07:30 UTC) on weekdays.
 *
 * Required env vars:
 *   TOKEN_STORAGE_CONNECTION_STRING  — Azure Blob connection string (already used by setToken.js)
 *   GMAIL_USER                       — Gmail address to send FROM (e.g. sutar.prashant100@gmail.com)
 *   GMAIL_APP_PASSWORD               — 16-char Google App Password (not your login password)
 *   ALERT_EMAIL                      — address to send alerts TO (defaults to GMAIL_USER)
 */

const https       = require('https')
const nodemailer  = require('nodemailer')
const { BlobServiceClient } = require('@azure/storage-blob')

// ── Cap profiles (must match HoldingsBucket.tsx) ───────────────────────────

const LARGE_CAP = new Set([
  'RELIANCE','TCS','HDFCBANK','INFY','ICICIBANK','BHARTIARTL','ITC',
  'KOTAKBANK','LT','WIPRO','HDFC','BAJFINANCE','ASIANPAINT','MARUTI',
  'TITAN','SUNPHARMA','NTPC','ONGC','COALINDIA','TATASTEEL',
])
const MID_CAP = new Set([
  'MPHASIS','PIIND','LTTS','COFORGE','PERSISTENT','ABCAPITAL',
  'SONACOMS','LTIM','KALYANKJIL','AARTIIND',
])

function capProfile(symbol) {
  if (LARGE_CAP.has(symbol)) return { slPct: 0.05, tgtPct: 0.12, label: 'LG' }
  if (MID_CAP.has(symbol))   return { slPct: 0.07, tgtPct: 0.16, label: 'MD' }
  return                            { slPct: 0.10, tgtPct: 0.22, label: 'SM' }
}

// ── Kite helpers ───────────────────────────────────────────────────────────

function kiteGet(path, apiKey, accessToken) {
  return new Promise((resolve, reject) => {
    const req = https.get(`https://api.kite.trade${path}`, {
      headers: {
        'X-Kite-Version': '3',
        Authorization: `token ${apiKey}:${accessToken}`,
      },
    }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())) }
        catch { reject(new Error('kite parse error')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('kite timeout')) })
  })
}

// ── Token reader (Azure Blob) ──────────────────────────────────────────────

async function readStoredToken() {
  const conn = process.env.TOKEN_STORAGE_CONNECTION_STRING
  if (!conn) throw new Error('TOKEN_STORAGE_CONNECTION_STRING not set')
  const blobSvc   = BlobServiceClient.fromConnectionString(conn)
  const container = blobSvc.getContainerClient('tokens')
  const blob      = container.getBlockBlobClient('zerodha-session.json')
  const dl        = await blob.download()
  const chunks    = []
  for await (const chunk of dl.readableStreamBody) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString())
}

// ── R:R computation ────────────────────────────────────────────────────────

const MIN_RR = 2.5   // alert threshold

function analyseHolding(h, livePrice) {
  const { slPct, tgtPct, label } = capProfile(h.tradingsymbol)
  const avg      = h.average_price
  const current  = livePrice ?? h.last_price
  const slPrice  = avg * (1 - slPct)
  const tgtPrice = avg * (1 + tgtPct)

  const originalRisk    = avg - slPrice          // risk at entry
  const achievedProfit  = current - avg
  const achievedRR      = originalRisk > 0 ? achievedProfit / originalRisk : 0

  const riskRemaining   = Math.max(0, current - slPrice)
  const rewardRemaining = Math.max(0, tgtPrice - current)
  const remainingRR     = riskRemaining > 0 ? rewardRemaining / riskRemaining : 0

  const pctGain  = avg > 0 ? ((current - avg) / avg) * 100 : 0

  return {
    symbol:    h.tradingsymbol,
    cap:       label,
    qty:       h.quantity,
    avg, current, slPrice, tgtPrice,
    pctGain:   +pctGain.toFixed(2),
    achievedRR: +achievedRR.toFixed(2),
    remainingRR: +remainingRR.toFixed(2),
    slHit:     current <= slPrice,
    targetHit: current >= tgtPrice,
    rrAlert:   achievedRR >= MIN_RR,
  }
}

// ── Email sender ───────────────────────────────────────────────────────────

function createTransporter() {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD not set')
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })
}

function buildEmail(alerts) {
  const to   = process.env.ALERT_EMAIL || process.env.GMAIL_USER
  const date = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long' })

  const rrRows    = alerts.filter(a => a.rrAlert && !a.slHit && !a.targetHit)
  const targetRows = alerts.filter(a => a.targetHit)
  const slRows    = alerts.filter(a => a.slHit)

  if (!rrRows.length && !targetRows.length && !slRows.length) return null

  function row(a, type) {
    const color = type === 'sl' ? '#ef4444' : '#22c55e'
    const label = type === 'target' ? '🎯 TARGET HIT'
                : type === 'sl'     ? '🛑 SL HIT'
                :                     `✅ R:R ${a.achievedRR}:1 achieved`
    return `
      <tr style="border-bottom:1px solid #1e293b">
        <td style="padding:8px 12px;font-weight:600;color:#e2e8f0">${a.symbol} <span style="font-size:10px;color:#64748b">${a.cap}</span></td>
        <td style="padding:8px 12px;color:#94a3b8">₹${a.avg.toFixed(0)} → ₹${a.current.toFixed(0)}</td>
        <td style="padding:8px 12px;color:${a.pctGain >= 0 ? '#22c55e' : '#ef4444'};font-weight:600">${a.pctGain >= 0 ? '+' : ''}${a.pctGain}%</td>
        <td style="padding:8px 12px;color:#64748b;font-size:11px">SL ₹${a.slPrice.toFixed(0)} · Tgt ₹${a.tgtPrice.toFixed(0)}</td>
        <td style="padding:8px 12px;font-weight:700;color:${color}">${label}</td>
      </tr>`
  }

  const tableRows = [
    ...targetRows.map(a => row(a, 'target')),
    ...slRows.map(a => row(a, 'sl')),
    ...rrRows.map(a => row(a, 'rr')),
  ].join('')

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#060d1a;font-family:'Segoe UI',sans-serif">
<div style="max-width:600px;margin:0 auto;padding:24px">

  <div style="margin-bottom:20px">
    <h1 style="margin:0;font-size:20px;color:#e2e8f0">📊 Optrade Holdings Alert</h1>
    <p style="margin:4px 0 0;font-size:13px;color:#475569">${date} · 1:00 PM IST</p>
  </div>

  <table style="width:100%;border-collapse:collapse;background:#0a1628;border-radius:8px;overflow:hidden">
    <thead>
      <tr style="background:#0f1f35">
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600">SYMBOL</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600">ENTRY → CMP</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600">P&L %</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600">LEVELS</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600">STATUS</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <div style="margin-top:16px;padding:12px 16px;background:#0a1628;border-radius:8px;border:1px solid #1e293b">
    <p style="margin:0;font-size:11px;color:#475569">
      R:R alert fires when <strong style="color:#94a3b8">achieved profit ≥ 2.5× original risk</strong>.
      SL and target levels use cap-aware defaults: LG 5%/12% · MD 7%/16% · SM 10%/22%.
      This is automated — open Optrade to see the full dashboard.
    </p>
  </div>

</div>
</body>
</html>`

  return {
    from:    `"Optrade" <${process.env.GMAIL_USER}>`,
    to,
    subject: `Optrade Alert — ${[...targetRows, ...slRows, ...rrRows].length} holding(s) need attention · ${date}`,
    html,
  }
}

// ── Main job ───────────────────────────────────────────────────────────────

async function runHoldingsAlert() {
  const tag = '[holdingsAlert]'
  console.log(`${tag} Starting daily check…`)

  // 1. Read stored Zerodha token
  let apiKey, accessToken
  try {
    const stored = await readStoredToken()
    apiKey       = stored.apiKey
    accessToken  = stored.accessToken
    console.log(`${tag} Token read for apiKey ${apiKey?.slice(0, 4)}****`)
  } catch (err) {
    console.error(`${tag} Could not read token:`, err.message)
    return
  }

  // 2. Fetch holdings
  let holdings = []
  try {
    const res = await kiteGet('/portfolio/holdings', apiKey, accessToken)
    holdings  = res.data ?? []
    console.log(`${tag} Fetched ${holdings.length} holdings`)
  } catch (err) {
    console.error(`${tag} Holdings fetch failed:`, err.message)
    return
  }
  if (!holdings.length) { console.log(`${tag} No holdings — skipping`); return }

  // 3. Fetch live quotes for all holdings
  const symbols  = holdings.map(h => `NSE:${h.tradingsymbol}`)
  const qs       = symbols.map(s => `i=${encodeURIComponent(s)}`).join('&')
  let quoteData  = {}
  try {
    const qRes = await kiteGet(`/quote?${qs}`, apiKey, accessToken)
    quoteData  = qRes.data ?? {}
  } catch (err) {
    console.warn(`${tag} Quote fetch failed, using last_price from holdings:`, err.message)
  }

  // 4. Analyse each holding
  const alerts = holdings.map(h => {
    const livePrice = quoteData[`NSE:${h.tradingsymbol}`]?.last_price ?? null
    return analyseHolding(h, livePrice)
  })

  const triggered = alerts.filter(a => a.rrAlert || a.slHit || a.targetHit)
  console.log(`${tag} ${triggered.length} alert(s) triggered out of ${alerts.length} holdings`)

  if (!triggered.length) { console.log(`${tag} Nothing to email`); return }

  // 5. Send email
  try {
    const transporter = createTransporter()
    const mail        = buildEmail(triggered)
    if (!mail) { console.log(`${tag} No alert rows — skipping email`); return }
    const info = await transporter.sendMail(mail)
    console.log(`${tag} Email sent → ${info.messageId}`)
  } catch (err) {
    console.error(`${tag} Email failed:`, err.message)
  }
}

module.exports = { runHoldingsAlert }
