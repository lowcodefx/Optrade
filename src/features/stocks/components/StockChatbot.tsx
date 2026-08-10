import { useState, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Send, Bot, User, Sparkles } from 'lucide-react'
import { SECTOR_STOCKS } from '../stockSectors'

// â”€â”€ Shared types (mirror TopStocksBucket, no import needed) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface StockScore {
  symbol: string
  totalScore: number
  signal: 'BUY' | 'WATCH' | 'AVOID'
  rs1d?: number | null
  last_price?: number | null
  pct_change?: number | null
}

interface AnalysisResult {
  largeCap: StockScore[]
  midCap: StockScore[]
  smallCap: StockScore[]
}

export type ScoredStock = StockScore & { cap: 'LG' | 'MD' | 'SM' }

// â”€â”€ Chat message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface Message {
  id: number
  role: 'user' | 'bot'
  text: string
  stocks?: ScoredStock[]
}

// â”€â”€ Data helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function allSorted(data: AnalysisResult): ScoredStock[] {
  return [
    ...data.largeCap.map(s => ({ ...s, cap: 'LG' as const })),
    ...data.midCap.map(s  => ({ ...s, cap: 'MD' as const })),
    ...data.smallCap.map(s => ({ ...s, cap: 'SM' as const })),
  ].sort((a, b) => b.totalScore - a.totalScore)
}

function filterStocks(prompt: string, data: AnalysisResult): { stocks: ScoredStock[]; reply: string } {
  const p = prompt.toLowerCase()
  let stocks = allSorted(data)
  const tags: string[] = []
  const unsupported: string[] = []

  // ── Price range: "between 100 to 500", "ranging between 100 to 150" ──────
  const rangeMatch = p.match(/(?:rang(?:e|ing)?\s+between|between|from)\s+(\d+(?:\.\d+)?)\s+(?:to|and)\s+(\d+(?:\.\d+)?)/i)
  if (rangeMatch) {
    const lo = parseFloat(rangeMatch[1]), hi = parseFloat(rangeMatch[2])
    if (!isNaN(lo) && !isNaN(hi) && hi > lo) {
      stocks = stocks.filter(s => s.last_price != null && s.last_price >= lo && s.last_price <= hi)
      tags.push(`price Rs.${lo}–Rs.${hi}`)
    }
  }

  // Under / below price
  const underMatch = !rangeMatch && p.match(/(?:under|below|less than)\s+(?:rs\.?|Rs.)?(\d+(?:\.\d+)?)/i)
  if (underMatch) {
    const lim = parseFloat(underMatch[1])
    if (!isNaN(lim)) { stocks = stocks.filter(s => (s.last_price ?? Infinity) < lim); tags.push(`price <Rs.${lim}`) }
  }

  // Above / over price
  const aboveMatch = !rangeMatch && p.match(/(?:above|over|more than)\s+(?:rs\.?|Rs.)?(\d+(?:\.\d+)?)/i)
  if (aboveMatch) {
    const lim = parseFloat(aboveMatch[1])
    if (!isNaN(lim)) { stocks = stocks.filter(s => (s.last_price ?? 0) > lim); tags.push(`price >Rs.${lim}`) }
  }

  // ── Unsupported technical criteria ────────────────────────────────────────
  if (/\b(?:ema|sma|dma)\s*\d+|\d+\s*(?:ema|sma|dma)/i.test(prompt)) unsupported.push('EMA/MA touch')
  if (/retest/i.test(p)) unsupported.push('retest pattern')
  if (/\b(?:1|daily|weekly|hourly|monthly)\s*(?:d|day|week|hour|tf|timeframe)/i.test(p)) unsupported.push('timeframe filter')
  if (/breakout|support|resistance|consolidat/i.test(p)) unsupported.push('price-action pattern')

  // If only unsupported criteria were given, explain and bail
  if (tags.length === 0 && unsupported.length > 0) {
    return {
      stocks: [],
      reply: `I can't filter by ${unsupported.join(' / ')}. I can filter by: price range (Rs.X to Rs.Y), sector, cap size, BUY/WATCH/AVOID signal, RS momentum, and AI score. Use the chart icon on any stock for technical analysis.`,
    }
  }

  // ── Sector ────────────────────────────────────────────────────────────────
  for (const [name, syms] of Object.entries(SECTOR_STOCKS)) {
    if (p.includes(name.toLowerCase())) {
      stocks = stocks.filter(s => syms.includes(s.symbol))
      tags.push(name)
      break
    }
  }

  // ── Signal ────────────────────────────────────────────────────────────────
  if (/\bbuy\b/.test(p)) { stocks = stocks.filter(s => s.signal === 'BUY'); tags.push('BUY signal') }
  else if (/\bwatch\b/.test(p)) { stocks = stocks.filter(s => s.signal === 'WATCH'); tags.push('WATCH') }
  else if (/\bavoid\b/.test(p)) { stocks = stocks.filter(s => s.signal === 'AVOID'); tags.push('AVOID') }

  // ── Cap size ──────────────────────────────────────────────────────────────
  if (/large.?cap|largecap/i.test(p)) { stocks = stocks.filter(s => s.cap === 'LG'); tags.push('large cap') }
  else if (/mid.?cap|midcap/i.test(p)) { stocks = stocks.filter(s => s.cap === 'MD'); tags.push('mid cap') }
  else if (/small.?cap|smallcap/i.test(p)) { stocks = stocks.filter(s => s.cap === 'SM'); tags.push('small cap') }

  // ── RS momentum ───────────────────────────────────────────────────────────
  if (/momentum|high rs|strong rs|outperform/i.test(p)) {
    stocks = stocks.filter(s => (s.rs1d ?? 0) >= 1.0)
    stocks = [...stocks].sort((a, b) => (b.rs1d ?? 0) - (a.rs1d ?? 0))
    tags.push('RS momentum')
  }

  // ── Score ─────────────────────────────────────────────────────────────────
  if (/high score|best score|top score|score/i.test(p)) {
    stocks = stocks.filter(s => s.totalScore >= 70); tags.push('score ≥70')
  }

  // ── Limit ─────────────────────────────────────────────────────────────────
  const numMatch = p.match(/top\s*(\d+)|best\s*(\d+)|show\s*(\d+)/i)
  const limit = numMatch ? parseInt(numMatch[1] ?? numMatch[2] ?? numMatch[3]) : 8
  stocks = stocks.slice(0, Math.min(limit, 10))

  // ── Reply ─────────────────────────────────────────────────────────────────
  let reply = tags.length
    ? `${stocks.length} stock${stocks.length !== 1 ? 's' : ''} matching: ${tags.join(', ')}`
    : `Top ${stocks.length} stocks by AI score`

  if (stocks.length === 0 && tags.length) reply = `No stocks matched: ${tags.join(', ')}. Try broadening your filters.`
  if (unsupported.length) reply += `. Note: ${unsupported.join(', ')} — use chart view for patterns.`

  return { stocks, reply }
}

// â”€â”€ Compact stock card (same info as StockRow, chatbot-friendly size) â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ChatStockCard({ s }: { s: ScoredStock }) {
  const sigCls = {
    BUY:   'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30',
    WATCH: 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30',
    AVOID: 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30',
  }[s.signal]
  const capCls   = s.cap === 'LG' ? 'text-[#38bdf8]' : s.cap === 'MD' ? 'text-[#a78bfa]' : 'text-[#f59e0b]'
  const scoreCls = s.totalScore >= 70 ? 'text-[#22c55e]' : s.totalScore >= 50 ? 'text-[#f59e0b]' : 'text-[#ef4444]'
  const pctPos   = (s.pct_change ?? 0) >= 0
  const rsPos    = (s.rs1d ?? 0) >= 0

  return (
    <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[#060d1a] border border-[#1e293b] hover:border-[#1e3a5f] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-white text-[10px] font-bold">{s.symbol}</span>
          <span className={`text-[7px] font-bold ${capCls}`}>{s.cap}</span>
          <span className={`text-[7px] font-bold px-1 py-0.5 rounded border ${sigCls}`}>{s.signal}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {s.last_price != null && (
            <span className="text-[9px] text-[#e2e8f0] font-semibold">Rs.{s.last_price.toLocaleString('en-IN')}</span>
          )}
          {s.pct_change != null && (
            <span className={`text-[8px] font-semibold ${pctPos ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {pctPos ? '+' : ''}{s.pct_change}%
            </span>
          )}
          {s.rs1d != null && (
            <span className={`text-[7px] font-bold ${rsPos ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              RS{rsPos ? '+' : ''}{s.rs1d.toFixed(1)}
            </span>
          )}
        </div>
      </div>
      <span className={`text-sm font-bold shrink-0 tabular-nums ${scoreCls}`}>{s.totalScore}</span>
    </div>
  )
}

// â”€â”€ Suggestion chips â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SUGGESTIONS = [
  'Show IT BUY signals',
  'Top 5 large cap stocks',
  'Banking high momentum',
  'Best pharma picks today',
  'Mid cap score â‰¥70',
  'Small cap strong RS',
]

// â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function StockChatbot({ onPicks }: { onPicks?: (stocks: ScoredStock[]) => void }) {
  const qc = useQueryClient()
  const [messages, setMessages] = useState<Message[]>([{
    id: 0,
    role: 'bot',
    text: "Hi! Ask me about stocks - sector, cap size, signal type, or momentum. I'll filter today's AI picks for you.",
  }])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg) return
    setInput('')

    const data = qc.getQueryData<AnalysisResult>(['stockAnalysis'])
    const userMsg: Message = { id: Date.now(), role: 'user', text: msg }

    if (!data) {
      setMessages(m => [...m, userMsg, {
        id: Date.now() + 1, role: 'bot',
        text: 'Stock data is still loading - give it a moment and try again.',
      }])
      return
    }

    const { stocks, reply } = filterStocks(msg, data)
    onPicks?.(stocks)
    setMessages(m => [...m, userMsg, { id: Date.now() + 1, role: 'bot', text: reply, stocks }])
  }

  const showSuggestions = messages.length <= 1

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-[#1e293b] shrink-0 bg-[#0a1628]">
        <Sparkles size={11} className="text-[#a78bfa]" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#94a3b8]">Stock Assistant</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`flex items-start gap-1.5 max-w-full ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${
                msg.role === 'bot' ? 'bg-[#a78bfa]/20' : 'bg-[#38bdf8]/20'
              }`}>
                {msg.role === 'bot'
                  ? <Bot size={9} className="text-[#a78bfa]" />
                  : <User size={9} className="text-[#38bdf8]" />}
              </div>
              <div className={`px-2.5 py-1.5 rounded-xl text-[9px] leading-relaxed max-w-[85%] ${
                msg.role === 'user'
                  ? 'bg-[#38bdf8]/10 text-[#e2e8f0] border border-[#38bdf8]/20 rounded-tr-none'
                  : 'bg-[#0a1628] text-[#94a3b8] border border-[#1e293b] rounded-tl-none'
              }`}>
                {msg.text}
              </div>
            </div>
            {/* Inline stock results */}
            {msg.stocks && msg.stocks.length > 0 && (
              <div className="w-full space-y-1 pl-6">
                {msg.stocks.map(s => <ChatStockCard key={s.symbol} s={s} />)}
              </div>
            )}
            {msg.stocks && msg.stocks.length === 0 && (
              <p className="text-[8px] text-[#64748b] pl-6">No stocks matched - try a different filter.</p>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Suggestion chips */}
      {showSuggestions && (
        <div className="px-2 pb-2 space-y-1 shrink-0">
          <p className="text-[8px] text-[#64748b] px-1 mb-1">Try asking</p>
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => send(s)}
              className="w-full text-left text-[8px] text-[#475569] hover:text-[#94a3b8] px-2 py-1 rounded hover:bg-[#0a1628] transition-colors border border-[#1e293b] truncate"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t border-[#1e293b] p-2">
        <div className="flex gap-1.5">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Ask about stocks..."
            className="flex-1 bg-[#060d1a] border border-[#1e3a5f] rounded-lg px-2.5 py-1.5 text-[10px] text-white placeholder:text-[#64748b] focus:outline-none focus:border-[#a78bfa]/50"
          />
          <button
            onClick={() => send()}
            className="bg-[#a78bfa]/20 hover:bg-[#a78bfa]/30 text-[#a78bfa] rounded-lg px-2.5 transition-colors"
          >
            <Send size={11} />
          </button>
        </div>
      </div>

    </div>
  )
}
