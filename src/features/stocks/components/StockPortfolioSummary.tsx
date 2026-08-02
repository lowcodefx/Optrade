import { EventsCalendar } from './EventsCalendar'
import { TradeLogPanel } from './TradeLog'

export function StockPortfolioSummary() {
  return (
    <div className="flex flex-col gap-0">
      <EventsCalendar />
      <div className="border-t border-[#1e293b]">
        <TradeLogPanel />
      </div>
    </div>
  )
}
