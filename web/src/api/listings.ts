import { useQuery, type QueryClient } from '@tanstack/react-query';
import { api, ApiError } from './client';
import { enqueue, onOutboxFailure, onOutboxSuccess } from '../offline/outbox';
import type { CreateListingInput, Listing, ListingsResponse, UpdateListingInput } from './types';

export function useListings() {
  return useQuery({
    queryKey: ['listings'],
    queryFn: () => api<ListingsResponse>('/api/listings'),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

export interface MyListingsResponse {
  listings: Listing[];
}

export function useMyListings() {
  return useQuery({
    queryKey: ['my-listings'],
    queryFn: async (): Promise<MyListingsResponse> => {
      try {
        return await api<MyListingsResponse>('/api/my/listings');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return { listings: [] };
        throw err;
      }
    },
  });
}

export function invalidateListings(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ['listings'] });
  void queryClient.invalidateQueries({ queryKey: ['my-listings'] });
}

let invalidationRegistered = false;

/** Wires outbox replay successes/failures to cache refreshes. Call once from main.tsx. */
export function registerOutboxInvalidation(queryClient: QueryClient): void {
  if (invalidationRegistered) return;
  invalidationRegistered = true;
  onOutboxSuccess(() => {
    invalidateListings(queryClient);
    // A queued write may have created the session for the first time (e.g. the
    // first listing post on this device) — refresh /api/me so recoveryCode etc. show up.
    void queryClient.invalidateQueries({ queryKey: ['me'] });
  });
  onOutboxFailure(() => {
    // The server rejected the write (or we gave up) — clear any stranded
    // optimistic entries by refetching the real state.
    invalidateListings(queryClient);
  });
}

/** 23:59:59.999 local time on the given YYYY-MM-DD date, as an ISO string. */
function endOfDayIso(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  const year = parts[0] ?? 1970;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

/** Appends an optimistic pending listing to the board + my-listings caches, then
 *  queues the real POST. Confirmation is implicit: the card appears with a
 *  "Waiting to sync" pill until the outbox replays it. */
export function createListing(queryClient: QueryClient, input: CreateListingInput): void {
  const now = new Date().toISOString();
  const optimistic: Listing = {
    id: `pending-${input.clientId}`,
    type: input.type,
    direction: input.direction,
    name: input.name,
    location: input.location,
    travelDate: input.travelDate,
    timeSlot: input.timeSlot,
    details: input.details ?? null,
    campInfo: input.campInfo ?? null,
    passengerSpace: input.passengerSpace ?? null,
    cargoSpace: input.cargoSpace ?? null,
    routeDetails: input.routeDetails ?? null,
    riderStuff: input.riderStuff ?? null,
    expiresAt: endOfDayIso(input.travelDate),
    cancelledAt: null,
    createdAt: now,
    updatedAt: now,
    isMine: true,
    pending: true,
  };

  queryClient.setQueryData<ListingsResponse>(['listings'], (old) => {
    if (!old) return old;
    return { ...old, listings: [...old.listings, optimistic] };
  });

  queryClient.setQueryData<MyListingsResponse>(['my-listings'], (old) => {
    if (!old) return old;
    return { listings: [...old.listings, optimistic] };
  });

  void enqueue({ label: 'post listing', method: 'POST', path: '/api/listings', body: input });
}

function mergeListing(listing: Listing, input: UpdateListingInput, updatedAt: string): Listing {
  return {
    ...listing,
    direction: input.direction ?? listing.direction,
    name: input.name ?? listing.name,
    location: input.location ?? listing.location,
    travelDate: input.travelDate ?? listing.travelDate,
    timeSlot: input.timeSlot ?? listing.timeSlot,
    details: input.details !== undefined ? input.details : listing.details,
    campInfo: input.campInfo !== undefined ? input.campInfo : listing.campInfo,
    passengerSpace:
      input.passengerSpace !== undefined ? input.passengerSpace : listing.passengerSpace,
    cargoSpace: input.cargoSpace !== undefined ? input.cargoSpace : listing.cargoSpace,
    routeDetails: input.routeDetails !== undefined ? input.routeDetails : listing.routeDetails,
    riderStuff: input.riderStuff !== undefined ? input.riderStuff : listing.riderStuff,
    updatedAt,
  };
}

/** Optimistically merges an edit into both caches, then queues the real PATCH. */
export function updateListing(
  queryClient: QueryClient,
  id: string,
  input: UpdateListingInput,
): void {
  const updatedAt = new Date().toISOString();

  queryClient.setQueryData<ListingsResponse>(['listings'], (old) => {
    if (!old) return old;
    return {
      ...old,
      listings: old.listings.map((l) => (l.id === id ? mergeListing(l, input, updatedAt) : l)),
    };
  });

  queryClient.setQueryData<MyListingsResponse>(['my-listings'], (old) => {
    if (!old) return old;
    return {
      listings: old.listings.map((l) => (l.id === id ? mergeListing(l, input, updatedAt) : l)),
    };
  });

  void enqueue({
    label: 'update listing',
    method: 'PATCH',
    path: `/api/listings/${id}`,
    body: input,
  });
}

export function cancelListing(queryClient: QueryClient, id: string): void {
  const cancelledAt = new Date().toISOString();

  queryClient.setQueryData<ListingsResponse>(['listings'], (old) => {
    if (!old) return old;
    return { ...old, listings: old.listings.filter((l) => l.id !== id) };
  });

  queryClient.setQueryData<MyListingsResponse>(['my-listings'], (old) => {
    if (!old) return old;
    return { listings: old.listings.map((l) => (l.id === id ? { ...l, cancelledAt } : l)) };
  });

  void enqueue({ label: 'cancel listing', method: 'POST', path: `/api/listings/${id}/cancel` });
}

export function deleteListing(queryClient: QueryClient, id: string): void {
  queryClient.setQueryData<ListingsResponse>(['listings'], (old) => {
    if (!old) return old;
    return { ...old, listings: old.listings.filter((l) => l.id !== id) };
  });

  queryClient.setQueryData<MyListingsResponse>(['my-listings'], (old) => {
    if (!old) return old;
    return { listings: old.listings.filter((l) => l.id !== id) };
  });

  void enqueue({ label: 'delete listing', method: 'DELETE', path: `/api/listings/${id}` });
}

/** Enqueues the flag mutation. The caller is responsible for optimistically
 *  adding the id to the local hidden set (see lib/prefs's useIdSet). */
export function flagListing(queryClient: QueryClient, id: string, reason?: string): void {
  void queryClient; // reserved for future optimistic flag bookkeeping
  void enqueue({
    label: 'report listing',
    method: 'POST',
    path: `/api/listings/${id}/flag`,
    // Always send a JSON body — the server validates the payload as JSON even when reason is omitted.
    body: reason ? { reason } : {},
  });
}
