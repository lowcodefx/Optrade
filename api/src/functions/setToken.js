const { app } = require('@azure/functions')
const { BlobServiceClient } = require('@azure/storage-blob')

const STORAGE_CONN   = process.env.TOKEN_STORAGE_CONNECTION_STRING ?? ''
// Lock CORS to the deployed SWA origin only
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'https://black-pond-09bbb5b00.7.azurestaticapps.net'

function corsHeaders(origin) {
  // Reflect origin only when it matches the allowlist — otherwise omit the header
  const allowed = origin === ALLOWED_ORIGIN ? origin : null
  return {
    'Access-Control-Allow-Origin':  allowed ?? '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
    'Vary': 'Origin',
  }
}

function isAllowedRequest(request) {
  const origin = request.headers.get('origin') ?? ''
  const xrw    = request.headers.get('x-requested-with') ?? ''
  return origin === ALLOWED_ORIGIN && xrw === 'Optrade'
}

app.http('setToken', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'set-token',
  handler: async (request, context) => {
    const origin = request.headers.get('origin') ?? ''

    if (request.method === 'OPTIONS') {
      return { status: 204, headers: corsHeaders(origin), body: '' }
    }

    // Reject requests from unknown origins or missing CSRF header
    if (!isAllowedRequest(request)) {
      context.log.warn('setToken: rejected request — origin=%s', origin)
      return { status: 403, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Forbidden' }) }
    }

    if (!STORAGE_CONN) {
      return {
        status: 200,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, reason: 'not_configured' }),
      }
    }

    let payload
    try { payload = await request.json() }
    catch {
      return { status: 400, headers: corsHeaders(origin), body: JSON.stringify({ error: 'Invalid JSON' }) }
    }

    const { apiKey, accessToken } = payload ?? {}
    if (!apiKey || !accessToken) {
      return {
        status: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing apiKey or accessToken' }),
      }
    }

    try {
      const blobSvc   = BlobServiceClient.fromConnectionString(STORAGE_CONN)
      const container = blobSvc.getContainerClient('tokens')
      await container.createIfNotExists()

      const data = JSON.stringify({ apiKey, accessToken, setAt: new Date().toISOString() })
      const blob = container.getBlockBlobClient('zerodha-session.json')
      await blob.upload(data, Buffer.byteLength(data), {
        blobHTTPHeaders: { blobContentType: 'application/json' },
      })

      context.log(`Session stored for apiKey: ${apiKey.slice(0, 4)}****`)

      return {
        status: 200,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true }),
      }
    } catch (err) {
      context.log.error('setToken storage error:', err.message)
      return {
        status: 502,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to store session' }),
      }
    }
  },
})
