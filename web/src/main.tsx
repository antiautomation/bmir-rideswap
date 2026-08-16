import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { RouterProvider } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';

import { router } from './routes';
import { registerOutboxInvalidation } from './api/listings';
import { initOutbox } from './offline/outbox';
import { initConnectivity } from './offline/connectivity';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/board.css';
import './styles/forms.css';
import './styles/messages.css';
import './styles/statusbar.css';
import './styles/terminal.css';

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
initConnectivity();
registerOutboxInvalidation(queryClient);
registerSW({ immediate: true });

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
