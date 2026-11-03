import type { ReactNode } from 'react';
import { getSupabaseRuntimeBundle, type SupabaseRuntimeBundle } from './client';
import { SupabaseContext } from './supabaseContext';

type SupabaseProviderProps = {
  bundle?: SupabaseRuntimeBundle;
  children: ReactNode;
};

export function SupabaseProvider({ bundle, children }: SupabaseProviderProps) {
  const resolvedBundle = bundle ?? getSupabaseRuntimeBundle();
  return <SupabaseContext.Provider value={resolvedBundle}>{children}</SupabaseContext.Provider>;
}
