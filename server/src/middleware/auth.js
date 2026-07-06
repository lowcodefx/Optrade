const authMiddleware = (_req, _res, next) => {
  // TODO: Implement X-Backend-Key validation in Task 2
  next()
}

module.exports = { authMiddleware }
