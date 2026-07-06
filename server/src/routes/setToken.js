const { Router } = require('express')
const { BlobServiceClient } = require('@azure/storage-blob')
const router = Router()

const STORAGE_CONN   = process.env.TOKEN_STORAGE_CONNECTION_STRING ?? ''
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'https://black-pond-09bbb5b00.7.azurestaticapps.net'

router.post('/', async (req, res) => {
  const origin = req.headers['origin'] ?? ''
  const xrw    = req.headers['x-requested-with'] ?? ''

  if (origin !== ALLOWED_ORIGIN || xrw !== 'Optrade') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (!STORAGE_CONN) {
    return res.json({ success: false, reason: 'not_configured' })
  }

  const { apiKey, accessToken } = req.body ?? {}
  if (!apiKey || !accessToken) {
    return res.status(400).json({ error: 'Missing apiKey or accessToken' })
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
    console.log(`[setToken] Session stored for apiKey: ${apiKey.slice(0, 4)}****`)
    res.json({ success: true })
  } catch (err) {
    console.error('[setToken] storage error:', err.message)
    res.status(502).json({ error: 'Failed to store session' })
  }
})

module.exports = router
