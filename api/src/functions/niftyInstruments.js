const { app } = require('@azure/functions')
const { getNiftyInstruments } = require('../shared/instruments')

app.http('niftyInstruments', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'nifty-instruments',
  handler: async (request, context) => {
    const authToken = request.headers.get('x-kite-auth') || ''
    if (!authToken) {
      return { status: 401, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing X-Kite-Auth header' }) }
    }

    try {
      const instruments = await getNiftyInstruments(authToken)
      context.log(`niftyInstruments: ${instruments.length} NIFTY options`)
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600', 'X-Cache': 'HIT' },
        body: JSON.stringify({ instruments }),
      }
    } catch (err) {
      context.log.error('niftyInstruments error:', err.message)
      return { status: 502, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.message }) }
    }
  },
})
