const { Router } = require('express')
const { sql, poolPromise } = require('../db')

const router = Router()

// GET /api/holdings/buy-dates  →  { SYMBOL: "YYYY-MM-DD", ... }
router.get('/buy-dates', async (req, res) => {
  const userId = req.headers['x-user-id']
  if (!userId) return res.status(400).json({ error: 'X-User-Id header required' })
  try {
    const pool = await poolPromise
    if (!pool) return res.status(503).json({ error: 'DB unavailable' })
    const result = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query('SELECT symbol, buy_date FROM optrade.holdings WHERE user_id = @userId')
    const map = {}
    for (const row of result.recordset) {
      map[row.symbol] = row.buy_date.toISOString().slice(0, 10)
    }
    res.json(map)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/holdings/buy-date  body: { symbol, buyDate }
router.post('/buy-date', async (req, res) => {
  const userId = req.headers['x-user-id']
  if (!userId) return res.status(400).json({ error: 'X-User-Id header required' })
  const { symbol, buyDate } = req.body
  if (!symbol || !buyDate) return res.status(400).json({ error: 'symbol and buyDate required' })
  try {
    const pool = await poolPromise
    if (!pool) return res.status(503).json({ error: 'DB unavailable' })
    await pool.request()
      .input('userId', sql.NVarChar, userId)
      .input('symbol', sql.NVarChar, symbol)
      .input('buyDate', sql.Date, new Date(buyDate))
      .query(`
        MERGE optrade.holdings AS target
        USING (SELECT @userId AS user_id, @symbol AS symbol) AS src
          ON target.user_id = src.user_id AND target.symbol = src.symbol
        WHEN MATCHED THEN
          UPDATE SET buy_date = @buyDate, updated_at = GETUTCDATE()
        WHEN NOT MATCHED THEN
          INSERT (user_id, symbol, buy_date) VALUES (@userId, @symbol, @buyDate);
      `)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/holdings/buy-date/:symbol
router.delete('/buy-date/:symbol', async (req, res) => {
  const userId = req.headers['x-user-id']
  if (!userId) return res.status(400).json({ error: 'X-User-Id header required' })
  const { symbol } = req.params
  try {
    const pool = await poolPromise
    if (!pool) return res.status(503).json({ error: 'DB unavailable' })
    await pool.request()
      .input('userId', sql.NVarChar, userId)
      .input('symbol', sql.NVarChar, symbol)
      .query('DELETE FROM optrade.holdings WHERE user_id = @userId AND symbol = @symbol')
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
