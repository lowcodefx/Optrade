const https = require('https')

// Cache verified Kite tokens → userId for 5 min to avoid a Kite round-trip on every request
const cache = new Map() // "token apiKey:accessToken" -> { userId, exp }

function kiteUserProfile(apiKey, accessToken) {
  return new Promise(resolve => {
    const req = https.request({
      hostname: 'api.kite.trade',
      path: '/user/profile',
      method: 'GET',
      headers: {
        'X-Kite-Version': '3',
        Authorization: `token ${apiKey}:${accessToken}`,
      },
    }, res => {
      let body = ''
      res.on('data', d => body += d)
      res.on('end', () => {
        try { resolve(JSON.parse(body).data?.user_id ?? null) } catch { resolve(null) }
      })
    })
    req.on('error', () => resolve(null))
    req.end()
  })
}

async function resolveUser(req, res, next) {
  const auth = req.headers['x-kite-auth']
  if (!auth || !auth.startsWith('token ')) {
    return res.status(401).json({ error: 'Kite authentication required' })
  }

  const cached = cache.get(auth)
  if (cached && cached.exp > Date.now()) {
    req.userId = cached.userId
    return next()
  }

  // auth format: "token <apiKey>:<accessToken>"
  const tokenPart = auth.slice('token '.length)
  const colonIdx  = tokenPart.indexOf(':')
  if (colonIdx < 0) return res.status(401).json({ error: 'Malformed X-Kite-Auth' })

  const apiKey      = tokenPart.slice(0, colonIdx)
  const accessToken = tokenPart.slice(colonIdx + 1)

  const userId = await kiteUserProfile(apiKey, accessToken)
  if (!userId) return res.status(401).json({ error: 'Invalid or expired Kite credentials' })

  cache.set(auth, { userId, exp: Date.now() + 5 * 60 * 1000 })
  // Evict entries older than 1 hour to prevent unbounded growth
  if (cache.size > 500) {
    const now = Date.now()
    for (const [k, v] of cache) { if (v.exp < now) cache.delete(k) }
  }

  req.userId = userId
  next()
}

module.exports = resolveUser
