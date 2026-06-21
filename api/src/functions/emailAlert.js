const { app } = require('@azure/functions')
const nodemailer = require('nodemailer')

// Credentials come from Azure App Settings (env vars), never from the request body.
// Set GMAIL_USER, GMAIL_APP_PASS, and NOTIFICATION_EMAIL in Azure → Function App → Configuration.
// For local dev: add them to api/local.settings.json under "Values".
const GMAIL_USER = process.env.GMAIL_USER ?? ''
const GMAIL_PASS = process.env.GMAIL_APP_PASS ?? ''
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL ?? ''

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

app.http('emailAlert', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'email-alert',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return { status: 204, headers: CORS_HEADERS, body: '' }
    }

    // If credentials not configured server-side, fail silently
    if (!GMAIL_USER || !GMAIL_PASS || !NOTIFICATION_EMAIL) {
      context.log.warn('Email alert skipped: server-side credentials not configured (GMAIL_USER / GMAIL_APP_PASS / NOTIFICATION_EMAIL)')
      return {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, reason: 'not_configured' }),
      }
    }

    let payload
    try {
      payload = await request.json()
    } catch {
      return { status: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }
    }

    const { subject, body } = payload

    if (!subject || !body) {
      return {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required fields: subject, body' }),
      }
    }

    // Sanitise: strip CR/LF from subject to prevent header injection
    const safeSubject = String(subject).replace(/[\r\n]/g, ' ').slice(0, 200)
    const safeBody = String(body).slice(0, 5000)
    // Safe HTML: escape then replace newlines with <br>
    const safeHtml = escapeHtml(safeBody).replace(/\n/g, '<br>')

    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: GMAIL_USER, pass: GMAIL_PASS },
      })

      await transporter.sendMail({
        from: `"Optrade Alerts" <${GMAIL_USER}>`,
        to: NOTIFICATION_EMAIL,
        subject: safeSubject,
        text: safeBody,
        html: safeHtml,
      })

      context.log(`Email alert sent: ${safeSubject}`)

      return {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true }),
      }
    } catch (err) {
      context.log.error('Email send error:', err.message) // logged server-side only
      return {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to send email' }), // no detail exposed to caller
      }
    }
  },
})
