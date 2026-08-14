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

// Broader NSE universe used to fill up to 10 results when screened list is short
export const BROAD_SECTOR_STOCKS: Record<string, string[]> = {
  IT:      ['TCS', 'INFY', 'WIPRO', 'HCLTECH', 'TECHM', 'LTIM', 'MPHASIS', 'COFORGE', 'PERSISTENT', 'LTTS', 'NEWGEN', 'CYIENT', 'KPITTECH', 'MASTEK', 'ZENSARTECH', 'OFSS', 'NIITTECH', 'HEXAWARE'],
  Banks:   ['HDFCBANK', 'ICICIBANK', 'KOTAKBANK', 'SBIN', 'AXISBANK', 'INDUSINDBK', 'BANDHANBNK', 'IDFCFIRSTB', 'FEDERALBNK', 'ABCAPITAL', 'AUBANK', 'CSBBANK', 'DCBBANK', 'KTKBANK', 'RBLBANK'],
  Pharma:  ['SUNPHARMA', 'DRREDDY', 'CIPLA', 'DIVISLAB', 'LUPIN', 'AUROPHARMA', 'TORNTPHARM', 'ALKEM', 'GLENMARK', 'IPCALAB', 'MANKIND', 'MEDANTA', 'AARTIIND', 'GRANULES', 'NATCO', 'LAURUSLABS', 'JBCHEPHARM'],
  FMCG:    ['HINDUNILVR', 'ITC', 'NESTLEIND', 'BRITANNIA', 'DABUR', 'MARICO', 'COLPAL', 'GODREJCP', 'EMAMILTD', 'BIKAJI', 'HAPPYMIND', 'KALYANKJIL', 'TATACONSUM', 'RADICO', 'SENCO'],
  Auto:    ['MARUTI', 'TATAMOTORS', 'EICHERMOT', 'HEROMOTOCO', 'ASHOKLEY', 'MOTHERSON', 'BOSCHLTD', 'CRAFTSMAN', 'SONACOMS', 'TIINDIA', 'EXIDEIND', 'AMARARAJA', 'SUPRAJIT'],
  Telecom: ['BHARTIARTL', 'INDUSTOWER', 'TEJASNET', 'IRIS', 'TATACOMM', 'HFCL', 'STLTECH'],
  Energy:  ['RELIANCE', 'ONGC', 'NTPC', 'POWERGRID', 'BPCL', 'IOC', 'GAIL', 'TATAPOWER', 'GREENPANEL', 'CESC', 'TORNTPOWER', 'ADANIGREEN'],
  Infra:   ['LT', 'SIEMENS', 'ABB', 'CUMMINSIND', 'THERMAX', 'KEC', 'PIIND', 'KALPATPOWR', 'NCC', 'IRCON', 'RVNL'],
  Finance: ['BAJFINANCE', 'BAJAJFINSV', 'SHRIRAMFIN', 'MUTHOOTFIN', 'LICHSGFIN', 'CHOLAFIN', 'MANAPPURAM', 'IIFL', 'POONAWALLA'],
  Metal:   ['TATASTEEL', 'JSWSTEEL', 'HINDALCO', 'VEDL', 'COALINDIA', 'NMDC', 'SAIL', 'HINDZINC', 'NATIONALUM', 'RATNAMANI'],
  Realty:  ['DLF', 'GODREJPROP', 'PRESTIGE', 'OBEROIRLTY', 'PHOENIXLTD', 'BRIGADE', 'SOBHA', 'MAHLIFE'],
  Cement:  ['ULTRACEMCO', 'SHREECEM', 'AMBUJACEM', 'ACC', 'DALMIABHARAT', 'JKCEMENT', 'HEIDELBERG', 'SAGCEM'],
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
