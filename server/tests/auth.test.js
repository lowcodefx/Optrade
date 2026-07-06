const request = require('supertest')
const express = require('express')

// Must set env BEFORE requiring the middleware
process.env.BACKEND_KEY = 'test-secret-key'
const { authMiddleware } = require('../src/middleware/auth')

function makeApp() {
  const app = express()
  app.use('/api', authMiddleware)
  app.get('/api/test', (_req, res) => res.json({ ok: true }))
  return app
}

test('rejects request with no X-Backend-Key', async () => {
  const res = await request(makeApp()).get('/api/test')
  expect(res.status).toBe(401)
  expect(res.body.error).toBe('Unauthorized')
})

test('rejects request with wrong X-Backend-Key', async () => {
  const res = await request(makeApp()).get('/api/test').set('X-Backend-Key', 'wrong')
  expect(res.status).toBe(401)
})

test('passes request with correct X-Backend-Key', async () => {
  const res = await request(makeApp()).get('/api/test').set('X-Backend-Key', 'test-secret-key')
  expect(res.status).toBe(200)
  expect(res.body.ok).toBe(true)
})
