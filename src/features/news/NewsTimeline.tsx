import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react'

// Keywords for sentiment detection
const POS_WORDS = ['surge', 'rally', 'gain', 'rise', 'bull', 'high', 'record', 'growth', 'positive', 'strong', 'buy', 'up', 'boost', 'profit', 'recover', 'advance', 'jump', 'soar', 'upgrade']
const NEG_WORDS = ['fall', 'drop', 'crash', 'decline', 'bear', 'low', 'loss', 'weak', 'sell', 'down', 'slump', 'plunge', 'cut', 'concern', 'risk', 'warning', 'negative', 'fear', 'downgrade', 'deficit']

type Sentiment = 'positive' | 'negative' | 'neutral'

function getSentiment(text: string): Sentiment {
  const lower = text.toLowerCase()
  const pos = POS_WORDS.filter(w => lower.includes(w)).length
  const neg = NEG_WORDS.filter(w => lower.includes(w)).length
  if (pos > neg) return 'positive'
  if (neg > pos) return 'negative'
  return 'neutral'
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

interface RssItem {
  title: string
  link: string
  pubDate: string
  description: string
  author?: string
}

interface RssResponse {
  status: string
  items: RssItem[]
  feed?: { title: string }
}

// Fetch from two ET RSS feeds and merge
async function fetchNews(): Promise<RssItem[]> {
  const feeds = [
    'https://economictimes.indiatimes.com/markets/rss.cms',
    'https://economictimes.indiatimes.com/news/economy/rss.cms',
  ]
  const results = await Promise.allSettled(
    feeds.map(url =>
      fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&count=15`)
        .then(r => r.json() as Promise<RssResponse>)
        .then(d => (d.status === 'ok' ? d.items : []))
    )
  )
  const all = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []))
  // deduplicate by title, sort by date desc
  const seen = new Set<string>()
  return all
    .filter(i => { if (seen.has(i.title)) return false; seen.add(i.title); return true })
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, 30)
}

const sentimentConfig = {
  positive: {
    border: 'border-[#22c55e]/40',
    dot: 'bg-[#22c55e]',
    badge: 'bg-[#0d2b0d] text-[#22c55e]',
    Icon: TrendingUp,
    iconColor: 'text-[#22c55e]',
    label: 'Positive',
  },
  negative: {
    border: 'border-[#ef4444]/40',
    dot: 'bg-[#ef4444]',
    badge: 'bg-[#2b0d0d] text-[#ef4444]',
    Icon: TrendingDown,
    iconColor: 'text-[#ef4444]',
    label: 'Negative',
  },
  neutral: {
    border: 'border-[#334155]',
    dot: 'bg-[#475569]',
    badge: 'bg-[#0f1f35] text-[#64748b]',
    Icon: Minus,
    iconColor: 'text-[#475569]',
    label: 'Neutral',
  },
}

export function NewsTimeline() {
  const { data: items = [], isFetching, refetch, error } = useQuery({
    queryKey: ['market-news'],
    queryFn: fetchNews,
    refetchInterval: 5 * 60 * 1000, // every 5 min
    staleTime: 4 * 60 * 1000,
    retry: 2,
  })

  const pos = items.filter(i => getSentiment(i.title + i.description) === 'positive').length
  const neg = items.filter(i => getSentiment(i.title + i.description) === 'negative').length

  return (
    <div className="flex flex-col border-t border-[#1e293b]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 sticky top-0 bg-[#0a1628] z-10">
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-[#64748b] uppercase tracking-widest font-medium">Market News</span>
          {items.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[8px] text-[#22c55e] font-bold bg-[#0d2b0d] px-1 rounded">{pos}↑</span>
              <span className="text-[8px] text-[#ef4444] font-bold bg-[#2b0d0d] px-1 rounded">{neg}↓</span>
            </div>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className={`text-[#475569] hover:text-[#38bdf8] transition-colors ${isFetching ? 'animate-spin' : ''}`}
        >
          <RefreshCw size={11} />
        </button>
      </div>

      {/* Sentiment bar */}
      {items.length > 0 && (
        <div className="flex mx-3 mb-2 rounded overflow-hidden h-1.5">
          <div className="bg-[#22c55e]" style={{ width: `${(pos / items.length) * 100}%` }} />
          <div className="bg-[#334155] flex-1" />
          <div className="bg-[#ef4444]" style={{ width: `${(neg / items.length) * 100}%` }} />
        </div>
      )}

      {/* News list */}
      <div className="overflow-y-auto max-h-[420px] px-3 pb-3 space-y-2">
        {error && (
          <div className="text-[#475569] text-[10px] text-center py-4">
            Unable to load news. Check connection.
          </div>
        )}

        {!error && items.length === 0 && !isFetching && (
          <div className="text-[#475569] text-[10px] text-center py-4">Loading news…</div>
        )}

        {items.map((item, i) => {
          const sentiment = getSentiment(item.title + item.description)
          const cfg = sentimentConfig[sentiment]
          const { Icon } = cfg
          return (
            <a
              key={i}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex gap-2 p-2 rounded border ${cfg.border} bg-[#060d1a] hover:bg-[#0f1f35] transition-colors block`}
            >
              <div className="shrink-0 mt-0.5">
                <Icon size={11} className={cfg.iconColor} />
              </div>
              <div className="min-w-0">
                <p className="text-white text-[10px] font-medium leading-snug line-clamp-2">{item.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[8px] font-bold px-1 rounded ${cfg.badge}`}>{cfg.label}</span>
                  <span className="text-[#475569] text-[8px]">{timeAgo(item.pubDate)}</span>
                  <span className="text-[#334155] text-[8px]">ET</span>
                </div>
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}
