// server/src/middleware/auth.js
const crypto = require('crypto')

function authMiddleware(req, res, next) {
  const provided = req.headers['x-backend-key']
  const expected = process.env.BACKEND_KEY
  if (typeof provided !== 'string' || !expected) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

module.exports = { authMiddleware }
