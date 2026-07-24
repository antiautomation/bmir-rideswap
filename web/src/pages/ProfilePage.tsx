import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import AvatarUpload from '../components/AvatarUpload';
import EmptyState from '../components/EmptyState';
import PhoneInput from '../components/PhoneInput';
import ListingCard from '../components/ListingCard';
import { api, ApiError } from '../api/client';
import { cancelListing, deleteListing, useMyListings } from '../api/listings';
import { useMe } from '../api/session';
import type { DigestFrequency, Me } from '../api/types';
import { useIdSet } from '../lib/prefs';

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const DIGEST_OPTIONS: { value: DigestFrequency; label: string }[] = [
  { value: 'instant', label: 'Instantly' },
  { value: 'hourly', label: 'Hourly (recommended)' },
  { value: 'daily', label: 'Daily' },
  { value: 'off', label: 'Never' },
];

function RecoverSessionSection({ me }: { me: Me | null }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'busy' | 'success' | 'not_found' | 'rate_limited'>(
    'idle',
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!code.trim()) return;
    setStatus('busy');
    try {
      await api<{ me: Me }>('/api/session/recover', { method: 'POST', body: { code: code.trim() } });
      queryClient.clear();
      await queryClient.invalidateQueries();
      setStatus('success');
      setCode('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setStatus('not_found');
      } else if (err instanceof ApiError && err.status === 429) {
        setStatus('rate_limited');
      } else {
        setStatus('idle');
      }
    }
  }

  return (
    <section className="card profile-section">
      <h2>Recover a session</h2>
      {me && (
        <p className="field-hint">
          Recovering switches this device to the other session. The code shown above still works
          to switch back.
        </p>
      )}
      <form className="recover-row" onSubmit={(e) => void handleSubmit(e)}>
        <input
          type="text"
          placeholder="e.g. dusty-camel-8214"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-label="Recovery code"
        />
        <button type="submit" className="btn-secondary" disabled={status === 'busy'}>
          Recover
        </button>
      </form>
      {status === 'success' && <p className="form-note form-note--success">Session recovered ✓</p>}
      {status === 'not_found' && (
        <p className="form-note form-note--error">Code not found — check the spelling</p>
      )}
      {status === 'rate_limited' && (
        <p className="form-note form-note--error">Too many attempts — try again in an hour</p>
      )}
    </section>
  );
}

function ContactSection({ me }: { me: Me | null }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(me?.name ?? '');
  const [email, setEmail] = useState(me?.email ?? '');
  const [phone, setPhone] = useState(me?.phone ?? '');
  const [digestFrequency, setDigestFrequency] = useState<DigestFrequency>(me?.digestFrequency ?? 'hourly');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setSaving(true);
    try {
      await api('/api/me', {
        method: 'PATCH',
        body: { name, email, phone, digestFrequency },
      });
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card profile-section">
      <h2>Contact &amp; notifications</h2>
      {!me && <p className="field-hint">Post a listing or recover a session to manage contact info.</p>}
      <form className="form" onSubmit={(e) => void handleSave(e)}>
        <div className="field-group">
          <label htmlFor="profile-name">Name</label>
          <input
            id="profile-name"
            type="text"
            maxLength={60}
            disabled={!me}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field-group">
          <label htmlFor="profile-email">Email</label>
          <input
            id="profile-email"
            type="email"
            disabled={!me}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="field-hint">Used for message notifications. Never displayed publicly.</p>
        </div>
        <div className="field-group">
          <label htmlFor="profile-phone">Phone</label>
          <PhoneInput id="profile-phone" disabled={!me} value={phone} onChange={setPhone} />
        </div>
        <div className="field-group">
          <label htmlFor="profile-digest">Email me about new messages</label>
          <select
            id="profile-digest"
            disabled={!me}
            value={digestFrequency}
            onChange={(e) => setDigestFrequency(e.target.value as DigestFrequency)}
          >
            {DIGEST_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn" disabled={!me || saving}>
          Save
        </button>
        {saved && <p className="form-note form-note--success">Saved ✓</p>}
      </form>
    </section>
  );
}

export default function ProfilePage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: myListingsData, isLoading } = useMyListings();
  const favorites = useIdSet('ridefinder-favorites-v1');
  const [copied, setCopied] = useState(false);

  const listings = myListingsData?.listings ?? [];

  async function handleCopy(code: string): Promise<void> {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleSignOut(): Promise<void> {
    if (
      !window.confirm(
        'Make sure you saved your session code above — it is the only way back in. Sign out?',
      )
    ) {
      return;
    }
    await api('/api/session/logout', { method: 'POST' });
    queryClient.clear();
    navigate('/');
  }

  return (
    <div className="profile-page">
      <h1>You</h1>

      <section className="card profile-section">
        <h2>Session code</h2>
        {me ? (
          <>
            <p className="field-hint">Your session code</p>
            <p className="code-block">{me.recoveryCode}</p>
            <button
              type="button"
              className="btn-secondary btn-block"
              onClick={() => void handleCopy(me.recoveryCode)}
            >
              {copied ? 'Copied ✓' : 'Copy code'}
            </button>
            <p className="field-hint">Works on any device — this is your login.</p>
          </>
        ) : (
          <p className="field-hint">
            No session yet — post a listing to start one, or recover an existing session below.
          </p>
        )}
      </section>

      <section className="card profile-section">
        <h2>Profile photo</h2>
        <AvatarUpload key={me?.id ?? 'anon'} me={me ?? null} />
      </section>

      <RecoverSessionSection me={me ?? null} />

      <section className="card profile-section">
        <h2>My listings</h2>
        {isLoading ? (
          <p className="board-loading">Loading…</p>
        ) : listings.length === 0 ? (
          <EmptyState title="You haven't posted any listings yet" hint="Post a ride to see it here" />
        ) : (
          listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              isFavorite={favorites.has(listing.id)}
              onToggleFavorite={favorites.toggle}
              onCancel={!listing.cancelledAt ? (id) => cancelListing(queryClient, id) : undefined}
              onDelete={(id) => deleteListing(queryClient, id)}
              onFlag={undefined}
            />
          ))
        )}
      </section>

      {/* key remounts the form when the session loads/switches, so fields
          initialize from real profile values instead of a loading-time null. */}
      <ContactSection key={me?.id ?? 'anon'} me={me ?? null} />

      <div className="profile-signout">
        <button type="button" className="btn-danger" onClick={() => void handleSignOut()}>
          Sign out
        </button>
      </div>
    </div>
  );
}
