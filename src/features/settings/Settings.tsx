import { useSettingsStore } from '@/core/store'
import { X } from 'lucide-react'

interface Props { onClose: () => void }

export function Settings({ onClose }: Props) {
  const s = useSettingsStore()

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-lg w-[480px] max-h-[80vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e293b]">
          <h2 className="text-[#38bdf8] font-semibold text-sm">Settings</h2>
          <button onClick={onClose} className="text-[#475569] hover:text-white"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Risk Settings */}
          <section>
            <h3 className="text-[#64748b] text-[10px] uppercase tracking-widest mb-3">Risk Management</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Capital (₹)', value: s.capital, set: s.setCapital, step: 10000 },
                { label: 'Risk Per Trade (%)', value: s.riskPerTrade, set: s.setRiskPerTrade, step: 0.5 },
                { label: 'Max Daily Loss (₹)', value: s.maxDailyLoss, set: s.setMaxDailyLoss, step: 500 },
                { label: 'Max Trades / Day', value: s.maxTradesPerDay, set: s.setMaxTradesPerDay, step: 1 },
                { label: 'Max Consecutive Losses', value: s.maxConsecutiveLosses, set: s.setMaxConsecutiveLosses, step: 1 },
                { label: 'Min Trade Score', value: s.minTradeScore, set: s.setMinTradeScore, step: 5 },
              ].map(({ label, value, set, step }) => (
                <div key={label}>
                  <label className="text-[#64748b] text-[10px] block mb-1">{label}</label>
                  <input type="number" value={value} step={step}
                    onChange={e => set(Number(e.target.value))}
                    className="w-full bg-[#060d1a] border border-[#1e3a5f] rounded px-2 py-1.5 text-white text-xs" />
                </div>
              ))}
            </div>
          </section>

          {/* Zerodha */}
          <section>
            <h3 className="text-[#64748b] text-[10px] uppercase tracking-widest mb-3">Zerodha Kite Connect</h3>
            <div className="space-y-2">
              {[
                { label: 'API Key', value: s.apiKey, set: s.setApiKey, type: 'text' },
                { label: 'API Secret', value: s.apiSecret, set: s.setApiSecret, type: 'password' },
                { label: 'Access Token', value: s.accessToken, set: s.setAccessToken, type: 'password' },
              ].map(({ label, value, set, type }) => (
                <div key={label}>
                  <label className="text-[#64748b] text-[10px] block mb-1">{label}</label>
                  <input type={type} value={value} onChange={e => set(e.target.value)}
                    className="w-full bg-[#060d1a] border border-[#1e3a5f] rounded px-3 py-1.5 text-white text-xs font-mono"
                    placeholder={`Enter ${label}`} />
                </div>
              ))}
            </div>
            <p className="text-[#475569] text-[9px] mt-2">Credentials saved in browser localStorage. Never shared externally.</p>
          </section>

          {/* Gmail Alerts */}
          <section>
            <h3 className="text-[#64748b] text-[10px] uppercase tracking-widest mb-3">Email Alerts (Gmail)</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[#94a3b8] text-[10px]">Enable Email Alerts</label>
                <button
                  onClick={() => s.setEnableEmailAlerts(!s.enableEmailAlerts)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${s.enableEmailAlerts ? 'bg-[#22c55e]' : 'bg-[#334155]'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow ${s.enableEmailAlerts ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>

              {s.enableEmailAlerts && (
                <>
                  <div>
                    <label className="text-[#64748b] text-[10px] block mb-1">Gmail Address</label>
                    <input type="email" value={s.notificationEmail} onChange={e => s.setNotificationEmail(e.target.value)}
                      className="w-full bg-[#060d1a] border border-[#1e3a5f] rounded px-3 py-1.5 text-white text-xs"
                      placeholder="your@gmail.com" />
                  </div>
                  <div>
                    <label className="text-[#64748b] text-[10px] block mb-1">Gmail App Password</label>
                    <input type="password" value={s.gmailAppPassword} onChange={e => s.setGmailAppPassword(e.target.value)}
                      className="w-full bg-[#060d1a] border border-[#1e3a5f] rounded px-3 py-1.5 text-white text-xs font-mono"
                      placeholder="16-char app password from Google Account" />
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { label: 'Alert on Buy Opportunity (score > 700)', val: s.emailAlertOnOpportunity, set: s.setEmailAlertOnOpportunity },
                      { label: 'Alert on SL Warning (position -10%)', val: s.emailAlertOnSLHit, set: s.setEmailAlertOnSLHit },
                      { label: 'Alert on Profit > 20%', val: s.emailAlertOnProfit, set: s.setEmailAlertOnProfit },
                    ].map(({ label, val, set }) => (
                      <label key={label} className="flex items-center gap-2 text-[10px] text-[#94a3b8] cursor-pointer">
                        <input type="checkbox" checked={val} onChange={e => set(e.target.checked)}
                          className="rounded border-[#334155]" />
                        {label}
                      </label>
                    ))}
                  </div>
                  <div className="bg-[#060d1a] border border-[#1e293b] rounded p-2 text-[9px] text-[#475569]">
                    <strong className="text-[#64748b]">Setup:</strong> Go to Google Account → Security → 2-Step Verification → App Passwords. Generate a 16-char password for "Mail". Stored in browser only — never sent externally.
                  </div>
                </>
              )}
            </div>
          </section>

          <div className="pt-2">
            <button onClick={onClose} className="w-full bg-[#22c55e] text-black font-bold py-2 rounded text-sm hover:bg-[#16a34a] transition-colors">
              Save & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
