import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import AvatarUpload from '../components/AvatarUpload';
import { EmailSignInLinkForm, EmailTakenNotice } from '../components/EmailSignInLink';
import EmptyState from '../components/EmptyState';
import PhoneInput from '../components/PhoneInput';
import ListingCard from '../components/ListingCard';
import { api, ApiError } from '../api/client';
import { cancelListing, deleteListing, useMyListings } from '../api/listings';
import { useMe } from '../api/session';
import type { DigestFrequency, Me } from '../api/types';
import { resetServerPrefs, useIdSet } from '../lib/prefs';

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
  const [status, setStatus] = useState<
    'idle' | 'busy' | 'success' | 'not_found' | 'rate_limited' | 'failed'
  >('idle');

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!code.trim()) return;
    setStatus('busy');
    try {
      await api<{ me: Me }>('/api/session/recover', { method: 'POST', body: { code: code.trim() } });
      resetServerPrefs(); // stars/hidden of the old session must not bleed into this one
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
        setStatus('failed');
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
          placeholder="e.g. dusty-camel-lantern"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-label="Session code"
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
      {status === 'failed' && (
        <p className="form-note form-note--error">
          Couldn&rsquo;t recover with that code — it may be mistyped, banned, or unavailable
        </p>
      )}
      <EmailSignInLinkForm />
    </section>
  );
}

function ContactSection({ me }: { me: Me | null }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(me?.name ?? '');
  const [email, setEmail] = useState(me?.email ?? '');
  const [phone, setPhone] = useState(me?.phone ?? '');
  const [digestFrequency, setDigestFrequency] = useState<DigestFrequency>(me?.digestFrequency ?? 'hourly');
  const [phoneContactPref, setPhoneContactPref] = useState<'sms' | 'whatsapp'>(me?.phoneContactPref ?? 'sms');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState<string | null>(null);

  async function handleSave(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setSaving(true);
    setEmailTaken(null);
    setSaveError(null);
    try {
      await api('/api/me', {
        method: 'PATCH',
        body: { name, email, phone, digestFrequency, phoneContactPref },
      });
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      // The address is on someone else's account — keep every field as typed and
      // offer the way into that account instead.
      if (err instanceof ApiError && err.status === 409 && err.code === 'email_taken') {
        setEmailTaken(email.trim());
      } else if (err instanceof ApiError && err.code === 'invalid_phone') {
        setSaveError('That phone number doesn’t look right — check it and try again');
      } else {
        setSaveError('Save failed — check your connection and try again');
      }
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
          {emailTaken && <EmailTakenNotice key={emailTaken} email={emailTaken} />}
        </div>
        <div className="field-group">
          <label htmlFor="profile-phone">Phone</label>
          <PhoneInput id="profile-phone" disabled={!me} value={phone} onChange={setPhone} />
        </div>
        <div className="field-group">
          <span className="field-group-label">How should people text you?</span>
          <div className="seg" role="group" aria-label="Preferred texting app">
            <button
              type="button"
              disabled={!me}
              aria-pressed={phoneContactPref === 'sms'}
              onClick={() => setPhoneContactPref('sms')}
            >
              💬 SMS / iMessage
            </button>
            <button
              type="button"
              disabled={!me}
              aria-pressed={phoneContactPref === 'whatsapp'}
              onClick={() => setPhoneContactPref('whatsapp')}
            >
              🟢 WhatsApp
            </button>
          </div>
          <p className="field-hint">
            When you share your number in a message, the &ldquo;text me&rdquo; link opens this app.
          </p>
        </div>
        <div className="field-group">
          <label htmlFor="profile-digest">Email me about new messages &amp; matches</label>
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
        {saveError && <p className="form-note form-note--error">{saveError}</p>}
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
        'Make sure you saved your session code above (or have your email on your profile) — you need one of them to get back in. Sign out?',
      )
    ) {
      return;
    }
    await api('/api/session/logout', { method: 'POST' });
    resetServerPrefs();
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
