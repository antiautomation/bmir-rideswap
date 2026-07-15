import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { RouterProvider } from 'react-router-dom';

import { router } from './routes';
import { registerOutboxInvalidation } from './api/listings';
import { initOutbox } from './offline/outbox';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/board.css';
import './styles/forms.css';

const ONE_WEEK_MS = 7 * 24 * 3600 * 1000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: ONE_WEEK_MS,
      retry: 1,
    },
  },
});

initOutbox();
registerOutboxInvalidation(queryClient);

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'ridefinder-cache-v1',
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: ONE_WEEK_MS, buster: 'v2.0' }}
    >
      <RouterProvider router={router} />
    </PersistQueryClientProvider>
  </StrictMode>,
);
