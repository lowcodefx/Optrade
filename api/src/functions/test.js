const { app } = require('@azure/functions')

app.http('test', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'test',
  handler: async (_request, context) => {
    context.log('test function invoked')
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true, time: new Date().toISOString(), runtime: process.version }),
    }
  },
})
