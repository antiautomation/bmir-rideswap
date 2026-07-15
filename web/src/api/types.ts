export type ListingType = 'driver' | 'rider';
export type Direction = 'to_brc' | 'from_brc';
export type Belongings = 'minimal' | 'standard' | 'substantial' | 'extensive';
export type DigestFrequency = 'instant' | 'hourly' | 'daily' | 'off';

export const BELONGINGS_ORDER: Record<Belongings, number> = {
  minimal: 1,
  standard: 2,
  substantial: 3,
  extensive: 4,
};

export interface Listing {
  id: string;
  type: ListingType;
  direction: Direction;
  name: string;
  location: string;
  travelDate: string; // YYYY-MM-DD
  timeSlot: string; // 'flexible' | 'HH:00 - HH:00'
  details: string | null;
  campInfo: string | null;
  passengerSpace: number | null;
  cargoSpace: Belongings | null;
  routeDetails: string | null;
  riderStuff: Belongings | null;
  expiresAt: string;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  isMine: boolean;
  /** Client-only: present on optimistic entries queued in the outbox. */
  pending?: boolean;
}

export interface ListingsResponse {
  listings: Listing[];
  serverTime: string;
}

export interface Me {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  digestFrequency: DigestFrequency;
  recoveryCode: string;
  isAdmin: boolean;
  unreadCount: number;
}

export interface CreateListingInput {
  clientId: string;
  type: ListingType;
  direction: Direction;
  name: string;
  location: string;
  travelDate: string;
  timeSlot: string;
  details?: string;
  campInfo?: string;
  passengerSpace?: number;
  cargoSpace?: Belongings;
  routeDetails?: string;
  riderStuff?: Belongings;
  contact?: { email?: string; phone?: string };
}

export type UpdateListingInput = Partial<Omit<CreateListingInput, 'clientId' | 'type' | 'contact'>>;

export interface Message {
  id: string;
  conversationId: string;
  isMine: boolean;
  body: string;
  /** Contact snapshots — present only when the sender chose to share. */
  sharedEmail: string | null;
  sharedPhone: string | null;
  createdAt: string;
  /** Client-only: optimistic entries queued in the outbox. */
  pending?: boolean;
}

export interface ConversationListing {
  id: string;
  type: ListingType;
  direction: Direction;
  name: string;
  travelDate: string;
  cancelledAt: string | null;
}

export interface ConversationSummary {
  id: string;
  listing: ConversationListing;
  /** True when I started this conversation (vs. it being about my listing). */
  iAmInitiator: boolean;
  counterpartName: string;
  lastMessage: { body: string; createdAt: string; isMine: boolean } | null;
  unreadCount: number;
  createdAt: string;
}

export interface ConversationsResponse {
  conversations: ConversationSummary[];
}

export interface ThreadResponse {
  conversation: { id: string };
  listing: ConversationListing;
  counterpartName: string;
  messages: Message[];
}

export interface SendMessageInput {
  clientId: string;
  body: string;
  share?: { email?: boolean; phone?: boolean };
}
