import { useRef, useState, type FormEvent } from 'react';
import { EmailTakenNotice } from './EmailSignInLink';
import LocationAutocomplete from './LocationAutocomplete';
import PhoneInput from './PhoneInput';
import type {
  Belongings,
  CreateListingInput,
  Direction,
  Listing,
  ListingType,
  UpdateListingInput,
} from '../api/types';

interface ListingFormProps {
  mode: 'create' | 'edit';
  initialType?: ListingType;
  /** Pre-selects the direction segment in create mode (e.g. /post?direction=from_brc). */
  initialDirection?: Direction;
  initial?: Listing;
  needsContact: boolean;
  /** Contact email the server rejected as belonging to another account (409
   *  email_taken). The form stays mounted, so nothing the user typed is lost. */
  emailTaken?: string | null;
  /** The server refused the post because the account still has no email (400
   *  email_required). Surfaced on the email field, same as email_taken. */
  emailRequired?: boolean;
  onSubmit: (input: CreateListingInput | UpdateListingInput) => void;
}

interface FormState {
  type: ListingType;
  direction: Direction;
  name: string;
  location: string;
  travelDate: string;
  timeSlot: string;
  passengerSpace: string;
  cargoSpace: Belongings;
  routeDetails: string;
  riderStuff: Belongings;
  campInfo: string;
  details: string;
  email: string;
  phone: string;
}

const MAX_DATE = '2026-12-31';

function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatBlockLabel(hour: number): string {
  const suffix = hour >= 12 ? 'pm' : 'am';
  let h = hour % 12;
  if (h === 0) h = 12;
  return `${h}${suffix}`;
}

const TIME_SLOTS: { value: string; label: string }[] = [{ value: 'flexible', label: 'Flexible time' }];
for (let hour = 0; hour < 24; hour += 3) {
  const start = hour;
  const end = hour + 3;
  const value = `${String(start).padStart(2, '0')}:00 - ${String(end === 24 ? 24 : end).padStart(2, '0')}:00`;
  const label = `${formatBlockLabel(start)} – ${end === 24 ? '12am' : formatBlockLabel(end)}`;
  TIME_SLOTS.push({ value, label });
}

const BELONGINGS_OPTIONS: { value: Belongings; label: string }[] = [
  { value: 'minimal', label: 'Minimal — a backpack' },
  { value: 'standard', label: 'Standard — a suitcase or bin' },
  { value: 'substantial', label: 'Substantial — suitcases/bins + a bike' },
  { value: 'extensive', label: 'Extensive — a truck-bed load' },
];

function buildInitialState(
  mode: 'create' | 'edit',
  initialType?: ListingType,
  initialDirection?: Direction,
  initial?: Listing,
): FormState {
  if (mode === 'edit' && initial) {
    return {
      type: initial.type,
      direction: initial.direction,
      name: initial.name,
      location: initial.location,
      travelDate: initial.travelDate,
      timeSlot: initial.timeSlot,
      passengerSpace: initial.passengerSpace !== null ? String(initial.passengerSpace) : '1',
      cargoSpace: initial.cargoSpace ?? 'standard',
      routeDetails: initial.routeDetails ?? '',
      riderStuff: initial.riderStuff ?? 'standard',
      campInfo: initial.campInfo ?? '',
      details: initial.details ?? '',
      email: '',
      phone: '',
    };
  }
  return {
    type: initialType ?? 'driver',
    direction: initialDirection ?? 'to_brc',
    name: '',
    location: '',
    travelDate: '',
    timeSlot: 'flexible',
    passengerSpace: '1',
    cargoSpace: 'standard',
    routeDetails: '',
    riderStuff: 'standard',
    campInfo: '',
    details: '',
    email: '',
    phone: '',
  };
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

/** Shared by the client-side check and the server's 400 email_required. */
const EMAIL_REQUIRED_ERROR = 'Add an email so people’s replies can reach you.';

export default function ListingForm({
  mode,
  initialType,
  initialDirection,
  initial,
  needsContact,
  emailTaken,
  emailRequired,
  onSubmit,
}: ListingFormProps) {
  const [state, setState] = useState<FormState>(() =>
    buildInitialState(mode, initialType, initialDirection, initial),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const honeypotRef = useRef<HTMLInputElement>(null);

  const today = todayLocalDate();
  const isDriver = state.type === 'driver';
  const emailError = errors.email ?? (emailRequired ? EMAIL_REQUIRED_ERROR : undefined);

  function set<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!state.name.trim()) next.name = 'Please enter a name.';
    if (!state.location.trim()) next.location = 'Please enter a location.';
    if (!state.travelDate) next.travelDate = 'Please choose a date.';
    // noValidate skips the input's own min/max, so enforce the range here —
    // a past date would post an instantly-expired, invisible listing.
    else if (state.travelDate < today) next.travelDate = 'That date has already passed — pick an upcoming one.';
    else if (state.travelDate > MAX_DATE) next.travelDate = 'That date is past the posting window.';
    if (state.direction === 'from_brc' && !state.campInfo.trim()) {
      next.campInfo = 'Camp info is required for rides leaving BRC — it helps rides find you for exodus.';
    }
    // The form is noValidate, so the required attr is semantics only — the email
    // gate lives here, matching the other required fields.
    if (needsContact && mode === 'create' && !state.email.trim()) {
      next.email = EMAIL_REQUIRED_ERROR;
    }
    return next;
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    // Create: omit empty optional text (nothing to store). Edit: send '' so the
    // server actually clears the field — omitting means "keep the old text".
    const clearable = (value: string): string | undefined =>
      mode === 'edit' ? value.trim() : value.trim() || undefined;

    const shared = {
      direction: state.direction,
      name: state.name.trim(),
      location: state.location.trim(),
      travelDate: state.travelDate,
      timeSlot: state.timeSlot,
      details: clearable(state.details),
      campInfo: clearable(state.campInfo),
      passengerSpace: isDriver ? Number(state.passengerSpace) : undefined,
      cargoSpace: isDriver ? state.cargoSpace : undefined,
      routeDetails: isDriver ? clearable(state.routeDetails) : undefined,
      riderStuff: isDriver ? undefined : state.riderStuff,
    };

    if (mode === 'create') {
      const contact =
        state.email.trim() || state.phone.trim()
          ? {
              email: state.email.trim() || undefined,
              phone: state.phone.trim() || undefined,
            }
          : undefined;

      const input: CreateListingInput = {
        clientId: crypto.randomUUID(),
        type: state.type,
        ...shared,
        ...(contact ? { contact } : {}),
        ...(honeypotRef.current?.value ? { website: honeypotRef.current.value } : {}),
      };
      onSubmit(input);
    } else {
      const input: UpdateListingInput = { ...shared };
      onSubmit(input);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {/* Honeypot: invisible to humans; bots that fill it get silently discarded server-side. */}
      <input
        ref={honeypotRef}
        type="text"
        name="website"
        className="visually-hidden"
        aria-hidden="true"
        tabIndex={-1}
        autoComplete="off"
      />
      {mode === 'create' && (
        <div className="field-group">
          <span className="field-group-label">What are you posting?</span>
          <div className="seg seg-block" role="group" aria-label="Listing type">
            <button
              type="button"
              aria-pressed={isDriver}
              onClick={() => set('type', 'driver')}
            >
              🚗 Driver
            </button>
            <button
              type="button"
              aria-pressed={!isDriver}
              onClick={() => set('type', 'rider')}
            >
              🎒 Rider
            </button>
          </div>
        </div>
      )}

      <div className="field-group">
        <span className="field-group-label">Direction</span>
        <div className="seg seg-block" role="group" aria-label="Direction">
          <button
            type="button"
            aria-pressed={state.direction === 'to_brc'}
            onClick={() => set('direction', 'to_brc')}
          >
            Going to BRC
          </button>
          <button
            type="button"
            aria-pressed={state.direction === 'from_brc'}
            onClick={() => set('direction', 'from_brc')}
          >
            Leaving BRC
          </button>
        </div>
      </div>

      <div className="field-group">
        <label htmlFor="field-name">Your name (or playa name)</label>
        <input
          id="field-name"
          type="text"
          required
          maxLength={60}
          value={state.name}
          onChange={(e) => set('name', e.target.value)}
          aria-describedby={errors.name ? 'error-name' : undefined}
          aria-invalid={Boolean(errors.name)}
        />
        {errors.name && (
          <p id="error-name" className="field-error">
            {errors.name}
          </p>
        )}
      </div>

      <div className="field-group">
        <label htmlFor="field-location">Where from / to?</label>
        <LocationAutocomplete
          id="field-location"
          required
          maxLength={80}
          value={state.location}
          onChange={(v) => set('location', v)}
          ariaDescribedBy={errors.location ? 'error-location' : undefined}
          ariaInvalid={Boolean(errors.location)}
          hint={
            state.direction === 'to_brc'
              ? 'Your actual departure city only — the app automatically finds people along your route. Adding anything else (neighborhoods, “to BRC”, notes) breaks that matching.'
              : 'Your actual destination city only — where you\u2019re headed after the burn. The app automatically finds people along your route; adding anything else breaks that matching.'
          }
        />
        {errors.location && (
          <p id="error-location" className="field-error">
            {errors.location}
          </p>
        )}
      </div>

      <div className="form-grid-2">
        <div className="field-group">
          <label htmlFor="field-date">Date</label>
          <input
            id="field-date"
            type="date"
            required
            min={today}
            max={MAX_DATE}
            value={state.travelDate}
            onChange={(e) => set('travelDate', e.target.value)}
            aria-describedby={errors.travelDate ? 'error-date' : undefined}
            aria-invalid={Boolean(errors.travelDate)}
          />
          {errors.travelDate && (
            <p id="error-date" className="field-error">
              {errors.travelDate}
            </p>
          )}
        </div>

        <div className="field-group">
          <label htmlFor="field-time">Time</label>
          <select id="field-time" value={state.timeSlot} onChange={(e) => set('timeSlot', e.target.value)}>
            {TIME_SLOTS.map((slot) => (
              <option key={slot.value} value={slot.value}>
                {slot.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isDriver ? (
        <div className="form-grid-2">
          <div className="field-group">
            <label htmlFor="field-seats">Seats available</label>
            <select
              id="field-seats"
              value={state.passengerSpace}
              onChange={(e) => set('passengerSpace', e.target.value)}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n === 5 ? '5+' : n}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label htmlFor="field-cargo">Cargo space</label>
            <select
              id="field-cargo"
              value={state.cargoSpace}
              onChange={(e) => set('cargoSpace', e.target.value as Belongings)}
            >
              {BELONGINGS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="field-group">
          <label htmlFor="field-rider-stuff">How much stuff are you bringing?</label>
          <select
            id="field-rider-stuff"
            value={state.riderStuff}
            onChange={(e) => set('riderStuff', e.target.value as Belongings)}
          >
            {BELONGINGS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {isDriver && (
        <div className="field-group">
          <label htmlFor="field-route">Route details</label>
          <textarea
            id="field-route"
            maxLength={1000}
            rows={3}
            placeholder="Stops along the way, preferred route, etc."
            value={state.routeDetails}
            onChange={(e) => set('routeDetails', e.target.value)}
          />
        </div>
      )}

      <div className="field-group">
        <label htmlFor="field-camp">
          Camp info{state.direction === 'from_brc' ? ' (required)' : ''}
        </label>
        <textarea
          id="field-camp"
          maxLength={1000}
          rows={2}
          required={state.direction === 'from_brc'}
          value={state.campInfo}
          onChange={(e) => set('campInfo', e.target.value)}
          aria-describedby={errors.campInfo ? 'error-camp' : undefined}
          aria-invalid={Boolean(errors.campInfo)}
        />
        <p className="field-hint">Camp name &amp; rough address — helps rides find you for exodus</p>
        {errors.campInfo && (
          <p id="error-camp" className="field-error">
            {errors.campInfo}
          </p>
        )}
      </div>

      <div className="field-group">
        <label htmlFor="field-details">Details</label>
        <textarea
          id="field-details"
          maxLength={1000}
          rows={3}
          placeholder="Music, stops, vibes, anything else riders/drivers should know"
          value={state.details}
          onChange={(e) => set('details', e.target.value)}
        />
      </div>

      {mode === 'create' && needsContact && (
        <div className="form-section">
          <div className="field-group">
            <span className="field-group-label">Contact info</span>
            <p className="field-hint">
              How should ride matches reach you? <strong>Never shown publicly</strong> — only
              shared if you choose to share it in a message.
            </p>
          </div>

          <div className="field-group">
            <label htmlFor="field-email">Email (required)</label>
            <input
              id="field-email"
              type="email"
              required
              value={state.email}
              onChange={(e) => set('email', e.target.value)}
              aria-describedby={emailError ? 'hint-email error-email' : 'hint-email'}
              aria-invalid={Boolean(emailError)}
            />
            <p id="hint-email" className="field-hint">
              Required — it&rsquo;s how replies reach you. We&rsquo;ll email you once with your
              sign-in link when you post; after that, only the message &amp; match updates you
              choose. Unsubscribing forever is one click.
            </p>
            {emailError && (
              <p id="error-email" className="field-error">
                {emailError}
              </p>
            )}
            {emailTaken && <EmailTakenNotice key={emailTaken} email={emailTaken} />}
          </div>

          <div className="field-group">
            <label htmlFor="field-phone">Phone (optional)</label>
            <PhoneInput
              id="field-phone"
              value={state.phone}
              onChange={(v) => set('phone', v)}
              ariaDescribedBy={errors.phone ? 'error-phone' : undefined}
            />
          <p className="field-hint">
            Optional, but nice to have — once you match, you can share it in a message at your
            discretion, and it becomes one-tap call / text / WhatsApp links for your ride.
          </p>
            {errors.phone && (
              <p id="error-phone" className="field-error">
                {errors.phone}
              </p>
            )}
          </div>
        </div>
      )}

      <button type="submit" className="btn form-submit">
        {mode === 'create' ? 'Post listing' : 'Save changes'}
      </button>
    </form>
  );
}
