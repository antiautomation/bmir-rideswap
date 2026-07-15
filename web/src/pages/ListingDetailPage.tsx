import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import EmptyState from '../components/EmptyState';
import ListingCard from '../components/ListingCard';
import MessageComposer from '../components/MessageComposer';
import { api, ApiError } from '../api/client';
import { cancelListing, deleteListing, flagListing } from '../api/listings';
import type { Listing, ListingsResponse } from '../api/types';
import { useIdSet } from '../lib/prefs';

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const favorites = useIdSet('ridefinder-favorites-v1');
  const hidden = useIdSet('ridefinder-hidden-v1');
  const [messageTarget, setMessageTarget] = useState<Listing | null>(null);

  const cached = id
    ? queryClient.getQueryData<ListingsResponse>(['listings'])?.listings.find((l) => l.id === id)
    : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['listing', id],
    queryFn: async (): Promise<Listing | null> => {
      if (!id) return null;
      try {
        const res = await api<{ listing: Listing }>(`/api/listings/${id}`);
        return res.listing;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    initialData: cached,
    enabled: Boolean(id),
  });

  const listing = data ?? cached ?? null;

  if (!id || (!isLoading && !listing)) {
    return <EmptyState title="Listing not found or no longer available" />;
  }

  if (isLoading && !listing) {
    return <p className="board-loading">Loading listing…</p>;
  }

  if (!listing) {
    return <EmptyState title="Listing not found or no longer available" />;
  }

  return (
    <div className="listing-detail-page">
      <Link to="/" className="back-link">
        ← Back to board
      </Link>
      <ListingCard
        listing={listing}
        isFavorite={favorites.has(listing.id)}
        onToggleFavorite={favorites.toggle}
        onCancel={listing.isMine ? (lid) => cancelListing(queryClient, lid) : undefined}
        onDelete={listing.isMine ? (lid) => deleteListing(queryClient, lid) : undefined}
        onFlag={
          listing.isMine
            ? undefined
            : (lid) => {
                flagListing(queryClient, lid);
                hidden.add(lid);
              }
        }
        onMessage={listing.isMine ? undefined : setMessageTarget}
        forceExpanded
      />

      {messageTarget && (
        <MessageComposer listing={messageTarget} onClose={() => setMessageTarget(null)} />
      )}
    </div>
  );
}
