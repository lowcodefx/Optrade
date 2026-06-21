import { useState } from 'react'
import { useAlertStore, type AlertType } from '@/core/store/alertStore'
import { useMarketStore } from '@/core/store'
import { Bell, BellOff, Plus, Trash2, RotateCcw } from 'lucide-react'
import { SectionCard } from '@/components/SectionCard'

const TYPE_LABELS: Record<AlertType, string> = {
  'price-above': 'NIFTY ▲ above',
  'price-below': 'NIFTY ▼ below',
  'ce-score': 'CE score ▲ above',
  'pe-score': 'PE score ▲ above',
}

export function AlertsPanel() {
  const { rules, addRule, removeRule, resetTriggers, notificationsEnabled } = useAlertStore()
  const quote = useMarketStore(s => s.quote)
  const [type, setType] = useState<AlertType>('price-above')
  const [value, setValue] = useState('')

  function handleAdd() {
    const v = parseFloat(value)
    if (isNaN(v)) return
    addRule({
      type,
      value: v,
      label: `${TYPE_LABELS[type]} ${v}`,
      active: true,
    })
    setValue('')
  }

  const defaultValue = type === 'price-above' ? String(Math.round((quote?.spot ?? 24500) + 100))
    : type === 'price-below' ? String(Math.round((quote?.spot ?? 24500) - 100))
    : '700'

  return (
    <SectionCard title="Alerts" collapsible defaultOpen={false}>
      {/* Permission status */}
      <div className={`flex items-center gap-1.5 text-[9px] mb-3 ${notificationsEnabled ? 'text-[#22c55e]' : 'text-[#f59e0b]'}`}>
        {notificationsEnabled ? <Bell size={10} /> : <BellOff size={10} />}
        {notificationsEnabled ? 'Browser notifications enabled' : 'Enable browser notifications to receive alerts'}
      </div>

      {/* Add rule form */}
      <div className="flex gap-1.5 mb-3">
        <select
          value={type}
          onChange={e => { setType(e.target.value as AlertType); setValue('') }}
          className="bg-[#060d1a] border border-[#1e3a5f] text-white text-[9px] rounded px-1.5 py-1 flex-1"
        >
          {(Object.entries(TYPE_LABELS) as [AlertType, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <input
          type="number"
          value={value || defaultValue}
          onChange={e => setValue(e.target.value)}
          className="w-20 bg-[#060d1a] border border-[#1e3a5f] text-white text-[9px] rounded px-2 py-1"
        />
        <button
          onClick={handleAdd}
          className="bg-[#1e3a5f] hover:bg-[#2a4a6f] text-[#38bdf8] rounded px-2 py-1 transition-colors"
        >
          <Plus size={11} />
        </button>
      </div>

      {/* Rules list */}
      {rules.length === 0 ? (
        <div className="text-[#475569] text-[9px] text-center py-2">No alerts set. Add one above.</div>
      ) : (
        <div className="space-y-1.5">
          {rules.map(rule => (
            <div
              key={rule.id}
              className={`flex items-center justify-between gap-2 rounded px-2 py-1.5 text-[9px] border ${
                rule.triggered
                  ? 'bg-[#f59e0b]/10 border-[#f59e0b]/30'
                  : 'bg-[#060d1a] border-[#1e293b]'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${rule.triggered ? 'bg-[#f59e0b]' : 'bg-[#22c55e]'}`} />
                <span className="text-white truncate">{rule.label}</span>
                {rule.triggered && rule.triggeredAt && (
                  <span className="text-[#f59e0b] text-[8px] shrink-0">✓ {rule.triggeredAt}</span>
                )}
              </div>
              <button
                onClick={() => removeRule(rule.id)}
                className="text-[#475569] hover:text-[#ef4444] transition-colors shrink-0"
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))}
          {rules.some(r => r.triggered) && (
            <button
              onClick={resetTriggers}
              className="flex items-center gap-1 text-[9px] text-[#475569] hover:text-[#94a3b8] transition-colors"
            >
              <RotateCcw size={10} />
              Reset all triggers
            </button>
          )}
        </div>
      )}
    </SectionCard>
  )
}
