import { dehydrate, hydrate, type DehydratedState, type QueryClient } from '@tanstack/react-query';

const QUERY_CACHE_STORAGE_KEY = 'resq.queryCache.v1';
const QUERY_CACHE_VERSION = 1;
const MAX_CACHE_AGE_MS = 24 * 60 * 60_000; // 24 hours
const SAVE_DEBOUNCE_MS = 800;

interface PersistedQueryCacheEnvelope {
  version: number;
  savedAt: number;
  state: DehydratedState;
}

export function clearPersistedQueryCache(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(QUERY_CACHE_STORAGE_KEY);
  } catch {
    // Ignore storage restrictions safely
  }
}

export function hydrateQueryClient(client: QueryClient): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const raw = window.localStorage.getItem(QUERY_CACHE_STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as Partial<PersistedQueryCacheEnvelope> | null;
    if (
      !parsed ||
      parsed.version !== QUERY_CACHE_VERSION ||
      typeof parsed.savedAt !== 'number' ||
      Date.now() - parsed.savedAt > MAX_CACHE_AGE_MS ||
      !parsed.state
    ) {
      clearPersistedQueryCache();
      return;
    }

    hydrate(client, parsed.state);
  } catch {
    clearPersistedQueryCache();
  }
}

function saveQueryClient(client: QueryClient): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const state = dehydrate(client, {
      shouldDehydrateMutation: () => false,
      shouldDehydrateQuery: (query) => {
        if (query.state.status !== 'success') return false;
        const rootKey = query.queryKey[0];
        if (rootKey === 'auth') return false;
        return true;
      },
    });

    if (state.queries.length === 0) return;

    const envelope: PersistedQueryCacheEnvelope = {
      version: QUERY_CACHE_VERSION,
      savedAt: Date.now(),
      state,
    };
    window.localStorage.setItem(QUERY_CACHE_STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Ignore quota exceeded or private-browsing storage errors
  }
}

export function attachQueryCachePersistence(client: QueryClient): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  let timer: ReturnType<typeof setTimeout> | null = null;

  const scheduleSave = () => {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      saveQueryClient(client);
    }, SAVE_DEBOUNCE_MS);
  };

  const flushSave = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    saveQueryClient(client);
  };

  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' || event.type === 'added' || event.type === 'removed') {
      scheduleSave();
    }
  });

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      flushSave();
    }
  };

  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    unsubscribe();
    window.removeEventListener('pagehide', flushSave);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (timer !== null) {
      clearTimeout(timer);
    }
  };
}
