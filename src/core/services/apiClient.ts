// src/core/services/apiClient.ts
import { useSettingsStore } from '@/core/store'

// Empty string = same origin (SWA) — set VITE_API_BASE to VM URL in production
export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''

function backendKey(): string {
  return (import.meta.env.VITE_BACKEND_KEY as string | undefined) ?? ''
}

// Adds X-Backend-Key to any headers object — no-op when key is not configured
export function vmHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra }
  const key = backendKey()
  if (key) headers['X-Backend-Key'] = key
  return headers
}

// Returns all headers needed for a Kite API call through the VM proxy
export function kiteAuthHeaders(): Record<string, string> {
  const { apiKey, accessToken } = useSettingsStore.getState()
  return vmHeaders({
    'X-Kite-Auth': `token ${apiKey}:${accessToken}`,
    'X-Kite-Version': '3',
  })
}
