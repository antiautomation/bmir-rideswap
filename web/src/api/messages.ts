import { useQuery, type QueryClient } from '@tanstack/react-query';
import { api, ApiError } from './client';
import { enqueue } from '../offline/outbox';
import type { ConversationsResponse, Me, Message, SendMessageInput, ThreadResponse } from './types';

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: async (): Promise<ConversationsResponse> => {
      try {
        return await api<ConversationsResponse>('/api/conversations');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return { conversations: [] };
        throw err;
      }
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

/** Thread view requires an active session — a 401 here is a real error, not "no data". */
export function useThread(id: string | undefined) {
  return useQuery({
    queryKey: ['thread', id],
    queryFn: () => api<ThreadResponse>(`/api/conversations/${id}`),
    refetchInterval: 15_000,
    enabled: Boolean(id),
  });
}

/** Sum of per-conversation unread counts, derived from the conversations cache. */
export function useUnreadTotal(): number {
  const { data } = useConversations();
  return (data?.conversations ?? []).reduce((sum, c) => sum + c.unreadCount, 0);
}

/** Optimistically appends a message to the thread cache, then queues the real POST. */
export function sendReply(
  queryClient: QueryClient,
  conversationId: string,
  input: SendMessageInput,
): void {
  const now = new Date().toISOString();
  const optimistic: Message = {
    id: `pending-${input.clientId}`,
    conversationId,
    isMine: true,
    body: input.body,
    sharedEmail: null,
    sharedPhone: null,
    createdAt: now,
    pending: true,
  };

  queryClient.setQueryData<ThreadResponse>(['thread', conversationId], (old) => {
    if (!old) return old;
    return { ...old, messages: [...old.messages, optimistic] };
  });

  void enqueue({
    label: 'send message',
    method: 'POST',
    path: `/api/conversations/${conversationId}/messages`,
    body: input,
  });
}

/** Starts a new conversation on a listing. No optimistic thread entry is possible —
 *  the conversation id doesn't exist yet while the POST is still queued offline. */
export function startConversation(
  queryClient: QueryClient,
  listingId: string,
  input: SendMessageInput,
): void {
  void queryClient; // reserved — nothing to optimistically update here
  void enqueue({
    label: 'start conversation',
    method: 'POST',
    path: `/api/listings/${listingId}/conversations`,
    body: input,
  });
}

export interface ContactShareState {
  shareEmail: boolean;
  sharePhone: boolean;
  newEmail: string;
  newPhone: string;
  /** "Introduce yourself" fields — required by the server before any message. */
  introName?: string;
  introEmail?: string;
}

export interface ShareAndPatch {
  share: SendMessageInput['share'];
  patch: { name?: string; email?: string; phone?: string } | null;
}

/** True when the server would reject this user's message for a missing name or
 *  email, i.e. the composer must collect them before sending. */
export function needsIntro(me: Me | null | undefined): { name: boolean; email: boolean } {
  return { name: !me?.name?.trim(), email: !me?.email };
}

/** Builds the boolean share flags to send with a message (never raw contact
 *  values — the server attaches those from the profile) plus an optional
 *  profile PATCH body for any brand-new contact value typed inline. */
export function buildShareAndPatch(me: Me | null | undefined, state: ContactShareState): ShareAndPatch {
  const patch: { name?: string; email?: string; phone?: string } = {};
  const missing = needsIntro(me);
  if (missing.name && state.introName?.trim()) {
    patch.name = state.introName.trim();
  }
  // The introduce-yourself email is mandatory, so it wins over the optional
  // share-contact one when a user somehow fills both.
  if (missing.email && state.introEmail?.trim()) {
    patch.email = state.introEmail.trim();
  } else if (state.shareEmail && !me?.email && state.newEmail.trim()) {
    patch.email = state.newEmail.trim();
  }
  if (state.sharePhone && !me?.phone && state.newPhone.trim()) {
    patch.phone = state.newPhone.trim();
  }

  const share: NonNullable<SendMessageInput['share']> = {};
  if (state.shareEmail) share.email = true;
  if (state.sharePhone) share.phone = true;

  return {
    share: Object.keys(share).length > 0 ? share : undefined,
    patch: Object.keys(patch).length > 0 ? patch : null,
  };
}
