const { app } = require('@azure/functions')
const { BlobServiceClient } = require('@azure/storage-blob')

const STORAGE_CONN = process.env.TOKEN_STORAGE_CONNECTION_STRING ?? ''

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

app.http('setToken', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'set-token',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return { status: 204, headers: CORS_HEADERS, body: '' }
    }

    if (!STORAGE_CONN) {
      // Not configured — silently skip (background monitor just won't work)
      return {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, reason: 'not_configured' }),
      }
    }

    let payload
    try { payload = await request.json() }
    catch {
      return { status: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }
    }

    const { apiKey, accessToken } = payload ?? {}
    if (!apiKey || !accessToken) {
      return {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
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
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true }),
      }
    } catch (err) {
      context.log.error('setToken storage error:', err.message)
      return {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to store session' }),
      }
    }
  },
})
