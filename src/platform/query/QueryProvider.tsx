import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { createAppQueryClient } from './queryClient';

type QueryProviderProps = {
  client?: QueryClient;
  children: ReactNode;
};

export function QueryProvider({ client, children }: QueryProviderProps) {
  const [defaultClient] = useState(() => createAppQueryClient());
  return <QueryClientProvider client={client ?? defaultClient}>{children}</QueryClientProvider>;
}
