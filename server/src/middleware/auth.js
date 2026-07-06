function authMiddleware(req, res, next) {
  const key = req.headers['x-backend-key']
  if (!key || key !== process.env.BACKEND_KEY) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

module.exports = { authMiddleware }
