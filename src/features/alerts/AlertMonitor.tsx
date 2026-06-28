import { useEffect, useRef } from 'react'
import { useMarketStore } from '@/core/store'
import { useAlertStore } from '@/core/store/alertStore'
import { useSettingsStore } from '@/core/store'
import { useLiveModeStore } from '@/core/services/tradingService'
import { usePositions } from '@/core/hooks/useMarketData'
import type { EntryQualityResult } from '@/core/utils/entryQuality'
import type { TradeStrengthResult } from '@/core/types'

// Credentials live in Azure App Settings (server-side) — never sent from the browser.
// Only subject + body are sent. The function reads GMAIL_USER / GMAIL_APP_PASS / NOTIFICATION_EMAIL
// from process.env so this endpoint cannot be abused as an open relay.
async function sendEmailAlert(subject: string, body: string) {
  try {
    await fetch('/api/email-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body }),
    })
  } catch {
    // non-critical — don't throw
  }
}

function fireNotification(title: string, body: string) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.svg' })
  }
}

export function AlertMonitor() {
  const quote         = useMarketStore(s => s.quote)
  const ceScore       = useMarketStore(s => s.ceScore)
  const peScore       = useMarketStore(s => s.peScore)
  const prediction1h  = useMarketStore(s => s.prediction1h)
  const noTradeReason = useMarketStore(s => s.noTradeReason)
  const tradeStrength = useMarketStore(s => s.tradeStrength) as TradeStrengthResult | null
  const entryQuality  = useMarketStore(s => s.entryQuality) as EntryQualityResult | null
  const { rules, markTriggered, notificationsEnabled, setNotificationsEnabled } = useAlertStore()
  const settings = useSettingsStore()
  const isLive = useLiveModeStore(s => s.isLive)
  const { data: positions = [] } = usePositions()

  // Request notification permission once
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') setNotificationsEnabled(true)
      })
    } else if (Notification.permission === 'granted' && !notificationsEnabled) {
      setNotificationsEnabled(true)
    }
  }, [notificationsEnabled, setNotificationsEnabled])

  // Track what we've already emailed this session to avoid flooding
  const emailedRef = useRef(new Set<string>())

  // Check user-defined alert rules
  useEffect(() => {
    if (!quote) return
    rules.forEach(rule => {
      if (!rule.active || rule.triggered) return
      let shouldFire = false
      let title = '', body = ''

      if (rule.type === 'price-above' && quote.spot > rule.value) {
        shouldFire = true
        title = `NIFTY above ${rule.value}`
        body = `NIFTY is at ${quote.spot.toFixed(0)} — above your alert level of ${rule.value}`
      } else if (rule.type === 'price-below' && quote.spot < rule.value) {
        shouldFire = true
        title = `NIFTY below ${rule.value}`
        body = `NIFTY is at ${quote.spot.toFixed(0)} — below your alert level of ${rule.value}`
      } else if (rule.type === 'ce-score' && ceScore > rule.value) {
        shouldFire = true
        title = `CE Score: ${ceScore}/1000`
        body = `Strong bullish signal! CE score hit ${ceScore}. Prediction: ${prediction1h}`
      } else if (rule.type === 'pe-score' && peScore > rule.value) {
        shouldFire = true
        title = `PE Score: ${peScore}/1000`
        body = `Strong bearish signal! PE score hit ${peScore}. Prediction: ${prediction1h}`
      }

      if (shouldFire) {
        markTriggered(rule.id)
        fireNotification(`[Optrade] ${title}`, body)
      }
    })
  }, [quote, ceScore, peScore, prediction1h, rules, markTriggered])

  // Auto-alert when CE/PE score crosses 700 (opportunity alert)
  const prevCeRef = useRef(0)
  const prevPeRef = useRef(0)
  useEffect(() => {
    if (!quote) return
    const emailEnabled = settings.enableEmailAlerts

    const strengthLabel = tradeStrength ? `${tradeStrength.score}/100 (${tradeStrength.label})` : 'N/A'
    const eqLabel       = entryQuality  ? `${entryQuality.score}/100 (${entryQuality.label})`   : 'N/A'
    const noTradeNote   = noTradeReason ? `\n⚠ NO TRADE condition active: ${noTradeReason}\n` : ''

    if (ceScore > 700 && prevCeRef.current <= 700) {
      const key = `ce-opp-${new Date().toISOString().slice(0, 13)}`
      fireNotification('[Optrade] CE Buy Opportunity', `CE Score: ${ceScore}/1000 | Strength: ${tradeStrength?.score ?? 0}/100 | NIFTY: ${quote.spot.toFixed(0)}`)
      if (emailEnabled && settings.emailAlertOnOpportunity && !emailedRef.current.has(key)) {
        emailedRef.current.add(key)
        sendEmailAlert(
          `[Optrade] Strong CE Buy Signal – Market ${ceScore}/1000`,
          `A strong CE buy opportunity has been detected:\n${noTradeNote}\n── Scores ──────────────────\nMarket Score:   ${ceScore}/1000\nTrade Strength: ${strengthLabel}\nEntry Quality:  ${eqLabel}\n────────────────────────────\n\nNIFTY Spot:    ${quote.spot.toFixed(0)}\nVIX:           ${quote.vix.toFixed(2)}\nPCR:           ${quote.pcr.toFixed(2)}\nPrediction:    ${prediction1h}\n\nOpen the Optrade dashboard, verify Entry Quality ≥ 60 and Risk Score ≥ 60 before placing the trade.\n\n---\nOptrade | Intraday Trading Assistant`,
        )
      }
    }

    if (peScore > 700 && prevPeRef.current <= 700) {
      const key = `pe-opp-${new Date().toISOString().slice(0, 13)}`
      fireNotification('[Optrade] PE Buy Opportunity', `PE Score: ${peScore}/1000 | Strength: ${tradeStrength?.score ?? 0}/100 | NIFTY: ${quote.spot.toFixed(0)}`)
      if (emailEnabled && settings.emailAlertOnOpportunity && !emailedRef.current.has(key)) {
        emailedRef.current.add(key)
        sendEmailAlert(
          `[Optrade] Strong PE Buy Signal – Market ${peScore}/1000`,
          `A strong PE buy opportunity has been detected:\n${noTradeNote}\n── Scores ──────────────────\nMarket Score:   ${peScore}/1000\nTrade Strength: ${strengthLabel}\nEntry Quality:  ${eqLabel}\n────────────────────────────\n\nNIFTY Spot:    ${quote.spot.toFixed(0)}\nVIX:           ${quote.vix.toFixed(2)}\nPCR:           ${quote.pcr.toFixed(2)}\nPrediction:    ${prediction1h}\n\nOpen the Optrade dashboard, verify Entry Quality ≥ 60 and Risk Score ≥ 60 before placing the trade.\n\n---\nOptrade | Intraday Trading Assistant`,
        )
      }
    }

    prevCeRef.current = ceScore
    prevPeRef.current = peScore
  }, [ceScore, peScore, quote, prediction1h, noTradeReason, tradeStrength, entryQuality, settings])

  // Monitor positions for profit > 20% and SL proximity
  const prevPositionIds = useRef(new Set<string>())
  useEffect(() => {
    if (!isLive || !settings.enableEmailAlerts) return

    positions.forEach(pos => {
      const key20 = `profit-20-${pos.positionId}-${new Date().toISOString().slice(0, 10)}`
      const keySL = `sl-hit-${pos.positionId}-${new Date().toISOString().slice(0, 10)}`

      // Profit > 20%
      if (pos.pnlPct > 20 && settings.emailAlertOnProfit && !emailedRef.current.has(key20)) {
        emailedRef.current.add(key20)
        fireNotification(`[Optrade] Profit Alert: ${pos.pnlPct.toFixed(1)}%`, `NIFTY ${pos.strike} ${pos.optionType} is up ${pos.pnlPct.toFixed(1)}% (Rs.${pos.pnl.toFixed(0)})`)
        sendEmailAlert(
          `[Optrade] Position up ${pos.pnlPct.toFixed(1)}% – Consider booking`,
          `Your open position is profitable:\n\nSymbol: NIFTY ${pos.strike} ${pos.optionType}\nEntry: Rs.${pos.entryPrice.toFixed(2)}\nLTP: Rs.${pos.ltp.toFixed(2)}\nP&L: +Rs.${pos.pnl.toFixed(0)} (+${pos.pnlPct.toFixed(1)}%)\n\nConsider booking partial or full profits to lock in gains.\n\n---\nOptrade | Intraday Trading Assistant`,
        )
      }

      // SL warning (position down 10% = approaching typical -20pt SL)
      if (pos.pnlPct <= -10 && settings.emailAlertOnSLHit && !emailedRef.current.has(keySL)) {
        emailedRef.current.add(keySL)
        fireNotification(`[Optrade] SL Warning: ${pos.pnlPct.toFixed(1)}%`, `NIFTY ${pos.strike} ${pos.optionType} approaching stop loss`)
        sendEmailAlert(
          `[Optrade] Stop Loss Warning – NIFTY ${pos.strike} ${pos.optionType}`,
          `Your position is approaching your stop loss:\n\nSymbol: NIFTY ${pos.strike} ${pos.optionType}\nEntry: Rs.${pos.entryPrice.toFixed(2)}\nLTP: Rs.${pos.ltp.toFixed(2)}\nP&L: Rs.${pos.pnl.toFixed(0)} (${pos.pnlPct.toFixed(1)}%)\n\nReview your position immediately.\n\n---\nOptrade | Intraday Trading Assistant`,
        )
      }
    })

    prevPositionIds.current = new Set(positions.map(p => p.positionId))
  }, [positions, isLive, settings])

  return null
}
