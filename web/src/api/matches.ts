import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from './client';
import type { MatchesResponse } from './types';

/** Matches across all of my active listings, score desc. 401 (no session) → empty list. */
export function useMyMatches() {
  return useQuery({
    queryKey: ['my-matches'],
    queryFn: async (): Promise<MatchesResponse> => {
      try {
        return await api<MatchesResponse>('/api/my/matches');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return { matches: [] };
        throw err;
      }
    },
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}
