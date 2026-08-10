const { Router } = require('express')
const https = require('https')
const router = Router()

const SYSTEM_PROMPT = `You are a helpful trading assistant for an Indian retail stock market trader using the Optrade platform.
Answer questions about: stock trading, technical analysis, fundamental analysis, options, swing trading, NIFTY, market concepts, risk management, and general finance.
Be concise (2-5 sentences max). Use plain English. Format numbers in Indian style (lakhs/crores). No markdown bold, no bullet points unless specifically useful.`

function callClaude(messages, claudeKey) {
  const body = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages,
  })

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString())
          if (data.content?.[0]?.text) resolve(data.content[0].text)
          else reject(new Error('Unexpected Claude response'))
        } catch { reject(new Error('Claude parse error')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Claude timeout')) })
    req.write(body)
    req.end()
  })
}

router.post('/', async (req, res) => {
  const claudeKey = process.env.ANTHROPIC_API_KEY
  if (!claudeKey) return res.status(503).json({ error: 'AI chat not configured' })

  const { messages } = req.body
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' })
  }

  try {
    const reply = await callClaude(messages, claudeKey)
    res.json({ reply })
  } catch (err) {
    console.error('[chat] error:', err.message)
    res.status(502).json({ error: 'Chat unavailable' })
  }
})

module.exports = router
