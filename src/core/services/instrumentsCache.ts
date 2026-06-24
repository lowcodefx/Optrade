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

const LS_KEY = 'optrade_nfo_v1'

function loadFromStorage(today: string): NFOInstrument[] | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { date: string; data: NFOInstrument[] }
    return parsed.date === today ? parsed.data : null
  } catch {
    return null
  }
}

function saveToStorage(today: string, data: NFOInstrument[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ date: today, data }))
  } catch {
    // localStorage quota exceeded — memory cache still works for this session
  }
}

export async function getNiftyOptions(): Promise<NFOInstrument[]> {
  const today = new Date().toISOString().slice(0, 10)
  if (cache && cacheDate === today) return cache

  // Fast path: instruments cached in localStorage from a previous load today
  const stored = loadFromStorage(today)
  if (stored && stored.length > 0) {
    cache = stored
    cacheDate = today
    return cache
  }

  const { apiKey, accessToken } = useSettingsStore.getState()
  // Dedicated endpoint: parses NFO CSV server-side, returns only NIFTY CE/PE as JSON.
  // Much faster than streaming 5 MB of raw CSV through the proxy.
  const res = await fetch('/api/nifty-instruments', {
    headers: { 'X-Kite-Auth': `token ${apiKey}:${accessToken}` },
  })
  if (!res.ok) throw new Error(`Failed to fetch instruments: ${res.status}`)

  const json = await res.json() as { instruments: NFOInstrument[] }
  cache = json.instruments ?? []

  if (cache.length > 0) {
    cacheDate = today
    saveToStorage(today, cache)
  }

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
