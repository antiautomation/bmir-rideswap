import { useEffect, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useConnectivity, probe } from '../offline/connectivity';
import { getOutboxItems, subscribeOutbox, flushOutbox } from '../offline/outbox';
import { timeAgo } from '../lib/format';

export default function StatusBar() {
  const { status } = useConnectivity();
  const outboxItems = useSyncExternalStore(subscribeOutbox, getOutboxItems, getOutboxItems);
  const queryClient = useQueryClient();

  // Force a re-render every 30s while offline so the "showing rides from Xm ago" text stays fresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (status !== 'offline') return;
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [status]);

  if (status === 'online' && outboxItems.length === 0) return null;

  const handleRetry = () => {
    void probe();
    void flushOutbox();
  };

  if (status === 'offline') {
    const dataUpdatedAt = queryClient.getQueryState(['listings'])?.dataUpdatedAt;
    const freshness = dataUpdatedAt ? timeAgo(new Date(dataUpdatedAt).toISOString()) : 'unknown';
    return (
      <div className="status-bar status-bar-offline" aria-live="polite">
        <span>
          ⏸ Offline — showing rides from {freshness}
          {outboxItems.length > 0 &&
            ` · ${outboxItems.length} post${outboxItems.length === 1 ? '' : 's'} waiting to send`}
        </span>
        <button type="button" className="status-bar-retry" onClick={handleRetry}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="status-bar status-bar-syncing" aria-live="polite">
      <span>
        Syncing {outboxItems.length} queued change{outboxItems.length === 1 ? '' : 's'}…
      </span>
    </div>
  );
}
