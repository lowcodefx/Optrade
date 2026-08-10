const { Router } = require('express')
const { sql, poolPromise } = require('../db')

const router = Router()

// GET /api/watchlist  →  ["INFY", "TCS", ...]
router.get('/', async (req, res) => {
  const userId = req.userId
  try {
    const pool = await poolPromise
    if (!pool) return res.status(503).json({ error: 'DB unavailable' })
    const result = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query('SELECT symbol FROM optrade.watchlist WHERE user_id = @userId ORDER BY added_at ASC')
    res.json(result.recordset.map(r => r.symbol))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/watchlist  body: { symbol, price? }
router.post('/', async (req, res) => {
  const userId = req.userId
  const { symbol, price } = req.body
  if (!symbol) return res.status(400).json({ error: 'symbol required' })
  try {
    const pool = await poolPromise
    if (!pool) return res.status(503).json({ error: 'DB unavailable' })
    await pool.request()
      .input('userId', sql.NVarChar, userId)
      .input('symbol', sql.NVarChar, symbol)
      .input('price', sql.Decimal(10, 2), price ?? null)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM optrade.watchlist WHERE user_id = @userId AND symbol = @symbol)
          INSERT INTO optrade.watchlist (user_id, symbol, added_price) VALUES (@userId, @symbol, @price)
      `)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/watchlist/:symbol
router.delete('/:symbol', async (req, res) => {
  const userId = req.userId
  const { symbol } = req.params
  try {
    const pool = await poolPromise
    if (!pool) return res.status(503).json({ error: 'DB unavailable' })
    await pool.request()
      .input('userId', sql.NVarChar, userId)
      .input('symbol', sql.NVarChar, symbol)
      .query('DELETE FROM optrade.watchlist WHERE user_id = @userId AND symbol = @symbol')
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
