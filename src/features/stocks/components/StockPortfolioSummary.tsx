import { EventsCalendar } from './EventsCalendar'
import { TradeLogPanel } from './TradeLog'

export function StockPortfolioSummary({ tradeLogKey }: { tradeLogKey: number }) {
  return (
    <div className="flex flex-col gap-0">
      <EventsCalendar />
      <div className="border-t border-[#1e293b]">
        <TradeLogPanel refreshKey={tradeLogKey} />
      </div>
    </div>
  )
}
