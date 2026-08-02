export const SECTOR_STOCKS: Record<string, string[]> = {
  IT:       ['TCS', 'INFY', 'WIPRO', 'MPHASIS', 'COFORGE', 'PERSISTENT', 'LTTS', 'LTIM', 'NEWGEN', 'CYIENT'],
  Banks:    ['HDFCBANK', 'ICICIBANK', 'KOTAKBANK', 'ABCAPITAL'],
  FMCG:     ['ITC', 'BIKAJI', 'HAPPYMIND', 'KALYANKJIL', 'SENCO'],
  Pharma:   ['MEDANTA', 'AARTIIND'],
  Auto:     ['CRAFTSMAN', 'SONACOMS'],
  Telecom:  ['BHARTIARTL', 'TEJASNET', 'IRIS'],
  Energy:   ['RELIANCE', 'GREENPANEL'],
  Infra:    ['LT', 'PIIND'],
}

export const SECTOR_COLORS: Record<string, { bg: string; text: string; activeBg: string }> = {
  IT:      { bg: 'bg-[#38bdf8]/10', text: 'text-[#38bdf8]', activeBg: 'bg-[#38bdf8]/30' },
  Banks:   { bg: 'bg-[#ef4444]/10', text: 'text-[#ef4444]', activeBg: 'bg-[#ef4444]/30' },
  FMCG:    { bg: 'bg-[#22c55e]/10', text: 'text-[#22c55e]', activeBg: 'bg-[#22c55e]/30' },
  Pharma:  { bg: 'bg-[#a78bfa]/10', text: 'text-[#a78bfa]', activeBg: 'bg-[#a78bfa]/30' },
  Auto:    { bg: 'bg-[#f59e0b]/10', text: 'text-[#f59e0b]', activeBg: 'bg-[#f59e0b]/30' },
  Telecom: { bg: 'bg-[#06b6d4]/10', text: 'text-[#06b6d4]', activeBg: 'bg-[#06b6d4]/30' },
  Energy:  { bg: 'bg-[#f97316]/10', text: 'text-[#f97316]', activeBg: 'bg-[#f97316]/30' },
  Infra:   { bg: 'bg-[#84cc16]/10', text: 'text-[#84cc16]', activeBg: 'bg-[#84cc16]/30' },
}
