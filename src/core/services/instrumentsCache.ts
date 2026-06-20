import { useSettingsStore } from '@/core/store'

export interface NFOInstrument {
  instrument_token: number
  tradingsymbol: string
  name: string
  expiry: string // YYYY-MM-DD
  strike: number
  lot_size: number
  instrument_type: 'CE' | 'PE'
}

let cache: NFOInstrument[] | null = null
let cacheDate = ''

export async function getNiftyOptions(): Promise<NFOInstrument[]> {
  const today = new Date().toISOString().slice(0, 10)
  if (cache && cacheDate === today) return cache

  const { apiKey, accessToken } = useSettingsStore.getState()
  // kite_path=instruments/NFO — slashes unencoded so the proxy receives the full path
  const res = await fetch('/api/kite?kite_path=instruments/NFO', {
    headers: { 'X-Kite-Auth': `token ${apiKey}:${accessToken}`, 'X-Kite-Version': '3' },
  })
  if (!res.ok) throw new Error('Failed to fetch instruments')

  const text = await res.text()
  const lines = text.trim().split('\n')
  const h = lines[0].split(',')

  const col = (name: string) => h.indexOf(name)
  const ti = col('instrument_token'), si = col('tradingsymbol'), ni = col('name')
  const ei = col('expiry'), ki = col('strike'), li = col('lot_size'), ii = col('instrument_type')

  cache = lines.slice(1)
    .map(line => {
      const c = line.split(',')
      return {
        instrument_token: parseInt(c[ti]),
        tradingsymbol: c[si],
        name: c[ni],
        expiry: c[ei],
        strike: parseFloat(c[ki]),
        lot_size: parseInt(c[li]),
        instrument_type: c[ii] as 'CE' | 'PE',
      }
    })
    .filter(i => i.name === 'NIFTY' && (i.instrument_type === 'CE' || i.instrument_type === 'PE'))

  cacheDate = today
  return cache
}

export async function getNearestExpiry(): Promise<string> {
  const instruments = await getNiftyOptions()
  const today = new Date().toISOString().slice(0, 10)
  const expiries = [...new Set(instruments.map(i => i.expiry))]
    .filter(e => e >= today)
    .sort()
  return expiries[0] ?? today
}

export async function getStrikesAroundATM(spot: number, expiry: string, range = 5): Promise<NFOInstrument[]> {
  const instruments = await getNiftyOptions()
  const atm = Math.round(spot / 50) * 50
  const strikes = Array.from({ length: range * 2 + 1 }, (_, i) => atm + (i - range) * 50)
  return instruments.filter(i => i.expiry === expiry && strikes.includes(i.strike))
}
