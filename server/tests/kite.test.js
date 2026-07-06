const request = require('supertest')
const nock    = require('nock')

process.env.BACKEND_KEY = 'test-secret'
const app = require('../src/index')

afterEach(() => nock.cleanAll())

test('returns 400 when kite_path is missing', async () => {
  const res = await request(app)
    .get('/api/kite')
    .set('X-Backend-Key', 'test-secret')
  expect(res.status).toBe(400)
  expect(res.body.error).toBe('Missing kite_path')
})

test('proxies GET to Kite and returns response', async () => {
  nock('https://api.kite.trade')
    .get('/quote')
    .query({ i: 'NSE:NIFTY 50' })
    .reply(200, { status: 'success', data: {} }, { 'content-type': 'application/json' })

  const res = await request(app)
    .get('/api/kite?kite_path=quote&i=NSE%3ANIFTY%2050')
    .set('X-Backend-Key', 'test-secret')
    .set('X-Kite-Auth', 'token abc:xyz')

  expect(res.status).toBe(200)
})
