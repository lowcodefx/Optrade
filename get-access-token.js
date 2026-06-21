/**
 * Zerodha Daily Token Generator
 * Run once each morning before trading:
 *   node get-access-token.js <request_token>
 */

const crypto = require('crypto')
const https = require('https')

const API_KEY = '1oz51lwetp8arfpp'
const API_SECRET = 'PASTE_YOUR_API_SECRET_HERE' // From kite.trade/apps → Optrade → API Secret

const requestToken = process.argv[2]

if (!requestToken) {
  console.log('\n❌  Usage: node get-access-token.js <request_token>\n')
  console.log('Steps:')
  console.log('1. Open this URL in browser:')
  console.log(`   https://kite.zerodha.com/connect/login?api_key=${API_KEY}&v=3`)
  console.log('2. Log in with your Zerodha credentials')
  console.log('3. After redirect, copy the request_token from the URL:')
  console.log('   https://black-pond-09bbb5b00.7.azurestaticapps.net?request_token=COPY_THIS&status=success')
  console.log('4. Run: node get-access-token.js COPY_THIS\n')
  process.exit(1)
}

if (API_SECRET === 'PASTE_YOUR_API_SECRET_HERE') {
  console.log('\n❌  Open get-access-token.js and replace PASTE_YOUR_API_SECRET_HERE with your actual API Secret\n')
  process.exit(1)
}

const checksum = crypto
  .createHash('sha256')
  .update(API_KEY + requestToken + API_SECRET)
  .digest('hex')

const body = new URLSearchParams({
  api_key: API_KEY,
  request_token: requestToken,
  checksum,
}).toString()

const options = {
  hostname: 'api.kite.trade',
  path: '/session/token',
  method: 'POST',
  headers: {
    'X-Kite-Version': '3',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(body),
  },
}

console.log('\n⏳  Exchanging token with Zerodha...\n')

const req = https.request(options, res => {
  let data = ''
  res.on('data', chunk => { data += chunk })
  res.on('end', () => {
    try {
      const json = JSON.parse(data)
      if (json.data?.access_token) {
        console.log('✅  ACCESS TOKEN GENERATED:\n')
        console.log('━'.repeat(60))
        console.log(json.data.access_token)
        console.log('━'.repeat(60))
        console.log('\n📋  Next steps:')
        console.log('1. Open https://black-pond-09bbb5b00.7.azurestaticapps.net')
        console.log('2. Click ⚙ Settings → Zerodha section')
        console.log('3. Paste the token above into "Access Token" field')
        console.log('4. Click "Connect Zerodha" in the header → turns green ✅')
        console.log('\n⚠   Token expires at midnight tonight. Repeat tomorrow.\n')
      } else {
        console.log('❌  Zerodha returned an error:')
        console.log(json.message ?? data)
        console.log('\nTip: request_token is one-time use. If already used, run step 1 again.\n')
      }
    } catch {
      console.log('❌  Unexpected response:', data)
    }
  })
})

req.on('error', err => {
  console.log('❌  Network error:', err.message)
})

req.write(body)
req.end()
