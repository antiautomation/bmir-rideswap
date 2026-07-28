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
  /** Epoch-ms version of the owner's profile photo, or null if none. Thumb URL:
   *  /api/listings/{id}/avatar-thumb?v={avatarVersion} */
  avatarVersion: number | null;
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
  /** Personal floor for match emails; null means "use the site default". */
  matchEmailMinScore: number | null;
  matchEmailSameDayOnly: boolean;
  phoneContactPref: 'sms' | 'whatsapp';
  recoveryCode: string;
  isAdmin: boolean;
  avatarVersion: number | null;
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
  /** Honeypot — never filled by humans; the server discards submissions that set it. */
  website?: string;
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
  counterpartAvatarVersion: number | null;
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
  counterpartAvatarVersion: number | null;
  counterpartPhonePref: 'sms' | 'whatsapp';
  messages: Message[];
}

export interface SendMessageInput {
  clientId: string;
  body: string;
  share?: { email?: boolean; phone?: boolean };
}

export interface MatchReasons {
  date: number;
  location: number;
  capacity: number;
  time: number;
  fresh: number;
  /** Days between the two travel dates (0, 1, or 2). Absent on rows scored before
   *  this field existed — consumers fall back to the date-point thresholds. */
  dateDelta?: number;
  /** Gear-fit tiers of slack between what the rider brings and what the driver can
   *  take: 0 = exact fit, 1 = one tier spare, 2+ = roomy. Absent on older rows. */
  capacityFit?: number;
  /** How the two time windows relate. Absent on older rows. */
  timing?: 'aligned' | 'partial' | 'none';
  /** To-BRC only: extra calendar days the driver spends reaching the rider's city
   *  (8h of driving per day). Present only when >= 1. */
  pickupDaysLater?: number;
  /** Present when the rider sits along the driver's route to/from BRC — the corridor
   *  detour in miles. When set, it stands in for the plain location credit. */
  detourMi?: number;
}

export interface City {
  label: string; // "Berkeley, CA"
  name: string;
  state: string;
  lat: number;
  lng: number;
}

export interface CitiesResponse {
  cities: City[];
}

export interface Match {
  driverListingId: string;
  riderListingId: string;
  score: number;
  reasons: MatchReasons;
  computedAt: string;
  myListing: { id: string; type: ListingType; name: string; travelDate: string };
  /** The counterpart's full public listing. */
  listing: Listing;
}

export interface MatchesResponse {
  matches: Match[];
  /** Global minimum score for a match to be emailed. Matches below it are shown
   *  in-app behind the "lower-quality" toggle only. */
  emailFloor: number;
}
