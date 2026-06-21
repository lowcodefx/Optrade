const { app } = require('@azure/functions')
const nodemailer = require('nodemailer')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

app.http('emailAlert', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'email-alert',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return { status: 204, headers: CORS_HEADERS, body: '' }
    }

    let payload
    try {
      payload = await request.json()
    } catch {
      return { status: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }
    }

    const { to, gmailUser, gmailPass, subject, body } = payload

    if (!to || !gmailUser || !gmailPass || !subject || !body) {
      return {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required fields: to, gmailUser, gmailPass, subject, body' }),
      }
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return { status: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid email address' }) }
    }

    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: gmailUser, pass: gmailPass },
      })

      await transporter.sendMail({
        from: `"Optrade Alerts" <${gmailUser}>`,
        to,
        subject,
        text: body,
        html: body.replace(/\n/g, '<br>'),
      })

      context.log(`Email sent to ${to}: ${subject}`)

      return {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true }),
      }
    } catch (err) {
      context.log.error('Email send error:', err.message)
      return {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to send email', detail: err.message }),
      }
    }
  },
})
