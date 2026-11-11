import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import {
  getRuntimeSupabaseEnv,
  type PublicSupabaseMetadata,
  type ValidatedSupabaseEnv,
} from './env';

export type AppSupabaseClient = SupabaseClient<Database>;

export type SupabaseRuntimeBundle = {
  readonly client: AppSupabaseClient;
  readonly metadata: PublicSupabaseMetadata;
};

let cachedBundle: SupabaseRuntimeBundle | null = null;

export function createBrowserSupabaseClient(config: ValidatedSupabaseEnv): AppSupabaseClient {
  return createClient<Database>(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      // ADR-007: Enforce PKCE so Google OAuth uses ?code= rather than #access_token=,
      // preserving clean compatibility with HashRouter on GitHub Pages.
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'resq.auth.v1.session',
    },
  });
}

export function getSupabaseRuntimeBundle(): SupabaseRuntimeBundle {
  if (cachedBundle) {
    return cachedBundle;
  }
  const config = getRuntimeSupabaseEnv();
  const client = createBrowserSupabaseClient(config);
  const metadata: PublicSupabaseMetadata = Object.freeze({
    appEnv: config.appEnv,
    projectRef: config.projectRef,
    supabaseOrigin: config.supabaseOrigin,
    basePath: config.basePath,
    isProduction: config.isProduction,
  });

  cachedBundle = Object.freeze({ client, metadata });
  return cachedBundle;
}

export function resetSupabaseRuntimeBundleForTests(): void {
  cachedBundle = null;
}

export const supabase: AppSupabaseClient = new Proxy({} as AppSupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseRuntimeBundle().client;
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
