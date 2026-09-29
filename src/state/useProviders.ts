'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api, type Provider } from '../api/client';
import { useKeys } from './keys';

/** The provider catalogue from the server, with `connected` filled in from the keys this browser holds. */
export function useProviders() {
  const q = useQuery({ queryKey: ['providers'], queryFn: api.providers });
  const held = useKeys();
  const data = useMemo<Provider[]>(() => (q.data ?? []).map((p) => ({ ...p, connected: !!held[p.id]?.key })), [q.data, held]);
  return { data, isLoading: q.isLoading, isError: q.isError, error: q.error };
}
