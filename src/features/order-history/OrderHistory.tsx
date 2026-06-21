import { useMarketStore } from '@/core/store'
import { useLiveModeStore } from '@/core/services/tradingService'
import { RefreshCw } from 'lucide-react'
import { useOrders } from '@/core/hooks/useMarketData'

const STATUS_STYLE: Record<string, string> = {
  'COMPLETE': 'bg-[#0d2b0d] text-[#22c55e]',
  'CANCELLED': 'bg-[#1e293b] text-[#475569]',
  'REJECTED': 'bg-[#2b0d0d] text-[#ef4444]',
  'OPEN': 'bg-[#1e3a5f] text-[#38bdf8]',
  'TRIGGER PENDING': 'bg-[#1a1400] text-[#f59e0b]',
}

export function OrderHistory() {
  const orders = useMarketStore(s => s.orders)
  const isLive = useLiveModeStore(s => s.isLive)
  const { isFetching, refetch } = useOrders()

  if (!isLive) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <div className="text-3xl mb-3">📋</div>
        <div className="text-white font-semibold mb-1">Connect to Zerodha</div>
        <div className="text-[#64748b] text-xs">Order history is available when connected to your live account.</div>
      </div>
    )
  }

  return (
    <div className="p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-[10px] text-[#64748b] uppercase tracking-widest">Today's Orders</span>
          {orders.length > 0 && (
            <span className="ml-2 text-[9px] text-[#475569]">({orders.length})</span>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className={`text-[#475569] hover:text-[#38bdf8] transition-colors ${isFetching ? 'animate-spin' : ''}`}
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-10 text-[#475569] text-xs">No orders placed today</div>
      ) : (
        <div className="space-y-1.5">
          {orders.map(order => {
            const statusClass = STATUS_STYLE[order.status] ?? 'bg-[#1e293b] text-[#64748b]'
            const isBuy = order.transactionType === 'BUY'
            return (
              <div
                key={order.orderId}
                className="bg-[#060d1a] border border-[#1e293b] rounded p-2.5 text-[10px]"
              >
                {/* Symbol + status */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div>
                    <span className={`font-bold mr-1.5 ${isBuy ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      {order.transactionType}
                    </span>
                    <span className="text-white font-semibold">{order.tradingsymbol}</span>
                  </div>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded shrink-0 ${statusClass}`}>
                    {order.status}
                  </span>
                </div>

                {/* Details */}
                <div className="flex items-center gap-3 text-[9px] text-[#64748b] flex-wrap">
                  <span>Qty: <span className="text-white">{order.quantity}</span></span>
                  <span>Type: <span className="text-white">{order.orderType}</span></span>
                  {order.price > 0 && (
                    <span>Price: <span className="text-white">₹{order.price.toFixed(2)}</span></span>
                  )}
                  {order.averagePrice > 0 && order.status === 'COMPLETE' && (
                    <span>Avg: <span className="text-[#22c55e] font-semibold">₹{order.averagePrice.toFixed(2)}</span></span>
                  )}
                  <span className="ml-auto">{order.orderTimestamp.slice(11, 16)}</span>
                </div>

                {order.statusMessage && order.status === 'REJECTED' && (
                  <div className="mt-1 text-[#ef4444] text-[8px]">{order.statusMessage}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
