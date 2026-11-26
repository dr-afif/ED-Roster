import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppQueryClient } from './queryClient';
import {
  attachQueryCachePersistence,
  clearPersistedQueryCache,
  hydrateQueryClient,
} from './queryCachePersistence';

describe('queryCachePersistence', () => {
  afterEach(() => {
    clearPersistedQueryCache();
    vi.useRealTimers();
  });

  it('hydrates cached queries immediately while skipping auth queries and always refetching on mount', () => {
    vi.useFakeTimers();
    const writerClient = createAppQueryClient();
    expect(writerClient.getDefaultOptions().queries?.refetchOnMount).toBe('always');

    const detach = attachQueryCachePersistence(writerClient);
    writerClient.setQueryData(['rosters', 'staff-list'], [{ id: 1, name: 'Dr Afif' }]);
    writerClient.setQueryData(['auth', 'allowlist-binding'], { role: 'owner' });

    vi.advanceTimersByTime(1000);
    detach();

    const readerClient = createAppQueryClient();
    hydrateQueryClient(readerClient);

    expect(readerClient.getQueryData(['rosters', 'staff-list'])).toEqual([
      { id: 1, name: 'Dr Afif' },
    ]);
    expect(readerClient.getQueryData(['auth', 'allowlist-binding'])).toBeUndefined();

    clearPersistedQueryCache();
    const clearedClient = createAppQueryClient();
    hydrateQueryClient(clearedClient);
    expect(clearedClient.getQueryData(['rosters', 'staff-list'])).toBeUndefined();
  });
});
