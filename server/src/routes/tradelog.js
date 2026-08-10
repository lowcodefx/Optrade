const { Router } = require('express')
const { sql, poolPromise } = require('../db')

const router = Router()

// GET /api/tradelog  →  [{ id, symbol, action, price, signal, note, trade_date, created_at }]
router.get('/', async (req, res) => {
  const userId = req.headers['x-user-id']
  if (!userId) return res.status(400).json({ error: 'X-User-Id header required' })
  try {
    const pool = await poolPromise
    if (!pool) return res.status(503).json({ error: 'DB unavailable' })
    const result = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query(`
        SELECT id, symbol, action, price, signal, note, trade_date, created_at
        FROM optrade.trade_log
        WHERE user_id = @userId
        ORDER BY created_at DESC
      `)
    res.json(result.recordset)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/tradelog  body: { symbol, action, price, signal, note }
router.post('/', async (req, res) => {
  const userId = req.headers['x-user-id']
  if (!userId) return res.status(400).json({ error: 'X-User-Id header required' })
  const { symbol, action, price, signal, note } = req.body
  if (!symbol || !action || price == null) return res.status(400).json({ error: 'symbol, action, price required' })
  try {
    const pool = await poolPromise
    if (!pool) return res.status(503).json({ error: 'DB unavailable' })
    const result = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .input('symbol', sql.NVarChar, symbol)
      .input('action', sql.NVarChar, action)
      .input('price', sql.Decimal(10, 2), price)
      .input('signal', sql.NVarChar, signal ?? '')
      .input('note', sql.NVarChar, note ?? '')
      .input('tradeDate', sql.Date, new Date())
      .query(`
        INSERT INTO optrade.trade_log (user_id, symbol, action, price, signal, note, trade_date)
        OUTPUT INSERTED.id, INSERTED.created_at
        VALUES (@userId, @symbol, @action, @price, @signal, @note, @tradeDate)
      `)
    const row = result.recordset[0]
    res.json({ id: row.id, created_at: row.created_at })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/tradelog/:id
router.delete('/:id', async (req, res) => {
  const userId = req.headers['x-user-id']
  if (!userId) return res.status(400).json({ error: 'X-User-Id header required' })
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) return res.status(400).json({ error: 'invalid id' })
  try {
    const pool = await poolPromise
    if (!pool) return res.status(503).json({ error: 'DB unavailable' })
    await pool.request()
      .input('userId', sql.NVarChar, userId)
      .input('id', sql.Int, id)
      .query('DELETE FROM optrade.trade_log WHERE user_id = @userId AND id = @id')
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
