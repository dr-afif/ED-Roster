import { createContext, useContext } from 'react';
import type { AppSupabaseClient, SupabaseRuntimeBundle } from './client';
import type { PublicSupabaseMetadata } from './env';

export const SupabaseContext = createContext<SupabaseRuntimeBundle | null>(null);

export function useSupabaseClient(): AppSupabaseClient {
  const ctx = useContext(SupabaseContext);
  if (!ctx) {
    throw new Error('useSupabaseClient must be used within a SupabaseProvider.');
  }
  return ctx.client;
}

export function useSupabaseMetadata(): PublicSupabaseMetadata {
  const ctx = useContext(SupabaseContext);
  if (!ctx) {
    throw new Error('useSupabaseMetadata must be used within a SupabaseProvider.');
  }
  return ctx.metadata;
}
