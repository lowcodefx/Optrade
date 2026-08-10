const sql = require('mssql')

const config = {
  server:   process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
}

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => { console.log('[db] Azure SQL connected'); return pool })
  .catch(err => { console.error('[db] Connection failed:', err.message); return null })

module.exports = { sql, poolPromise }
