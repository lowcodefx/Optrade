import { useSettingsStore } from '@/core/store'

const KITE_LOGIN = 'https://kite.zerodha.com/connect/login'
const KITE_BASE = 'https://api.kite.trade'

export function getLoginURL(): string {
  const { apiKey } = useSettingsStore.getState()
  return `${KITE_LOGIN}?api_key=${apiKey}&v=3`
}

export async function exchangeRequestToken(requestToken: string): Promise<string> {
  const { apiKey, apiSecret } = useSettingsStore.getState()

  // Checksum = SHA256(api_key + request_token + api_secret)
  const raw = apiKey + requestToken + apiSecret
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const checksum = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  const res = await fetch(`${KITE_BASE}/session/token`, {
    method: 'POST',
    headers: {
      'X-Kite-Version': '3',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ api_key: apiKey, request_token: requestToken, checksum }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? 'Token exchange failed')
  }

  const json = await res.json()
  return json.data.access_token as string
}

export function isTokenValid(): boolean {
  const { accessToken } = useSettingsStore.getState()
  return !!accessToken && accessToken.length > 10
}
