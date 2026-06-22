const { app } = require('@azure/functions')
const { EmailClient } = require('@azure/communication-email')

// Azure Communication Services setup (set these in Azure Portal → Function App → Configuration):
//
//   AZURE_COMMUNICATION_CONNECTION_STRING  ← from your Azure Email Communication Service resource
//   SENDER_ADDRESS                         ← e.g. DoNotReply@<guid>.azurecomm.net
//   NOTIFICATION_EMAIL                     ← lowcodefx@gmail.com  (or any recipient)
//
const ACS_CONN_STR        = process.env.AZURE_COMMUNICATION_CONNECTION_STRING ?? ''
const SENDER_ADDRESS      = process.env.SENDER_ADDRESS ?? ''
const NOTIFICATION_EMAIL  = process.env.NOTIFICATION_EMAIL ?? ''

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

    // Silently skip if Azure Communication Services not configured
    if (!ACS_CONN_STR || !SENDER_ADDRESS || !NOTIFICATION_EMAIL) {
      context.log.warn('Email alert skipped: AZURE_COMMUNICATION_CONNECTION_STRING, SENDER_ADDRESS, or NOTIFICATION_EMAIL not set')
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

    // Sanitise inputs
    const safeSubject = String(subject).replace(/[\r\n]/g, ' ').slice(0, 200)
    const safeBody    = String(body).slice(0, 5000)
    const safeHtml    = escapeHtml(safeBody).replace(/\n/g, '<br>')

    try {
      const client = new EmailClient(ACS_CONN_STR)

      const message = {
        senderAddress: SENDER_ADDRESS,
        recipients: {
          to: [{ address: NOTIFICATION_EMAIL }],
        },
        content: {
          subject: safeSubject,
          plainText: safeBody,
          html: `<pre style="font-family:sans-serif;font-size:13px;line-height:1.6">${safeHtml}</pre>`,
        },
      }

      const poller = await client.beginSend(message)
      const result = await poller.pollUntilDone()

      context.log(`Email sent to ${NOTIFICATION_EMAIL}, id=${result.id}, status=${result.status}`)

      return {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true }),
      }
    } catch (err) {
      context.log.error('Azure email send error:', err.message) // server-side only
      return {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to send email' }),
      }
    }
  },
})
