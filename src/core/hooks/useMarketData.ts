import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { tradingService } from '@/core/services/tradingService'
import { useMarketStore } from '@/core/store'

export function useNiftyQuote() {
  const setQuote = useMarketStore(s => s.setQuote)
  const query = useQuery({
    queryKey: ['nifty-quote'],
    queryFn: () => tradingService.getNiftyQuote(),
    refetchInterval: 3000,
    staleTime: 2000,
  })
  useEffect(() => { if (query.data) setQuote(query.data) }, [query.data, setQuote])
  return query
}

export function useOptionChain() {
  const setOptionChain = useMarketStore(s => s.setOptionChain)
  const query = useQuery({
    queryKey: ['option-chain'],
    queryFn: () => tradingService.getOptionChain(),
    refetchInterval: 5000,
    staleTime: 4000,
  })
  useEffect(() => { if (query.data) setOptionChain(query.data) }, [query.data, setOptionChain])
  return query
}

export function useCandles(timeframe = '5m', count = 30) {
  const setCandles = useMarketStore(s => s.setCandles)
  const query = useQuery({
    queryKey: ['candles', timeframe],
    queryFn: () => tradingService.getCandles(timeframe, count),
    refetchInterval: 15000,
    staleTime: 10000,
  })
  useEffect(() => { if (query.data) setCandles(query.data) }, [query.data, setCandles])
  return query
}

export function usePositions() {
  return useQuery({
    queryKey: ['positions'],
    queryFn: () => tradingService.getPositions(),
    refetchInterval: 3000,
    staleTime: 2000,
  })
}
