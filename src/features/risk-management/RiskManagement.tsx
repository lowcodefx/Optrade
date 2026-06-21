import { useOrderStore, useSettingsStore } from '@/core/store'
import { useMarketStore } from '@/core/store'
import { useRiskCalc } from '@/core/hooks/useRiskCalc'
import { InfoTooltip } from '@/components/InfoTooltip'
import { formatCurrency } from '@/lib/utils'
import { useLiveModeStore } from '@/core/services/tradingService'

const tooltip = {
  title: 'Risk Management',
  what: 'Calculates position size and risk metrics based on your available capital.',
  why: 'Prevents over-trading and ensures no single trade can blow your account.',
  how: 'Set Capital + Risk% in Settings. Suggested Qty = Risk Amount ÷ SL Distance ÷ Lot Size.',
  bullish: 'Higher conviction setups (score >75) can use suggested qty. Lower scores → reduce qty.',
  bearish: 'If daily loss approaches max limit, reduce qty or stop trading for the day.',
}

function Row({ label, value, valueColor, sub }: { label: string; value: string; valueColor?: string; sub?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[#64748b] text-[10px]">{label}</span>
      <div className="text-right">
        <span className={`text-[10px] font-semibold ${valueColor ?? 'text-white'}`}>{value}</span>
        {sub && <span className="text-[9px] text-[#475569] ml-1">{sub}</span>}
      </div>
    </div>
  )
}

export function RiskManagement() {
  const { capital, riskPerTrade, maxDailyLoss } = useSettingsStore()
  const { stopLoss, showSL } = useOrderStore()
  const chain = useMarketStore(s => s.optionChain)
  const { strike, optionType } = useOrderStore()
  const availableMargin = useMarketStore(s => s.availableMargin)
  const usedMargin = useMarketStore(s => s.usedMargin)
  const isLive = useLiveModeStore(s => s.isLive)
  const strikeData = chain?.strikes.find(s => s.strike === strike)
  const premium = strikeData ? strikeData[optionType === 'CE' ? 'ce' : 'pe'].ltp : 0
  const risk = useRiskCalc(premium, showSL ? stopLoss : undefined)

  const effectiveCapital = isLive && availableMargin > 0 ? availableMargin : capital

  return (
    <div>
      <div className="flex items-center gap-1 px-3 pt-2.5 pb-2 border-b border-[#1e293b]">
        <span className="text-[9px] text-[#64748b] uppercase tracking-widest font-medium">Risk Management</span>
        <InfoTooltip content={tooltip} />
      </div>

      <div className="px-3 pb-3 space-y-1.5 pt-1">

        {/* Live balance section */}
        {isLive && availableMargin > 0 ? (
          <div className="bg-[#0d2b0d] border border-[#22c55e]/30 rounded px-2 py-2 space-y-1 mb-2">
            <div className="text-[9px] text-[#22c55e] font-bold uppercase tracking-widest mb-1">Zerodha Balance</div>
            <Row label="Available" value={formatCurrency(availableMargin)} valueColor="text-[#22c55e]" />
            {usedMargin > 0 && <Row label="Used Margin" value={formatCurrency(usedMargin)} valueColor="text-[#f59e0b]" />}
          </div>
        ) : (
          <Row label="Capital (Settings)" value={formatCurrency(capital)} />
        )}

        <Row
          label="Risk Per Trade"
          value={`${riskPerTrade}% → ${formatCurrency(Math.round(effectiveCapital * riskPerTrade / 100))}`}
          valueColor="text-[#f59e0b]"
        />

        <div className="h-px bg-[#1e293b] my-2" />

        <Row label="Suggested Qty" value={`${risk.suggestedLots} Lot (${risk.suggestedQty})`} valueColor="text-[#22c55e]" />
        <Row label="Max Loss" value={formatCurrency(risk.maxLoss)} valueColor="text-[#ef4444]" />
        <Row label={`Target (${risk.rr}:1 RR)`} value={formatCurrency(risk.potentialProfit)} valueColor="text-[#22c55e]" />

        <div className="bg-[#132036] rounded px-2 py-1.5 mt-1">
          <Row label="Max Daily Loss" value={formatCurrency(maxDailyLoss)} valueColor="text-[#ef4444]" />
        </div>
      </div>
    </div>
  )
}
