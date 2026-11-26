import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { attachQueryCachePersistence, hydrateQueryClient } from './queryCachePersistence';
import { createAppQueryClient } from './queryClient';

type QueryProviderProps = {
  client?: QueryClient;
  children: ReactNode;
};

export function QueryProvider({ client, children }: QueryProviderProps) {
  const [defaultClient] = useState(() => {
    const created = createAppQueryClient();
    if (!client) {
      hydrateQueryClient(created);
    }
    return created;
  });

  useEffect(() => {
    if (client) return undefined;
    return attachQueryCachePersistence(defaultClient);
  }, [client, defaultClient]);

  return <QueryClientProvider client={client ?? defaultClient}>{children}</QueryClientProvider>;
}
