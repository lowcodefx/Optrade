import { useSettingsStore } from '@/core/store'

const KITE_LOGIN = 'https://kite.zerodha.com/connect/login'

export function getLoginURL(): string {
  const { apiKey } = useSettingsStore.getState()
  return `${KITE_LOGIN}?api_key=${apiKey}&v=3`
}

export async function exchangeRequestToken(requestToken: string): Promise<string> {
  const { apiKey, apiSecret } = useSettingsStore.getState()

  // Token exchange goes through our Azure Function proxy to avoid CORS
  const res = await fetch('/api/exchange-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, apiSecret, requestToken }),
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
