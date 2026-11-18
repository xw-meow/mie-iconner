import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

export function useEnvQuery() {
  return useQuery({
    queryKey: ['env'],
    queryFn: api.env,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  })
}

export function useLibraryQuery() {
  return useQuery({
    queryKey: ['library'],
    queryFn: api.library,
    staleTime: 10_000,
    retry: 1,
  })
}

export function useFoldersQuery(path: string) {
  return useQuery({
    queryKey: ['folders', path],
    queryFn: () => api.folders(path),
    enabled: path.length > 0,
    staleTime: 4_000,
    placeholderData: keepPreviousData,
    retry: false,
  })
}

export function useSuggestionsQuery(input: string, enabled: boolean) {
  return useQuery({
    queryKey: ['suggestions', input],
    queryFn: () => api.suggestPaths(input, 8),
    enabled: enabled && input.length > 0,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
    retry: false,
  })
}
