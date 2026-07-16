import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { useMe } from '../api/session';
import EmptyState from '../components/EmptyState';

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
  listingType: 'driver' | 'rider';
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

export default function AdminPage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const isAdmin = me?.isAdmin ?? false;

  const overview = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => api<Overview>('/api/admin/overview'),
    enabled: isAdmin,
  });
  const flags = useQuery({
    queryKey: ['admin-flags'],
    queryFn: () => api<{ flags: FlagRow[] }>('/api/admin/flags'),
    enabled: isAdmin,
  });
  const emails = useQuery({
    queryKey: ['admin-emails'],
    queryFn: () => api<{ emails: EmailRow[] }>('/api/admin/emails'),
    enabled: isAdmin,
  });

  const [testTo, setTestTo] = useState('');
  const [testStatus, setTestStatus] = useState<string | null>(null);

  async function act(path: string): Promise<void> {
    try {
      await api(path, { method: 'POST', body: {} });
      await queryClient.invalidateQueries({ queryKey: ['admin-flags'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    } catch {
      window.alert('Action failed');
    }
  }

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

  if (!isAdmin) {
    return (
      <div className="admin-page">
        <h1>Admin</h1>
        {me ? <ClaimForm /> : <EmptyState title="No session" hint="Load the app first, then come back." />}
      </div>
    );
  }

  const o = overview.data;
  return (
    <div className="admin-page">
      <h1>Admin</h1>

      {o && (
        <div className="admin-stats">
          <div className="card">👤 {o.users} users</div>
          <div className="card">📋 {o.activeListings} active listings</div>
          <div className="card">🙈 {o.hiddenListings} hidden</div>
          <div className="card">💬 {o.messages24h} msgs/24h</div>
          <div className="card">✉️ {o.emails24h} emails/24h</div>
          <div className="card">🚩 {o.totalFlags} flags</div>
        </div>
      )}

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

      <section className="card">
        <h2>Flags</h2>
        {(flags.data?.flags ?? []).length === 0 && <p className="muted">No flags.</p>}
        {(flags.data?.flags ?? []).map((f) => (
          <div key={f.flagId} className="admin-flag-row">
            <div>
              <strong>{f.listingName}</strong> <span className="muted">({f.listingType})</span>
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
              {f.deletedAt && (
                <button className="btn-ghost" onClick={() => void act(`/api/admin/listings/${f.listingId}/restore`)}>
                  Restore
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
            </div>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Recent emails</h2>
        {(emails.data?.emails ?? []).map((m) => (
          <div key={m.id} className="admin-email-row muted">
            <span>{new Date(m.sentAt).toLocaleString()}</span> · <span>{m.kind}</span> · <span>{m.toEmail}</span> ·{' '}
            <span>{m.subject}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
