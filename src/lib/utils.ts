import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 100000) return `₹${(value / 100000).toFixed(2)}L`
  if (Math.abs(value) >= 1000) return `₹${(value / 1000).toFixed(1)}K`
  return `₹${value.toFixed(0)}`
}

export function formatNumber(value: number | undefined | null, decimals = 2): string {
  if (value == null || isNaN(value as number)) return '—'
  return value.toLocaleString('en-IN', { maximumFractionDigits: decimals })
}

export function formatOI(oi: number): string {
  if (oi >= 10000000) return `${(oi / 10000000).toFixed(1)}Cr`
  if (oi >= 100000) return `${(oi / 100000).toFixed(1)}L`
  if (oi >= 1000) return `${(oi / 1000).toFixed(0)}K`
  return oi.toString()
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function isMarketOpen(): boolean {
  const now = new Date()
  const day = now.getDay()
  if (day === 0 || day === 6) return false
  const hours = now.getHours()
  const minutes = now.getMinutes()
  const timeInMinutes = hours * 60 + minutes
  return timeInMinutes >= 555 && timeInMinutes <= 930 // 9:15 AM to 3:30 PM
}
