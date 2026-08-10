import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Bot, Trash2 } from 'lucide-react'
import { API_BASE, vmHeaders } from '@/core/services/apiClient'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

async function fetchReply(messages: Message[]): Promise<string> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: vmHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ messages }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Chat unavailable')
  }
  const json = await res.json() as { reply: string }
  return json.reply
}

const SUGGESTIONS = [
  'What is swing trading?',
  'Explain R:R ratio',
  'How to read RSI?',
  'What is OI buildup?',
]

export function GeneralChatbot() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text?: string) {
    const q = (text ?? input).trim()
    if (!q || loading) return
    setInput('')
    setError('')
    const next: Message[] = [...messages, { role: 'user', content: q }]
    setMessages(next)
    setLoading(true)
    try {
      const reply = await fetchReply(next)
      setMessages(m => [...m, { role: 'assistant', content: reply }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error — try again')
      setMessages(m => m.slice(0, -1)) // remove the unanswered user message
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#060d1a]">

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">

        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-4 pt-6 pb-2">
            <div className="w-10 h-10 rounded-full bg-[#38bdf8]/10 border border-[#38bdf8]/20 flex items-center justify-center">
              <Bot size={18} className="text-[#38bdf8]" />
            </div>
            <p className="text-[#475569] text-[11px] text-center max-w-[220px] leading-relaxed">
              Ask me anything about trading, markets, or analysis.
            </p>
            <div className="flex flex-col gap-1.5 w-full">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-[10px] text-[#64748b] hover:text-[#38bdf8] bg-[#0a1628] hover:bg-[#0f1f35] border border-[#1e293b] hover:border-[#1e3a5f] rounded-lg px-3 py-2 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] text-[11px] rounded-xl px-3 py-2 leading-relaxed whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-[#1e3a5f] text-[#e2e8f0] rounded-br-none'
                : 'bg-[#0a1628] text-[#94a3b8] rounded-bl-none border border-[#1e293b]'
            }`}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#0a1628] border border-[#1e293b] rounded-xl rounded-bl-none px-3 py-2.5">
              <Loader2 size={11} className="text-[#38bdf8] animate-spin" />
            </div>
          </div>
        )}

        {error && (
          <p className="text-[#ef4444] text-[10px] text-center">{error}</p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Clear button (only when there are messages) */}
      {messages.length > 0 && (
        <div className="shrink-0 px-3 pb-1 flex justify-end">
          <button
            onClick={() => setMessages([])}
            className="flex items-center gap-1 text-[9px] text-[#334155] hover:text-[#64748b] transition-colors"
          >
            <Trash2 size={9} />
            Clear
          </button>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t border-[#1e293b] p-3 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Ask anything…"
          disabled={loading}
          className="flex-1 bg-[#0a1628] border border-[#1e293b] rounded-lg px-3 py-2 text-[11px] text-white placeholder-[#334155] outline-none focus:border-[#38bdf8]/40 disabled:opacity-50 transition-colors"
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          className="bg-[#38bdf8]/10 hover:bg-[#38bdf8]/20 border border-[#38bdf8]/25 rounded-lg px-2.5 text-[#38bdf8] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={12} />
        </button>
      </div>

    </div>
  )
}
