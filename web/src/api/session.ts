import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from './client';
import type { Me } from './types';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async (): Promise<Me | null> => {
      try {
        const res = await api<{ me: Me }>('/api/me');
        return res.me;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}
