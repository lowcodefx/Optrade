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
    refetchInterval: 3000,
    staleTime: 2000,
  })
  useEffect(() => { if (query.data) setOptionChain(query.data) }, [query.data, setOptionChain])
  return query
}

export function useCandles(timeframe = '5m', count = 30) {
  const setCandles = useMarketStore(s => s.setCandles)
  const query = useQuery({
    queryKey: ['candles', timeframe],
    queryFn: () => tradingService.getCandles(timeframe, count),
    refetchInterval: 10000,
    staleTime: 8000,
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

export function useNifty50Breadth() {
  return useQuery({
    queryKey: ['nifty50-breadth'],
    queryFn: () => tradingService.getNifty50Breadth(),
    refetchInterval: 30000,
    staleTime: 25000,
    retry: 1,
  })
}

export function usePivotPoints() {
  const setPivotPoints = useMarketStore(s => s.setPivotPoints)
  const query = useQuery({
    queryKey: ['pivot-points'],
    queryFn: () => tradingService.getPivotPoints(),
    staleTime: 8 * 60 * 60 * 1000, // refresh once per session
    retry: 1,
  })
  useEffect(() => { if (query.data) setPivotPoints(query.data) }, [query.data, setPivotPoints])
  return query
}

export function useOrders() {
  const setOrders = useMarketStore(s => s.setOrders)
  const query = useQuery({
    queryKey: ['orders'],
    queryFn: () => tradingService.getOrders(),
    refetchInterval: 10000,
    staleTime: 8000,
    retry: 1,
  })
  useEffect(() => { if (query.data) setOrders(query.data) }, [query.data, setOrders])
  return query
}

export function useGlobalMarkets() {
  const setGlobalMarkets = useMarketStore(s => s.setGlobalMarkets)
  const query = useQuery({
    queryKey: ['global-markets'],
    queryFn: async () => {
      const res = await fetch('/api/global-markets')
      if (!res.ok) throw new Error('Failed to fetch global markets')
      return res.json() as Promise<import('@/core/types').GlobalMarket[]>
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
    retry: 1,
  })
  useEffect(() => { if (query.data) setGlobalMarkets(query.data) }, [query.data, setGlobalMarkets])
  return query
}

export function useFiiDii() {
  const setFiiDii = useMarketStore(s => s.setFiiDii)
  const query = useQuery({
    queryKey: ['fii-dii'],
    queryFn: async () => {
      const res = await fetch('/api/fii-dii')
      if (!res.ok) throw new Error('Failed to fetch FII/DII data')
      return res.json() as Promise<import('@/core/types').FiiDiiData>
    },
    staleTime: 30 * 60 * 1000, // FII/DII updates once a day
    retry: 1,
  })
  useEffect(() => { if (query.data) setFiiDii(query.data) }, [query.data, setFiiDii])
  return query
}
