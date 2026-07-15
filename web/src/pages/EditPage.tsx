import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import EmptyState from '../components/EmptyState';
import ListingForm from '../components/ListingForm';
import { api, ApiError } from '../api/client';
import { updateListing } from '../api/listings';
import type { CreateListingInput, Listing, ListingsResponse, UpdateListingInput } from '../api/types';
import type { MyListingsResponse } from '../api/listings';

export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const cached =
    id !== undefined
      ? (queryClient.getQueryData<ListingsResponse>(['listings'])?.listings.find((l) => l.id === id) ??
        queryClient.getQueryData<MyListingsResponse>(['my-listings'])?.listings.find((l) => l.id === id))
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

  if (!listing.isMine) {
    return <Navigate to={`/listing/${id}`} replace />;
  }

  const listingId: string = id;

  function handleSubmit(input: CreateListingInput | UpdateListingInput): void {
    updateListing(queryClient, listingId, input as UpdateListingInput);
    navigate('/me');
  }

  return (
    <div className="form-page">
      <h1>Edit listing</h1>
      <ListingForm mode="edit" initial={listing} needsContact={false} onSubmit={handleSubmit} />
    </div>
  );
}
