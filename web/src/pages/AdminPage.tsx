import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { useMe } from '../api/session';
import type { Direction, ListingType } from '../api/types';
import EmptyState from '../components/EmptyState';
import AdminOutreachTab from './AdminOutreachTab';

/* ---------- Types (mirror server/src/routes/admin.ts response shapes) ---------- */

type AdminTab = 'overview' | 'users' | 'listings' | 'messages' | 'flags' | 'metrics' | 'emails' | 'outreach' | 'settings';
type ListingStateFilter = 'all' | 'active' | 'hidden' | 'cancelled' | 'deleted' | 'expired';

interface Overview {
  users: number;
  activeListings: number;
  hiddenListings: number;
  messages24h: number;
  emails24h: number;
  totalFlags: number;
}

interface FlagRow {
  flagId: string;
  reason: string | null;
  createdAt: string;
  listingId: string;
  listingName: string;
  listingType: ListingType;
  hiddenAt: string | null;
  deletedAt: string | null;
  ownerBanned: boolean;
  ownerId: string;
}

interface EmailRow {
  id: string;
  toEmail: string;
  kind: string;
  subject: string;
  sentAt: string;
}

interface SuppressionRow {
  email: string;
  reason: string;
  createdAt: string;
}

interface AdminUserRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isAdmin: boolean;
  bannedAt: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  hasAvatar: boolean;
  listingCount: number;
  messageCount: number;
  flagsAgainst: number;
}

interface AdminUserDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  recoveryCode: string;
  digestFrequency: string;
  isAdmin: boolean;
  bannedAt: string | null;
  hasAvatar: boolean;
  createdAt: string;
  lastSeenAt: string | null;
}

interface AdminListingRow {
  id: string;
  type: ListingType;
  direction: Direction;
  name: string;
  locationRaw: string;
  travelDate: string;
  details?: string | null;
  createdAt: string;
  expiresAt: string | null;
  cancelledAt: string | null;
  deletedAt: string | null;
  hiddenAt: string | null;
  flagCount: number;
  ownerId?: string;
  ownerName?: string;
  ownerBanned?: boolean;
}

interface AdminMessageInThread {
  id: string;
  fromThisUser: boolean;
  senderName: string;
  body: string;
  hasPhoto: boolean;
  sharedEmail: string | null;
  sharedPhone: string | null;
  createdAt: string;
}

interface AdminConversation {
  id: string;
  listingId: string;
  listingName: string;
  counterpartId: string;
  counterpartName: string;
  counterpartBanned: boolean;
  createdAt: string;
  messages: AdminMessageInThread[];
}

interface AdminUserDetailResponse {
  user: AdminUserDetail;
  listings: AdminListingRow[];
  conversations: AdminConversation[];
}

interface AdminMessageRow {
  id: string;
  body: string;
  hasPhoto: boolean;
  sharedEmail: string | null;
  sharedPhone: string | null;
  createdAt: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderBanned: boolean;
  recipientId: string;
  recipientName: string;
  listingId: string;
  listingName: string;
}

interface MetricsRow {
  day: string;
  [k: string]: string | number;
}

interface MetricsResponse {
  days: number;
  traffic: MetricsRow[];
  activity: MetricsRow[];
  referrers: { referrer_host: string; visitors: number | string }[];
  regions: { region: string; visitors: number | string }[];
  topPaths: { path: string; views: number | string }[];
  totals: { visitors: number | string; pageviews: number | string; users: number | string; messages: number | string; matches: number | string };
}

interface RateLimits {
  messagesPerHour: number;
  newConversationsPerHour: number;
  listingFlagsPerHour: number;
  avatarUploadsPerHour: number;
  anonSessionsPerHour: number;
  recoveriesPerHour: number;
  magicLinksPerHour: number;
  emailLoginLinksPerHour: number;
}

interface AppConfig {
  magicLinkDays: number;
  sessionDays: number;
  flagAutoHideThreshold: number;
  maxListingsPerDay: number;
  maxActiveListingsPerDirection: number;
  expiryGraceHours: number;
  flexibleExpiryGraceHours: number;
}

interface MatchingConfig {
  datePointsSameDay: number;
  datePointsOneDayApart: number;
  datePointsTwoDaysApart: number;
  capacityPointsPerfect: number;
  capacityPointsGood: number;
  capacityPointsRoomy: number;
  locationPointsExact: number;
  timePointsAligned: number;
  freshPoints: number;
  scoreCapOneDayApart: number;
  scoreCapTwoDaysApart: number;
  minMatchScore: number;
  minEmailScore: number;
}

interface SettingsResponse {
  rateLimits: RateLimits;
  defaults: RateLimits;
  appConfig: AppConfig;
  appConfigDefaults: AppConfig;
  matching: MatchingConfig;
  matchingDefaults: MatchingConfig;
}

/* ---------- Small shared helpers ---------- */

/** Debounces a fast-changing value (search inputs) so we don't query on every keystroke. */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function toNum(v: string | number | undefined): number {
  return typeof v === 'number' ? v : Number(v ?? 0);
}

function fmtDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : '—';
}

/** Attached photos are user-generated content, so moderation has to see the image
 *  itself, not a note that one exists. The photo route lets admins through the
 *  participant check, so the thumb loads here; it links to the full size. */
function AdminMessagePhoto({ messageId }: { messageId: string }) {
  return (
    <a
      href={`/api/messages/${messageId}/photo`}
      target="_blank"
      rel="noopener noreferrer"
      className="admin-msg-photo"
    >
      <img src={`/api/messages/${messageId}/photo-thumb`} alt="Attached photo" loading="lazy" />
    </a>
  );
}

/** Renders leaked-contact info in a security-review conversation (the whole point of this view). */
function SharedContact({ email, phone }: { email: string | null; phone: string | null }) {
  if (!email && !phone) return null;
  return (
    <span className="admin-shared">
      {email && <span>✉️ {email}</span>}
      {phone && <span>📞 {phone}</span>}
    </span>
  );
}

function StatePills({ l }: { l: Pick<AdminListingRow, 'hiddenAt' | 'cancelledAt' | 'deletedAt' | 'expiresAt'> }) {
  const expired = l.expiresAt != null && Date.parse(l.expiresAt) < Date.now();
  return (
    <>
      {l.hiddenAt && <span className="pill pill-warn">hidden</span>}
      {l.cancelledAt && <span className="pill pill-dim">cancelled</span>}
      {l.deletedAt && <span className="pill pill-dim">deleted</span>}
      {expired && !l.deletedAt && <span className="pill pill-dim">expired</span>}
    </>
  );
}

/** Hide/Unhide, Restore, Delete, Open — the moderation actions every listing row needs. */
function ListingActions({ listing, onChanged }: { listing: AdminListingRow; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  async function run(path: string): Promise<void> {
    setBusy(true);
    try {
      await api(path, { method: 'POST', body: {} });
      onChanged();
    } catch {
      window.alert('Action failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-row admin-actions">
      {listing.hiddenAt ? (
        <button className="btn-ghost" disabled={busy} onClick={() => void run(`/api/admin/listings/${listing.id}/unhide`)}>
          Unhide
        </button>
      ) : (
        <button className="btn-ghost" disabled={busy} onClick={() => void run(`/api/admin/listings/${listing.id}/hide`)}>
          Hide
        </button>
      )}
      {listing.deletedAt && (
        <button className="btn-ghost" disabled={busy} onClick={() => void run(`/api/admin/listings/${listing.id}/restore`)}>
          Restore
        </button>
      )}
      {!listing.deletedAt && (
        <button
          className="btn-danger"
          disabled={busy}
          onClick={() => {
            if (window.confirm(`Delete listing "${listing.name}"?`)) void run(`/api/admin/listings/${listing.id}/delete`);
          }}
        >
          Delete
        </button>
      )}
      <Link className="btn-ghost" to={`/listing/${listing.id}/edit`}>
        Edit
      </Link>
      <Link className="btn-ghost" to={`/listing/${listing.id}`}>
        Open ↗
      </Link>
    </div>
  );
}

/* ---------- Claim gate (unchanged) ---------- */

function ClaimForm() {
  const queryClient = useQueryClient();
  const [key, setKey] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/api/admin/claim', { method: 'POST', body: { key } });
      setStatus('Claimed — reloading…');
      await queryClient.invalidateQueries();
    } catch (err) {
      setStatus(err instanceof ApiError && err.status === 403 ? 'Wrong key.' : 'Failed — try again later.');
    }
  }

  return (
    <form className="card admin-claim" onSubmit={submit}>
      <h2>Admin access</h2>
      <p className="muted">Enter the ADMIN_KEY to promote this session.</p>
      <div className="admin-row">
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Admin key" />
        <button type="submit" className="btn-secondary">
          Claim
        </button>
      </div>
      {status && <p className="muted">{status}</p>}
    </form>
  );
}

/* ---------- Tab bar ---------- */

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'listings', label: 'Listings' },
  { id: 'messages', label: 'Messages' },
  { id: 'flags', label: 'Flags' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'emails', label: 'Emails' },
  { id: 'outreach', label: 'Outreach' },
  { id: 'settings', label: 'Settings' },
];

function TabBar({ active, onChange }: { active: AdminTab; onChange: (t: AdminTab) => void }) {
  return (
    <div className="seg admin-tabs" role="tablist">
      {TABS.map((t) => (
        <button key={t.id} type="button" aria-pressed={active === t.id} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Overview tab ---------- */

function OverviewTab({
  onGoUsers,
  onGoListings,
  onGoMessages,
  onGoEmails,
  onGoFlags,
}: {
  onGoUsers: () => void;
  onGoListings: (state: ListingStateFilter) => void;
  onGoMessages: () => void;
  onGoEmails: () => void;
  onGoFlags: () => void;
}) {
  const overview = useQuery({ queryKey: ['admin-overview'], queryFn: () => api<Overview>('/api/admin/overview') });

  const [testTo, setTestTo] = useState('');
  const [testStatus, setTestStatus] = useState<string | null>(null);

  async function sendTest(e: FormEvent): Promise<void> {
    e.preventDefault();
    setTestStatus('Sending…');
    try {
      const res = await api<{ sent: boolean; dryRun: boolean }>('/api/admin/test-email', {
        method: 'POST',
        body: { to: testTo },
      });
      setTestStatus(res.dryRun ? 'Sent (DRY RUN — check server logs)' : res.sent ? 'Sent for real ✓' : 'Suppressed address');
    } catch {
      setTestStatus('Failed');
    }
  }

  if (overview.isLoading) return <p className="muted">Loading…</p>;
  if (overview.isError || !overview.data) {
    return (
      <div className="admin-error">
        <p className="muted">Failed to load.</p>
        <button className="btn-secondary" onClick={() => void overview.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const o = overview.data;
  return (
    <>
      <div className="admin-stats">
        <button className="card admin-stat" onClick={onGoUsers}>
          <span className="admin-stat-value">👤 {o.users}</span>
          <span className="admin-stat-label">users</span>
        </button>
        <button className="card admin-stat" onClick={() => onGoListings('active')}>
          <span className="admin-stat-value">📋 {o.activeListings}</span>
          <span className="admin-stat-label">active listings</span>
        </button>
        <button className="card admin-stat" onClick={() => onGoListings('hidden')}>
          <span className="admin-stat-value">🙈 {o.hiddenListings}</span>
          <span className="admin-stat-label">hidden</span>
        </button>
        <button className="card admin-stat" onClick={onGoMessages}>
          <span className="admin-stat-value">💬 {o.messages24h}</span>
          <span className="admin-stat-label">msgs/24h</span>
        </button>
        <button className="card admin-stat" onClick={onGoEmails}>
          <span className="admin-stat-value">✉️ {o.emails24h}</span>
          <span className="admin-stat-label">emails/24h</span>
        </button>
        <button className="card admin-stat" onClick={onGoFlags}>
          <span className="admin-stat-value">🚩 {o.totalFlags}</span>
          <span className="admin-stat-label">flags</span>
        </button>
      </div>

      <section className="card">
        <h2>Test email</h2>
        <form className="admin-row" onSubmit={sendTest}>
          <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" required />
          <button type="submit" className="btn-secondary">
            Send test
          </button>
        </form>
        {testStatus && <p className="muted">{testStatus}</p>}
      </section>
    </>
  );
}

/* ---------- Users tab ---------- */

function UserDetail({ userId, onBack, onViewUser }: { userId: string; onBack: () => void; onViewUser: (id: string) => void }) {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const detail = useQuery({
    queryKey: ['admin-user-detail', userId],
    queryFn: () => api<AdminUserDetailResponse>(`/api/admin/users/${userId}`),
  });
  const [busy, setBusy] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  function refreshAll(): void {
    void queryClient.invalidateQueries({ queryKey: ['admin-user-detail', userId] });
    void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-flags'] });
  }

  async function toggleBan(banned: boolean): Promise<void> {
    if (!window.confirm(banned ? 'Unban this user?' : 'Ban this user and hide all their listings?')) return;
    setBusy(true);
    try {
      await api(`/api/admin/users/${userId}/${banned ? 'unban' : 'ban'}`, { method: 'POST', body: {} });
      refreshAll();
    } catch {
      window.alert('Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleAdmin(isAdmin: boolean): Promise<void> {
    const msg = isAdmin
      ? 'Revoke admin from this user? They keep their account; they just lose the console.'
      : 'Make this user an admin? They will see the FULL console: every user, every private message thread, bans, and settings. Only for people you trust completely.';
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      await api(`/api/admin/users/${userId}/${isAdmin ? 'demote' : 'promote'}`, { method: 'POST', body: {} });
      refreshAll();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'cannot_demote_self') window.alert('You cannot revoke your own admin access.');
      else if (err instanceof ApiError && err.code === 'cannot_promote_banned') window.alert('Unban this user before making them an admin.');
      else window.alert('Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser(): Promise<void> {
    if (!window.confirm('This permanently deletes the user and all their listings, messages, and flags. This cannot be undone.')) return;
    const typed = window.prompt('Type "delete" to confirm.');
    if (typed?.trim().toLowerCase() !== 'delete') return;
    setBusy(true);
    try {
      await api(`/api/admin/users/${userId}`, { method: 'DELETE' });
      refreshAll();
      onBack();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'cannot_delete_admin') window.alert('Cannot delete an admin user.');
      else if (err instanceof ApiError && err.code === 'cannot_delete_self') window.alert('Cannot delete your own account.');
      else window.alert('Delete failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveContact(): Promise<void> {
    setBusy(true);
    try {
      await api(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: { email: contactEmail.trim(), phone: contactPhone.trim() },
      });
      setEditingContact(false);
      refreshAll();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'email_taken') window.alert('That email is already on another account.');
      else if (err instanceof ApiError && err.code === 'invalid_phone') window.alert("That phone number doesn't look valid.");
      else window.alert('Save failed');
    } finally {
      setBusy(false);
    }
  }

  if (detail.isLoading) return <p className="muted">Loading…</p>;
  if (detail.isError || !detail.data) {
    return (
      <div className="admin-error">
        <p className="muted">Failed to load.</p>
        <button className="btn-secondary" onClick={() => void detail.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const { user, listings, conversations } = detail.data;

  return (
    <div className="admin-detail">
      <button className="btn-ghost" onClick={onBack}>
        ← Back to users
      </button>

      <section className="card admin-profile-card">
        <h2>
          {user.name} {user.isAdmin && <span title="Admin">👑</span>} {user.bannedAt && <span className="pill pill-warn">banned</span>}
        </h2>
        <dl className="admin-dl">
          <dt>Email</dt>
          <dd>
            {editingContact ? (
              <input
                type="email"
                aria-label="User email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            ) : (
              (user.email ?? '—')
            )}
          </dd>
          <dt>Phone</dt>
          <dd>
            {editingContact ? (
              <input
                type="tel"
                aria-label="User phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            ) : (
              (user.phone ?? '—')
            )}
          </dd>
          <dt>Session code</dt>
          <dd>
            <code>{user.recoveryCode}</code>
          </dd>
          <dt>Digest</dt>
          <dd>{user.digestFrequency}</dd>
          <dt>Photo</dt>
          <dd>{user.hasAvatar ? 'Yes' : 'No'}</dd>
          <dt>Joined</dt>
          <dd>{fmtDateTime(user.createdAt)}</dd>
          <dt>Last seen</dt>
          <dd>{fmtDateTime(user.lastSeenAt)}</dd>
        </dl>
        <div className="admin-row">
          {editingContact ? (
            <>
              <button className="btn" disabled={busy} onClick={() => void saveContact()}>
                Save contact
              </button>
              <button className="btn-ghost" disabled={busy} onClick={() => setEditingContact(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() => {
                setContactEmail(user.email ?? '');
                setContactPhone(user.phone ?? '');
                setEditingContact(true);
              }}
            >
              ✏️ Edit contact
            </button>
          )}
          {!user.isAdmin && (
            <button className="btn-danger" disabled={busy} onClick={() => void toggleBan(Boolean(user.bannedAt))}>
              {user.bannedAt ? 'Unban' : 'Ban'}
            </button>
          )}
          {user.isAdmin
            ? user.id !== me?.id && (
                <button className="btn-danger" disabled={busy} onClick={() => void toggleAdmin(true)}>
                  Revoke admin
                </button>
              )
            : !user.bannedAt && (
                <button className="btn-secondary" disabled={busy} onClick={() => void toggleAdmin(false)}>
                  👑 Make admin
                </button>
              )}
          <button className="btn-danger" disabled={busy} onClick={() => void deleteUser()}>
            Delete user + all data
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Listings ({listings.length})</h2>
        {listings.length === 0 && <p className="muted">No listings.</p>}
        {listings.map((l) => (
          <div key={l.id} className="admin-listing-row">
            <div className="admin-listing-info">
              <strong>
                {l.type === 'driver' ? '🚗' : '🎒'} {l.name}
              </strong>{' '}
              <span className="muted">
                {l.locationRaw} · {l.travelDate}
              </span>
              <div>
                <StatePills l={l} />
                {l.flagCount > 0 && <span className="pill pill-warn">🚩 {l.flagCount}</span>}
              </div>
            </div>
            <ListingActions listing={l} onChanged={refreshAll} />
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Conversations ({conversations.length})</h2>
        {conversations.length === 0 && <p className="muted">No conversations.</p>}
        {conversations.map((c) => (
          <details key={c.id} className="admin-conversation">
            <summary>
              with{' '}
              <button className="btn-ghost admin-inline-link" onClick={() => onViewUser(c.counterpartId)}>
                {c.counterpartName}
              </button>
              {c.counterpartBanned && <span className="pill pill-warn">banned</span>} · {c.listingName} · {c.messages.length} messages
            </summary>
            <div className="admin-thread">
              {c.messages.map((m) => (
                <div key={m.id} className={m.fromThisUser ? 'admin-msg admin-msg--mine' : 'admin-msg'}>
                  <div className="admin-msg-head">
                    <strong>{m.senderName}</strong> <span className="muted">{fmtDateTime(m.createdAt)}</span>
                  </div>
                  <div className="admin-msg-body">{m.body}</div>
                  {m.hasPhoto && <AdminMessagePhoto messageId={m.id} />}
                  <SharedContact email={m.sharedEmail} phone={m.sharedPhone} />
                </div>
              ))}
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}

function UsersTab({ selectedUserId, onSelectUser }: { selectedUserId: string | null; onSelectUser: (id: string | null) => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 300);
  const [showUnvalidated, setShowUnvalidated] = useState(false);
  const [banCode, setBanCode] = useState('');
  const [banStatus, setBanStatus] = useState<string | null>(null);
  const [banBusy, setBanBusy] = useState(false);

  const users = useQuery({
    queryKey: ['admin-users', debouncedSearch, showUnvalidated],
    queryFn: () =>
      api<{ users: AdminUserRow[] }>(
        `/api/admin/users?q=${encodeURIComponent(debouncedSearch)}${showUnvalidated ? '&includeUnvalidated=1' : ''}`,
      ),
    enabled: selectedUserId === null,
  });

  async function banByCode(e: FormEvent): Promise<void> {
    e.preventDefault();
    const code = banCode.trim();
    if (!code) return;
    if (!window.confirm(`Ban the user with session code "${code}"?`)) return;
    setBanBusy(true);
    setBanStatus(null);
    try {
      const res = await api<{ ok: true; userId: string; name: string }>('/api/admin/ban-by-code', {
        method: 'POST',
        body: { code },
      });
      setBanStatus(`Banned ${res.name}`);
      setBanCode('');
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
    } catch (err) {
      setBanStatus(err instanceof ApiError && err.status === 404 ? 'No user with that code' : 'Failed — try again');
    } finally {
      setBanBusy(false);
    }
  }

  if (selectedUserId) {
    return <UserDetail userId={selectedUserId} onBack={() => onSelectUser(null)} onViewUser={onSelectUser} />;
  }

  return (
    <div className="admin-detail">
      <div className="admin-toolbar">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, or session code…"
          className="admin-search"
        />
        <form className="admin-row" onSubmit={banByCode}>
          <input
            value={banCode}
            onChange={(e) => setBanCode(e.target.value)}
            placeholder="dusty-camel-lantern"
            className="admin-ban-input"
          />
          <button type="submit" className="btn-danger" disabled={banBusy || !banCode.trim()}>
            Ban by code
          </button>
        </form>
      </div>
      {banStatus && <p className="muted">{banStatus}</p>}
      <label className="admin-toggle">
        <input
          type="checkbox"
          checked={showUnvalidated}
          onChange={(e) => setShowUnvalidated(e.target.checked)}
        />{' '}
        Show unvalidated users <span className="muted">(sessions with no email and no activity — usually failed post attempts)</span>
      </label>

      {users.isLoading && <p className="muted">Loading…</p>}
      {users.isError && (
        <div className="admin-error">
          <p className="muted">Failed to load.</p>
          <button className="btn-secondary" onClick={() => void users.refetch()}>
            Retry
          </button>
        </div>
      )}
      {users.data && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Listings</th>
                <th>Msgs</th>
                <th>Flags</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {users.data.users.map((u) => (
                <tr key={u.id} className="admin-table-row" onClick={() => onSelectUser(u.id)}>
                  <td>
                    {u.name} {u.isAdmin && <span title="Admin">👑</span>} {u.bannedAt && <span className="pill pill-warn">⛔</span>}{' '}
                    {u.hasAvatar && <span title="Has photo">📸</span>}
                  </td>
                  <td>{u.email ?? '—'}</td>
                  <td>{u.listingCount}</td>
                  <td>{u.messageCount}</td>
                  <td>{u.flagsAgainst > 0 ? <span className="pill pill-warn">{u.flagsAgainst}</span> : u.flagsAgainst}</td>
                  <td>{u.lastSeenAt ? fmtDateTime(u.lastSeenAt) : '—'}</td>
                </tr>
              ))}
              {users.data.users.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- Listings tab ---------- */

const LISTING_STATES: { id: ListingStateFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'hidden', label: 'Hidden' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'deleted', label: 'Deleted' },
  { id: 'expired', label: 'Expired' },
];

function ListingsTab({
  stateFilter,
  onStateFilterChange,
  onViewUser,
}: {
  stateFilter: ListingStateFilter;
  onStateFilterChange: (s: ListingStateFilter) => void;
  onViewUser: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 300);

  const listings = useQuery({
    queryKey: ['admin-listings', stateFilter, debouncedSearch],
    queryFn: () =>
      api<{ listings: AdminListingRow[] }>(
        `/api/admin/listings?state=${stateFilter}&q=${encodeURIComponent(debouncedSearch)}`,
      ),
  });

  function refresh(): void {
    void queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-flags'] });
  }

  return (
    <div className="admin-detail">
      <div className="admin-toolbar">
        <div className="seg" role="tablist">
          {LISTING_STATES.map((s) => (
            <button key={s.id} type="button" aria-pressed={stateFilter === s.id} onClick={() => onStateFilterChange(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or location…"
          className="admin-search"
        />
      </div>

      {listings.isLoading && <p className="muted">Loading…</p>}
      {listings.isError && (
        <div className="admin-error">
          <p className="muted">Failed to load.</p>
          <button className="btn-secondary" onClick={() => void listings.refetch()}>
            Retry
          </button>
        </div>
      )}
      {listings.data && (
        <div className="admin-table-wrap">
          <table className="admin-table admin-table--listings">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Location</th>
                <th>Date</th>
                <th>Flags</th>
                <th>State</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {listings.data.listings.map((l) => (
                <tr key={l.id}>
                  <td>{l.type === 'driver' ? '🚗' : '🎒'}</td>
                  <td>
                    {/* One name, one destination: this drills into the owner
                        (profile, all their posts); the listing itself is the
                        Open ↗ action. A separate Owner column repeated the
                        same name in nearly every row. */}
                    {l.ownerId ? (
                      <button className="btn-ghost admin-inline-link" onClick={() => onViewUser(l.ownerId!)}>
                        {l.name}
                      </button>
                    ) : (
                      l.name
                    )}
                    {l.ownerBanned && <span className="pill pill-warn">⛔</span>}
                  </td>
                  <td>{l.locationRaw}</td>
                  <td className="admin-cell-nowrap">{l.travelDate}</td>
                  <td>{l.flagCount > 0 ? <span className="pill pill-warn">{l.flagCount}</span> : l.flagCount}</td>
                  <td>
                    <StatePills l={l} />
                  </td>
                  <td className="admin-cell-actions">
                    <ListingActions listing={l} onChanged={refresh} />
                  </td>
                </tr>
              ))}
              {listings.data.listings.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    No listings found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- Messages tab ---------- */

function MessagesTab({ onViewUser }: { onViewUser: (id: string) => void }) {
  const messages = useQuery({
    queryKey: ['admin-messages'],
    queryFn: () => api<{ messages: AdminMessageRow[] }>('/api/admin/messages'),
  });

  if (messages.isLoading) return <p className="muted">Loading…</p>;
  if (messages.isError || !messages.data) {
    return (
      <div className="admin-error">
        <p className="muted">Failed to load.</p>
        <button className="btn-secondary" onClick={() => void messages.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="admin-detail">
      <p className="muted">Most recent 100 messages — for moderation review.</p>
      {messages.data.messages.length === 0 && <p className="muted">No messages.</p>}
      <div className="admin-msg-list">
        {messages.data.messages.map((m) => (
          <div key={m.id} className="admin-msg">
            <div className="admin-msg-head">
              <button className="btn-ghost admin-inline-link" onClick={() => onViewUser(m.senderId)}>
                {m.senderName}
              </button>
              {m.senderBanned && <span className="pill pill-warn">⛔</span>} →{' '}
              <button className="btn-ghost admin-inline-link" onClick={() => onViewUser(m.recipientId)}>
                {m.recipientName}
              </button>
              <span className="muted">
                {' '}
                · <Link to={`/listing/${m.listingId}`}>{m.listingName}</Link> · {fmtDateTime(m.createdAt)}
              </span>
            </div>
            <div className="admin-msg-body">{m.body}</div>
            {m.hasPhoto && <AdminMessagePhoto messageId={m.id} />}
            <SharedContact email={m.sharedEmail} phone={m.sharedPhone} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Flags tab ---------- */

function FlagsTab({ onViewUser }: { onViewUser: (id: string) => void }) {
  const queryClient = useQueryClient();
  const flags = useQuery({
    queryKey: ['admin-flags'],
    queryFn: () => api<{ flags: FlagRow[] }>('/api/admin/flags'),
  });

  async function act(path: string): Promise<void> {
    try {
      await api(path, { method: 'POST', body: {} });
      void queryClient.invalidateQueries({ queryKey: ['admin-flags'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch {
      window.alert('Action failed');
    }
  }

  if (flags.isLoading) return <p className="muted">Loading…</p>;
  if (flags.isError || !flags.data) {
    return (
      <div className="admin-error">
        <p className="muted">Failed to load.</p>
        <button className="btn-secondary" onClick={() => void flags.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <section className="admin-detail">
      {flags.data.flags.length === 0 && <p className="muted">No flags.</p>}
      {flags.data.flags.map((f) => (
        <div key={f.flagId} className="admin-flag-row">
          <div>
            <strong>
              <Link to={`/listing/${f.listingId}`}>{f.listingName}</Link>
            </strong>{' '}
            <span className="muted">({f.listingType})</span>
            {f.hiddenAt && <span className="pill pill-warn">hidden</span>}
            {f.deletedAt && <span className="pill pill-dim">deleted</span>}
            {f.ownerBanned && <span className="pill pill-warn">owner banned</span>}
            <div className="muted admin-flag-reason">{f.reason ?? 'no reason given'}</div>
          </div>
          <div className="admin-row">
            {f.hiddenAt ? (
              <button className="btn-ghost" onClick={() => void act(`/api/admin/listings/${f.listingId}/unhide`)}>
                Unhide
              </button>
            ) : (
              <button className="btn-ghost" onClick={() => void act(`/api/admin/listings/${f.listingId}/hide`)}>
                Hide
              </button>
            )}
            {f.deletedAt ? (
              <button className="btn-ghost" onClick={() => void act(`/api/admin/listings/${f.listingId}/restore`)}>
                Restore
              </button>
            ) : (
              <button
                className="btn-danger"
                onClick={() => {
                  if (window.confirm(`Delete listing "${f.listingName}"?`)) void act(`/api/admin/listings/${f.listingId}/delete`);
                }}
              >
                Delete
              </button>
            )}
            {f.ownerBanned ? (
              <button className="btn-ghost" onClick={() => void act(`/api/admin/users/${f.ownerId}/unban`)}>
                Unban owner
              </button>
            ) : (
              <button
                className="btn-danger"
                onClick={() => {
                  if (window.confirm('Ban this user and hide all their listings?')) {
                    void act(`/api/admin/users/${f.ownerId}/ban`);
                  }
                }}
              >
                Ban owner
              </button>
            )}
            <button className="btn-ghost" onClick={() => onViewUser(f.ownerId)}>
              View owner
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}

/* ---------- Metrics tab ---------- */

function Bar({ value, max, colorVar }: { value: number; max: number; colorVar: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="admin-bar-track">
      <div className="admin-bar-fill" style={{ width: `${pct}%`, background: `var(${colorVar})` }} />
    </div>
  );
}

function MetricsTab() {
  const [days, setDays] = useState<14 | 30 | 90>(14);
  const metrics = useQuery({
    queryKey: ['admin-metrics', days],
    queryFn: () => api<MetricsResponse>(`/api/admin/metrics?days=${days}`),
  });

  if (metrics.isLoading) return <p className="muted">Loading…</p>;
  if (metrics.isError || !metrics.data) {
    return (
      <div className="admin-error">
        <p className="muted">Failed to load.</p>
        <button className="btn-secondary" onClick={() => void metrics.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const m = metrics.data;
  const maxVisitors = Math.max(1, ...m.traffic.map((r) => toNum(r.visitors)));
  const maxActivity = Math.max(1, ...m.activity.map((r) => toNum(r.new_listings) + toNum(r.messages)));
  // The API returns days ascending; the admin reads these lists top-down for
  // "how are we doing lately", so today belongs at the top.
  const traffic = [...m.traffic].reverse();
  const activity = [...m.activity].reverse();

  return (
    <div className="admin-detail">
      <div className="seg" role="tablist">
        {([14, 30, 90] as const).map((d) => (
          <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}>
            {d}d
          </button>
        ))}
      </div>

      <div className="admin-stats">
        <div className="card admin-stat admin-stat--static">
          <span className="admin-stat-value">{toNum(m.totals.visitors)}</span>
          <span className="admin-stat-label">visitors</span>
        </div>
        <div className="card admin-stat admin-stat--static">
          <span className="admin-stat-value">{toNum(m.totals.pageviews)}</span>
          <span className="admin-stat-label">pageviews</span>
        </div>
        <div className="card admin-stat admin-stat--static">
          <span className="admin-stat-value">{toNum(m.totals.users)}</span>
          <span className="admin-stat-label">users</span>
        </div>
        <div className="card admin-stat admin-stat--static">
          <span className="admin-stat-value">{toNum(m.totals.messages)}</span>
          <span className="admin-stat-label">messages</span>
        </div>
        <div className="card admin-stat admin-stat--static">
          <span className="admin-stat-value">{toNum(m.totals.matches)}</span>
          <span className="admin-stat-label">matches</span>
        </div>
      </div>

      <section className="card">
        <h2>Traffic</h2>
        <div className="admin-chart">
          {traffic.map((r) => (
            <div key={r.day} className="admin-chart-row">
              <span className="admin-chart-label">{new Date(r.day).toLocaleDateString()}</span>
              <div className="admin-chart-bars">
                <Bar value={toNum(r.visitors)} max={maxVisitors} colorVar="--ember" />
                <Bar value={toNum(r.pageviews)} max={maxVisitors} colorVar="--ember-soft" />
              </div>
              <span className="admin-chart-value">
                {toNum(r.visitors)} visitors / {toNum(r.pageviews)} views
              </span>
            </div>
          ))}
          {traffic.length === 0 && <p className="muted">No traffic recorded yet.</p>}
        </div>
      </section>

      <section className="card">
        <h2>Activity</h2>
        <div className="admin-chart">
          {activity.map((r) => (
            <div key={r.day} className="admin-chart-row">
              <span className="admin-chart-label">{new Date(r.day).toLocaleDateString()}</span>
              <div className="admin-chart-bars">
                <Bar value={toNum(r.new_listings)} max={maxActivity} colorVar="--ember" />
                <Bar value={toNum(r.messages)} max={maxActivity} colorVar="--ember-soft" />
              </div>
              <span className="admin-chart-value">
                {toNum(r.new_users)} new users / {toNum(r.new_listings)} listings / {toNum(r.messages)} msgs
              </span>
            </div>
          ))}
          {activity.length === 0 && <p className="muted">No activity recorded yet.</p>}
        </div>
      </section>

      <div className="admin-metrics-grid">
        <section className="card">
          <h2>Top referrers</h2>
          <p className="field-hint">Direct visits aren't counted.</p>
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--compact">
              <tbody>
                {m.referrers.map((r) => (
                  <tr key={r.referrer_host}>
                    <td>{r.referrer_host}</td>
                    <td>{toNum(r.visitors)}</td>
                  </tr>
                ))}
                {m.referrers.length === 0 && (
                  <tr>
                    <td className="muted">No referrers.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h2>Visitors by state</h2>
          <p className="field-hint">IP location.</p>
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--compact">
              <tbody>
                {m.regions.map((r) => (
                  <tr key={r.region}>
                    <td>{r.region}</td>
                    <td>{toNum(r.visitors)}</td>
                  </tr>
                ))}
                {m.regions.length === 0 && (
                  <tr>
                    <td className="muted">No regions.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h2>Top pages</h2>
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--compact">
              <tbody>
                {m.topPaths.map((r) => (
                  <tr key={r.path}>
                    <td>{r.path}</td>
                    <td>{toNum(r.views)}</td>
                  </tr>
                ))}
                {m.topPaths.length === 0 && (
                  <tr>
                    <td className="muted">No pages.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <p className="field-hint">Server-side metrics. IPs are salted-hashed; no cookies, no Google Analytics.</p>
    </div>
  );
}

/* ---------- Emails tab ---------- */

type EmailsSubTab = 'log' | 'suppressed';

function EmailsTab() {
  const queryClient = useQueryClient();
  const [subTab, setSubTab] = useState<EmailsSubTab>('log');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 300);
  const [busy, setBusy] = useState(false);

  const emails = useQuery({
    queryKey: ['admin-emails'],
    queryFn: () => api<{ emails: EmailRow[] }>('/api/admin/emails'),
  });
  const suppressions = useQuery({
    queryKey: ['admin-suppressions', debouncedSearch],
    queryFn: () => api<{ suppressions: SuppressionRow[] }>(`/api/admin/suppressions?q=${encodeURIComponent(debouncedSearch)}`),
    enabled: subTab === 'suppressed',
  });

  async function unsuppress(email: string): Promise<void> {
    if (!window.confirm(`Allow mail to ${email} again? Bounced addresses will just bounce again.`)) return;
    setBusy(true);
    try {
      await api('/api/admin/unsuppress', { method: 'POST', body: { email } });
      void queryClient.invalidateQueries({ queryKey: ['admin-suppressions'] });
      void queryClient.invalidateQueries({ queryKey: ['outreach-stats'] });
    } catch {
      window.alert('Un-suppress failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-detail">
      <div className="seg admin-tabs" role="tablist" aria-label="Email sections">
        <button type="button" aria-pressed={subTab === 'log'} onClick={() => setSubTab('log')}>
          Recent emails
        </button>
        <button type="button" aria-pressed={subTab === 'suppressed'} onClick={() => setSubTab('suppressed')}>
          Suppressed
        </button>
      </div>

      {subTab === 'suppressed' && (
        <section className="card">
          <h2>Suppressed addresses</h2>
          <p className="muted">These addresses are hard-blocked: no digests, no login links, nothing.</p>
          <div className="admin-toolbar">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search suppressed addresses…"
              className="admin-search"
            />
          </div>
          {suppressions.isLoading && <p className="muted">Loading…</p>}
          {suppressions.isError && (
            <div className="admin-error">
              <p className="muted">Failed to load.</p>
              <button className="btn-secondary" onClick={() => void suppressions.refetch()}>
                Retry
              </button>
            </div>
          )}
          {suppressions.data?.suppressions.length === 0 && <p className="muted">No suppressed addresses.</p>}
          {suppressions.data && suppressions.data.suppressions.length > 0 && (
            <div className="admin-table-wrap">
              <table className="admin-table admin-table--compact">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Reason</th>
                    <th>Since</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {suppressions.data.suppressions.map((s) => (
                    <tr key={s.email}>
                      <td>{s.email}</td>
                      <td>
                        <span className="pill pill-warn">{s.reason}</span>
                      </td>
                      <td>{fmtDateTime(s.createdAt)}</td>
                      <td>
                        <button className="btn-secondary" disabled={busy} onClick={() => void unsuppress(s.email)}>
                          Un-suppress
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {subTab === 'log' && (
        <section className="card">
          <h2>Recent emails</h2>
          {emails.isLoading && <p className="muted">Loading…</p>}
          {emails.isError && (
            <div className="admin-error">
              <p className="muted">Failed to load.</p>
              <button className="btn-secondary" onClick={() => void emails.refetch()}>
                Retry
              </button>
            </div>
          )}
          {emails.data?.emails.length === 0 && <p className="muted">No emails sent yet.</p>}
          {emails.data?.emails.map((m) => {
            // sendEmail logs blocked sends as "<kind>-suppressed" instead of dropping them.
            const blocked = m.kind.endsWith('-suppressed');
            return (
              <div key={m.id} className="admin-email-row muted">
                <span>{fmtDateTime(m.sentAt)}</span> · <span>{blocked ? m.kind.slice(0, -'-suppressed'.length) : m.kind}</span> ·{' '}
                <span>{m.toEmail}</span> · <span>{m.subject}</span>
                {blocked && <> · <span className="pill pill-warn">suppressed</span></>}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

/* ---------- Settings tab ---------- */

const RATE_LIMIT_FIELDS: { key: keyof RateLimits; label: string }[] = [
  { key: 'messagesPerHour', label: 'Messages per user per hour' },
  { key: 'newConversationsPerHour', label: 'New conversations per user per hour' },
  { key: 'listingFlagsPerHour', label: 'Reports per user per hour' },
  { key: 'avatarUploadsPerHour', label: 'Photo uploads per IP per hour' },
  { key: 'anonSessionsPerHour', label: 'New sessions per IP per hour' },
  { key: 'recoveriesPerHour', label: 'Recovery attempts per IP per hour' },
  { key: 'magicLinksPerHour', label: 'Email-link sign-ins per IP per hour' },
  { key: 'emailLoginLinksPerHour', label: 'Email sign-in links per IP per hour' },
];

const APP_CONFIG_FIELDS: { key: keyof AppConfig; label: string }[] = [
  { key: 'magicLinkDays', label: 'Magic link validity (days)' },
  { key: 'sessionDays', label: 'Session length (days)' },
  { key: 'flagAutoHideThreshold', label: 'Reports needed to auto-hide a listing' },
  { key: 'maxListingsPerDay', label: 'Listings per user per day' },
  { key: 'maxActiveListingsPerDirection', label: 'Active listings per user per direction' },
  { key: 'expiryGraceHours', label: 'Post expiry: hours after the time window (departure-local)' },
  { key: 'flexibleExpiryGraceHours', label: 'Flexible-time expiry: hours past midnight (4 = 4am next day)' },
];

/* Sliders, not number boxes — tuning the mix is a relative-weight judgement, so
   the whole set has to be comparable at a glance. Weights top out at 50; the
   ceilings and score thresholds live on the 0–100 score scale. */
const MATCHING_FIELDS: { key: keyof MatchingConfig; label: string; max: number }[] = [
  { key: 'datePointsSameDay', label: 'Date: same-day points', max: 50 },
  { key: 'datePointsOneDayApart', label: 'Date: 1-day-apart points', max: 50 },
  { key: 'datePointsTwoDaysApart', label: 'Date: 2-days-apart points', max: 50 },
  { key: 'capacityPointsPerfect', label: 'Gear: perfect fit points', max: 50 },
  { key: 'capacityPointsGood', label: 'Gear: one-tier-spare points', max: 50 },
  { key: 'capacityPointsRoomy', label: 'Gear: roomy points', max: 50 },
  { key: 'locationPointsExact', label: 'Location: exact-city points', max: 50 },
  { key: 'timePointsAligned', label: 'Time: aligned-window points', max: 50 },
  { key: 'freshPoints', label: 'Freshness bonus points', max: 50 },
  { key: 'scoreCapOneDayApart', label: 'Score ceiling when 1 day apart', max: 100 },
  { key: 'scoreCapTwoDaysApart', label: 'Score ceiling when 2 days apart', max: 100 },
  { key: 'minMatchScore', label: 'Minimum score to create a match', max: 100 },
  { key: 'minEmailScore', label: 'Minimum score to email a match', max: 100 },
];

/** Both groups are whole numbers the server accepts within its own bounds. */
function clampSetting(value: string, max: number, min = 1): number {
  return Math.min(max, Math.max(min, Math.round(Number(value) || 0)));
}

/* Zero is meaningful for the grace-hour knobs ("expire exactly at window
   end"); every other setting floors at 1, mirroring the server. */
const APP_CONFIG_MIN: Partial<Record<keyof AppConfig, number>> = {
  expiryGraceHours: 0,
  flexibleExpiryGraceHours: 0,
};

function SettingsTab() {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => api<SettingsResponse>('/api/admin/settings'),
  });
  // Drafts stay raw strings while typing — clamping per keystroke made a
  // cleared field snap to 1 and typing append to it. Clamp only on save.
  const [draft, setDraft] = useState<Partial<Record<keyof RateLimits, string>>>({});
  const [appDraft, setAppDraft] = useState<Partial<Record<keyof AppConfig, string>>>({});
  const [matchDraft, setMatchDraft] = useState<Partial<Record<keyof MatchingConfig, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const rlValue = (key: keyof RateLimits): string =>
    draft[key] ?? String(settings.data?.rateLimits[key] ?? '');
  const acValue = (key: keyof AppConfig): string =>
    appDraft[key] ?? String(settings.data?.appConfig[key] ?? '');
  const mcValue = (key: keyof MatchingConfig): string =>
    matchDraft[key] ?? String(settings.data?.matching[key] ?? '');

  async function save(): Promise<void> {
    if (!settings.data) return;
    setSaving(true);
    setSaveStatus(null);
    const rateLimits = Object.fromEntries(
      RATE_LIMIT_FIELDS.map((f) => [f.key, clampSetting(rlValue(f.key), 100_000)]),
    );
    const appConfig = Object.fromEntries(
      APP_CONFIG_FIELDS.map((f) => [f.key, clampSetting(acValue(f.key), 10_000, APP_CONFIG_MIN[f.key] ?? 1)]),
    );
    // Every matching knob may legitimately be 0 (e.g. "no credit for 2 days apart").
    const matching = Object.fromEntries(
      MATCHING_FIELDS.map((f) => [f.key, clampSetting(mcValue(f.key), f.max, 0)]),
    );
    try {
      await api('/api/admin/settings', {
        method: 'PUT',
        body: { rateLimits, appConfig, matching },
      });
      setDraft({});
      setAppDraft({});
      setMatchDraft({});
      setSaveStatus('Saved ✓ — takes effect within 30s');
      void queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    } catch {
      setSaveStatus('Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (settings.isLoading) return <p className="muted">Loading…</p>;
  if (settings.isError || !settings.data) {
    return (
      <div className="admin-error">
        <p className="muted">Failed to load.</p>
        <button className="btn-secondary" onClick={() => void settings.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const defaults = settings.data.defaults;
  const appDefaults = settings.data.appConfigDefaults;
  const matchingDefaults = settings.data.matchingDefaults;

  return (
    <div className="admin-detail">
      <section className="card admin-settings-card">
        <h2>Rate limits</h2>
        <p className="muted">Changes apply live, no deploy needed.</p>
        <div className="admin-settings-grid">
          {RATE_LIMIT_FIELDS.map((f) => (
            <div key={f.key} className="field-group">
              <label htmlFor={`rl-${f.key}`}>
                {f.label} <span className="field-hint">(default {defaults[f.key]})</span>
              </label>
              <input
                id={`rl-${f.key}`}
                type="number"
                min={1}
                value={rlValue(f.key)}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="card admin-settings-card">
        <h2>App settings</h2>
        <p className="muted">Changes apply live, no deploy needed.</p>
        <div className="admin-settings-grid">
          {APP_CONFIG_FIELDS.map((f) => (
            <div key={f.key} className="field-group">
              <label htmlFor={`ac-${f.key}`}>
                {f.label} <span className="field-hint">(default {appDefaults[f.key]})</span>
              </label>
              <input
                id={`ac-${f.key}`}
                type="number"
                min={APP_CONFIG_MIN[f.key] ?? 1}
                value={acValue(f.key)}
                onChange={(e) => setAppDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="card admin-settings-card">
        <h2>Matching</h2>
        <p className="muted">Changes re-score all live listings automatically.</p>
        <div className="admin-settings-grid">
          {MATCHING_FIELDS.map((f) => (
            <div key={f.key} className="field-group">
              <label htmlFor={`mc-${f.key}`}>
                {f.label} — <strong>{mcValue(f.key)}</strong>{' '}
                <span className="field-hint">(default {matchingDefaults[f.key]})</span>
              </label>
              <input
                id={`mc-${f.key}`}
                type="range"
                min={0}
                max={f.max}
                step={1}
                value={mcValue(f.key)}
                onChange={(e) => setMatchDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="admin-row">
        <button className="btn" disabled={saving} onClick={() => void save()}>
          Save
        </button>
        {saveStatus && <p className="muted">{saveStatus}</p>}
      </div>
    </div>
  );
}

/* ---------- Root ---------- */

export default function AdminPage() {
  const { data: me } = useMe();
  const isAdmin = me?.isAdmin ?? false;

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [listingsStateFilter, setListingsStateFilter] = useState<ListingStateFilter>('all');

  function goToUser(userId: string): void {
    setSelectedUserId(userId);
    setActiveTab('users');
  }

  function goToUsersList(): void {
    setSelectedUserId(null);
    setActiveTab('users');
  }

  function goToListings(state: ListingStateFilter): void {
    setListingsStateFilter(state);
    setActiveTab('listings');
  }

  function changeTab(tab: AdminTab): void {
    if (tab === 'users' && activeTab !== 'users') setSelectedUserId(null);
    setActiveTab(tab);
  }

  if (!isAdmin) {
    return (
      <div className="admin-page">
        <h1>Admin</h1>
        {me ? <ClaimForm /> : <EmptyState title="No session" hint="Load the app first, then come back." />}
      </div>
    );
  }

  return (
    <div className="admin-page">
      <h1>Admin</h1>
      <TabBar active={activeTab} onChange={changeTab} />

      {activeTab === 'overview' && (
        <OverviewTab
          onGoUsers={goToUsersList}
          onGoListings={goToListings}
          onGoMessages={() => setActiveTab('messages')}
          onGoEmails={() => setActiveTab('emails')}
          onGoFlags={() => setActiveTab('flags')}
        />
      )}
      {activeTab === 'users' && <UsersTab selectedUserId={selectedUserId} onSelectUser={setSelectedUserId} />}
      {activeTab === 'listings' && (
        <ListingsTab stateFilter={listingsStateFilter} onStateFilterChange={setListingsStateFilter} onViewUser={goToUser} />
      )}
      {activeTab === 'messages' && <MessagesTab onViewUser={goToUser} />}
      {activeTab === 'flags' && <FlagsTab onViewUser={goToUser} />}
      {activeTab === 'metrics' && <MetricsTab />}
      {activeTab === 'emails' && <EmailsTab />}
      {activeTab === 'outreach' && <AdminOutreachTab />}
      {activeTab === 'settings' && <SettingsTab />}
    </div>
  );
}
