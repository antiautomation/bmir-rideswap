// Admin → Outreach: contact lists and the email campaigns that go to them.
// Split out of AdminPage.tsx to keep that file navigable; mirrors the response
// shapes in server/src/routes/adminOutreach.ts.

import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

/* ---------- Types ---------- */

type Template = 'invite' | 'announcement';
type PreviewSegment = 'driver' | 'rider' | 'both';
type MemberState = 'all' | 'sendable' | 'excluded' | 'unsubscribed';
type SubTab = 'lists' | 'campaigns';

interface Audience {
  key: string;
  label: string;
  description: string;
}

interface OutreachStats {
  total: number;
  unsubscribed: number;
  excluded: number;
  sendable: number;
  linkedToUsers: number;
  bySource: { source: string; n: number }[];
  excludeReasons: { reason: string; n: number }[];
  suppressionListSize: number;
  audiences: Audience[];
}

interface ListRow {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  query: string | null;
  createdAt: string;
  refreshedAt: string | null;
  members: number;
  sendable: number;
  campaignCount: number;
}

interface ContactMeta {
  segment?: string;
  topLocation?: string | null;
  lastTravelDate?: string | null;
  allDeleted?: boolean;
}

interface MemberRow {
  email: string;
  name: string | null;
  source: string;
  meta: ContactMeta;
  userId: string | null;
  unsubscribedAt: string | null;
  excludedAt: string | null;
  excludeReason: string | null;
  addedAt: string;
}

interface PasteResult {
  dryRun: boolean;
  lines: number;
  valid: number;
  duplicates: number;
  invalid: number;
  usedHeader: boolean;
  parsed: number;
  alreadyOnList: number;
  wouldAdd?: number;
  added?: number;
  newContacts?: number;
  refreshedContacts?: number;
  autoExcluded?: Record<string, number>;
  truncated: boolean;
  invalidSamples: { line: number; text: string }[];
  sample?: { email: string; name: string | null }[];
}

interface V1ImportResult {
  docsScanned: number;
  driverDocs: number;
  riderDocs: number;
  softDeletedDocs: number;
  docsWithoutEmail: number;
  docsWithMalformedEmail: number;
  uniqueContacts: number;
  segments: { driver: number; rider: number; both: number };
  excluded: { total: number; byReason: Record<string, number> };
  inserted: number;
  updated: number;
  addedToList: number;
  listName: string;
  dryRun: boolean;
}

interface CampaignRow {
  id: string;
  name: string;
  subject: string;
  listId: string;
  listName: string;
  template: string;
  status: string;
  throttlePerMinute: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  total: number;
  sent: number;
  pending: number;
  failed: number;
}

interface TemplateDefaults {
  subject: string;
  headline: string;
  intro: string;
}

interface CampaignListResponse {
  campaigns: CampaignRow[];
  defaults: Record<Template, TemplateDefaults>;
}

interface CampaignFields {
  id: string;
  name: string;
  subject: string;
  listId: string;
  template: string;
  headline: string | null;
  intro: string | null;
  ctaLabel: string | null;
  ctaPath: string | null;
  status: string;
  throttlePerMinute: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

interface CampaignDetail {
  campaign: CampaignFields;
  listName: string;
  listKind: string;
  listSendable: number;
  breakdown: { status: string; n: number }[];
  recent: { email: string; status: string; error: string | null; attempts: number; sentAt: string | null }[];
  problems: { email: string; status: string; error: string | null; attempts: number }[];
}

/* ---------- Helpers ---------- */

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : '—';
}

function errCode(err: unknown): string {
  return err instanceof Error ? err.message : '';
}

const FRIENDLY_ERRORS: Record<string, string> = {
  email_dry_run_enabled:
    "Can't start: the server is in EMAIL_DRY_RUN mode, so nothing would actually be delivered. Set EMAIL_DRY_RUN=0 first.",
  list_in_use_by_campaign: "Can't delete: a campaign still points at this list. Delete the campaign first.",
  list_is_dynamic: 'This list rebuilds itself from a saved query — paste imports only work on manual lists.',
  name_taken: 'A list with that name already exists.',
  pause_first: 'Pause the campaign before changing it.',
  already_sending: 'That campaign is already sending.',
  not_sending: 'That campaign is not currently sending.',
};

function explain(err: unknown): string {
  const code = errCode(err);
  return FRIENDLY_ERRORS[code] ?? (code ? `Failed: ${code}` : 'Failed');
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="card admin-stat admin-stat--static">
      <span className="admin-stat-value">{value}</span>
      <span className="admin-stat-label">{label}</span>
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

function Loading({ q }: { q: { isLoading: boolean; isError: boolean; refetch: () => unknown } }) {
  if (q.isLoading) return <p className="muted">Loading…</p>;
  return (
    <div className="admin-error">
      <p className="muted">Failed to load.</p>
      <button className="btn-secondary" onClick={() => void q.refetch()}>
        Retry
      </button>
    </div>
  );
}

/* ---------- Lists ---------- */

function ListsPanel({ onOpenList }: { onOpenList: (id: string) => void }) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const stats = useQuery({
    queryKey: ['outreach-stats'],
    queryFn: () => api<OutreachStats>('/api/admin/outreach/stats'),
  });
  const lists = useQuery({
    queryKey: ['outreach-lists'],
    queryFn: () => api<{ lists: ListRow[]; audiences: Audience[] }>('/api/admin/lists'),
  });

  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: ['outreach-lists'] });
    void queryClient.invalidateQueries({ queryKey: ['outreach-stats'] });
  }

  async function act(id: string, fn: () => Promise<unknown>): Promise<void> {
    setBusy(id);
    try {
      await fn();
      invalidate();
    } catch (err) {
      window.alert(explain(err));
    } finally {
      setBusy(null);
    }
  }

  const s = stats.data;

  return (
    <>
      <section className="card">
        <h2>Contacts</h2>
        <p className="muted">
          Every address we might send bulk mail to, whatever its origin. Contacts are not accounts — being on a list
          grants no login. Unsubscribing is global: it applies to every list at once.
        </p>
        {stats.isLoading && <p className="muted">Loading…</p>}
        {s && (
          <>
            <div className="admin-stats">
              <Stat label="contacts" value={s.total} />
              <Stat label="sendable" value={s.sendable} />
              <Stat label="unsubscribed" value={s.unsubscribed} />
              <Stat label="held back" value={s.excluded} />
              <Stat label="have accounts" value={s.linkedToUsers} />
            </div>
            <p className="muted">
              Sources:{' '}
              {s.bySource.map((b) => (
                <span key={b.source} className="pill pill-dim">
                  {b.source} {b.n}
                </span>
              ))}
              {' · '}hard suppression list {s.suppressionListSize}
            </p>
            {s.excludeReasons.length > 0 && (
              <p className="muted">
                Held back:{' '}
                {s.excludeReasons.map((r) => (
                  <span key={r.reason} className="pill pill-dim">
                    {r.reason} {r.n}
                  </span>
                ))}
              </p>
            )}
          </>
        )}
        <V1Import onDone={invalidate} />
      </section>

      <section className="card">
        <h2>Lists</h2>
        {(lists.isLoading || lists.isError) && <Loading q={lists} />}
        {lists.data?.lists.length === 0 && !creating && (
          <p className="muted">No lists yet. Make one and paste some addresses into it.</p>
        )}

        {lists.data?.lists.map((l) => (
          <div key={l.id} className="admin-table-row">
            <div>
              <strong>{l.name}</strong>{' '}
              <span className={`pill ${l.kind === 'dynamic' ? 'pill-warn' : 'pill-dim'}`}>{l.kind}</span>
              {l.description && <div className="muted">{l.description}</div>}
              <div className="muted">
                {l.members} members · {l.sendable} sendable
                {l.campaignCount > 0 && <> · {l.campaignCount} campaign{l.campaignCount === 1 ? '' : 's'}</>}
                {l.kind === 'dynamic' && (
                  <>
                    {' · '}
                    {lists.data.audiences.find((a) => a.key === l.query)?.label ?? l.query} · refreshed{' '}
                    {fmt(l.refreshedAt)}
                  </>
                )}
              </div>
            </div>
            <div className="admin-row admin-actions">
              <button className="btn-ghost" onClick={() => onOpenList(l.id)}>
                Open
              </button>
              {l.kind === 'dynamic' && (
                <button
                  className="btn-ghost"
                  disabled={busy === l.id}
                  onClick={() => void act(l.id, () => api(`/api/admin/lists/${l.id}/refresh`, { method: 'POST', body: {} }))}
                >
                  Refresh
                </button>
              )}
              <button
                className="btn-danger"
                disabled={busy === l.id}
                onClick={() => {
                  if (window.confirm(`Delete list "${l.name}"? The contacts themselves are kept.`)) {
                    void act(l.id, () => api(`/api/admin/lists/${l.id}`, { method: 'DELETE' }));
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        {creating && lists.data ? (
          <NewListForm
            audiences={lists.data.audiences}
            onDone={(id) => {
              setCreating(false);
              invalidate();
              onOpenList(id);
            }}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <div className="admin-row admin-actions">
            <button className="btn" onClick={() => setCreating(true)} disabled={!lists.data}>
              New list
            </button>
          </div>
        )}
      </section>
    </>
  );
}

function V1Import({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<V1ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function run(dryRun: boolean): Promise<void> {
    if (!dryRun && !window.confirm('Import the 2025 Firebase board into contacts? Existing unsubscribes are kept.')) {
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<V1ImportResult>('/api/admin/contacts/import-v1', { method: 'POST', body: { dryRun } });
      setResult(r);
      if (!dryRun) onDone();
    } catch (err) {
      setError(errCode(err) || 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="admin-row admin-actions">
        <button className="btn-ghost" onClick={() => setOpen(true)}>
          One-time: import the 2025 Firebase board
        </button>
      </div>
    );
  }

  return (
    <div className="admin-detail">
      <h3>Import the 2025 Firebase board</h3>
      <p className="muted">
        Reads the old v1 Firestore directly and files everyone onto a static list, tagging each contact with the side
        of the board they posted on. One-time — that project is being deleted, after which this stops working.
      </p>
      <div className="admin-row admin-actions">
        <button className="btn-secondary" disabled={busy} onClick={() => void run(true)}>
          Preview
        </button>
        <button className="btn" disabled={busy} onClick={() => void run(false)}>
          Import
        </button>
        <button className="btn-ghost" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      {busy && <p className="muted">Reading the v1 board…</p>}
      {error && <p className="muted">Import failed: {error}</p>}
      {result && (
        <>
          <div className="admin-stats">
            <Stat
              label="v1 posts scanned"
              value={result.docsScanned}
              hint={`${result.driverDocs} driver / ${result.riderDocs} rider`}
            />
            <Stat label="unique contacts" value={result.uniqueContacts} />
            <Stat label="drivers" value={result.segments.driver} />
            <Stat label="riders" value={result.segments.rider} />
            <Stat label="both" value={result.segments.both} />
            <Stat label="held back" value={result.excluded.total} />
            <Stat label="new contacts" value={result.inserted} />
            <Stat label="added to list" value={result.addedToList} />
          </div>
          <p className="muted">
            {result.dryRun ? 'Dry run — nothing written. ' : `Filed onto "${result.listName}". `}
            Skipped {result.docsWithoutEmail} posts with no email, {result.docsWithMalformedEmail} malformed.
          </p>
        </>
      )}
    </div>
  );
}

function NewListForm({
  audiences,
  onDone,
  onCancel,
}: {
  audiences: Audience[];
  onDone: (id: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<'static' | 'dynamic'>('static');
  const [query, setQuery] = useState(audiences[0]?.key ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = useQuery({
    queryKey: ['audience-count', query],
    queryFn: () => api<{ count: number }>(`/api/admin/audiences/${query}/count`),
    enabled: kind === 'dynamic' && query !== '',
  });

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ id: string }>('/api/admin/lists', {
        method: 'POST',
        body: { name, description: description || null, kind, query: kind === 'dynamic' ? query : null },
      });
      onDone(res.id);
    } catch (err) {
      setError(explain(err));
    } finally {
      setSaving(false);
    }
  }

  const selected = audiences.find((a) => a.key === query);

  return (
    <form className="admin-detail" onSubmit={(e) => void submit(e)}>
      <h3>New list</h3>
      <div className="field-group">
        <label htmlFor="list-name">Name</label>
        <input
          id="list-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          required
          placeholder="e.g. Camp leads 2026"
        />
      </div>
      <div className="field-group">
        <label htmlFor="list-desc">Description (optional)</label>
        <input id="list-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
      </div>
      <div className="field-group">
        <label htmlFor="list-kind">Type</label>
        <select id="list-kind" value={kind} onChange={(e) => setKind(e.target.value as 'static' | 'dynamic')}>
          <option value="static">Manual — I'll paste addresses in</option>
          <option value="dynamic">Automatic — rebuild from the userbase</option>
        </select>
        <span className="field-hint">
          {kind === 'static'
            ? 'Membership is exactly what you import. Nothing changes it behind your back.'
            : 'Membership is recomputed from a saved query, including right before every send.'}
        </span>
      </div>
      {kind === 'dynamic' && (
        <div className="field-group">
          <label htmlFor="list-query">Who</label>
          <select id="list-query" value={query} onChange={(e) => setQuery(e.target.value)}>
            {audiences.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
          <span className="field-hint">
            {selected?.description}
            {count.data && <> Currently matches {count.data.count} account{count.data.count === 1 ? '' : 's'}.</>}
          </span>
        </div>
      )}
      {error && <p className="muted">{error}</p>}
      <div className="admin-row admin-actions">
        <button type="submit" className="btn" disabled={saving || !name}>
          Create
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ---------- List detail ---------- */

function ListDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [state, setState] = useState<MemberState>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);

  const lists = useQuery({
    queryKey: ['outreach-lists'],
    queryFn: () => api<{ lists: ListRow[]; audiences: Audience[] }>('/api/admin/lists'),
  });
  const members = useQuery({
    queryKey: ['outreach-members', id, q, state],
    queryFn: () =>
      api<{ members: MemberRow[] }>(
        `/api/admin/lists/${id}/members?q=${encodeURIComponent(q)}&state=${state}&limit=500`,
      ),
  });

  const list = lists.data?.lists.find((l) => l.id === id);

  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: ['outreach-members', id] });
    void queryClient.invalidateQueries({ queryKey: ['outreach-lists'] });
    void queryClient.invalidateQueries({ queryKey: ['outreach-stats'] });
  }

  async function act(key: string, fn: () => Promise<unknown>): Promise<void> {
    setBusy(key);
    try {
      await fn();
      invalidate();
    } catch (err) {
      window.alert(explain(err));
    } finally {
      setBusy(null);
    }
  }

  if (!list) return lists.isLoading ? <p className="muted">Loading…</p> : <Loading q={lists} />;

  return (
    <section className="card">
      <button className="admin-inline-link" onClick={onBack}>
        ← All lists
      </button>
      <h2>
        {list.name} <span className={`pill ${list.kind === 'dynamic' ? 'pill-warn' : 'pill-dim'}`}>{list.kind}</span>
      </h2>
      <p className="muted">
        {list.members} members · {list.sendable} sendable
        {list.description && <> · {list.description}</>}
      </p>

      {renaming ? (
        <RenameListForm list={list} onDone={() => { setRenaming(false); invalidate(); }} onCancel={() => setRenaming(false)} />
      ) : (
        <div className="admin-row admin-actions">
          <button className="btn-ghost" onClick={() => setRenaming(true)}>
            Rename
          </button>
          {list.kind === 'dynamic' && (
            <button
              className="btn-ghost"
              disabled={busy === 'refresh'}
              onClick={() => void act('refresh', () => api(`/api/admin/lists/${id}/refresh`, { method: 'POST', body: {} }))}
            >
              Refresh from userbase
            </button>
          )}
        </div>
      )}

      {list.kind === 'static' ? (
        <PasteImport listId={id} onImported={invalidate} />
      ) : (
        <p className="muted">
          This list rebuilds itself from the saved query, so there's nothing to paste in. Use a manual list for
          hand-collected addresses.
        </p>
      )}

      <div className="admin-detail">
        <h3>Members</h3>
        <div className="admin-toolbar">
          <input
            className="admin-search"
            type="search"
            placeholder="Search email or name"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select value={state} onChange={(e) => setState(e.target.value as MemberState)} aria-label="State">
            <option value="all">Any state</option>
            <option value="sendable">Sendable</option>
            <option value="excluded">Held back</option>
            <option value="unsubscribed">Unsubscribed</option>
          </select>
        </div>

        {(members.isLoading || members.isError) && <Loading q={members} />}
        {members.data?.members.length === 0 && <p className="muted">No members match.</p>}
        <div className="admin-table-wrap">
          <div className="admin-table admin-table--compact">
            {members.data?.members.map((m) => (
              <div key={m.email} className="admin-table-row">
                <div>
                  <strong>{m.name ?? '—'}</strong> <span className="muted">{m.email}</span>
                  <div className="muted">
                    <span className="pill pill-dim">{m.source}</span>
                    {m.meta.segment && <span className="pill pill-dim">{m.meta.segment}</span>}
                    {m.userId && <span className="pill pill-dim">has account</span>}
                    {m.meta.topLocation && <> {m.meta.topLocation}</>}
                    {m.unsubscribedAt && <span className="pill pill-warn">unsubscribed</span>}
                    {m.excludedAt && (
                      <span className="pill pill-warn">held back{m.excludeReason ? `: ${m.excludeReason}` : ''}</span>
                    )}
                  </div>
                </div>
                <div className="admin-row admin-actions">
                  {!m.unsubscribedAt && (
                    <button
                      className="btn-ghost"
                      disabled={busy === m.email}
                      onClick={() =>
                        void act(m.email, () =>
                          api('/api/admin/contacts/exclude', {
                            method: 'POST',
                            body: { email: m.email, exclude: m.excludedAt == null, reason: 'manual' },
                          }),
                        )
                      }
                    >
                      {m.excludedAt ? 'Include' : 'Hold back'}
                    </button>
                  )}
                  <button
                    className="btn-ghost"
                    disabled={busy === m.email}
                    onClick={() =>
                      void act(m.email, () =>
                        api(`/api/admin/lists/${id}/members`, { method: 'DELETE', body: { email: m.email } }),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function RenameListForm({ list, onDone, onCancel }: { list: ListRow; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState(list.name);
  const [description, setDescription] = useState(list.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/api/admin/lists/${list.id}`, {
        method: 'PATCH',
        body: { name, description: description || null },
      });
      onDone();
    } catch (err) {
      setError(explain(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="admin-detail" onSubmit={(e) => void submit(e)}>
      <div className="field-group">
        <label htmlFor="rename-name">Name</label>
        <input id="rename-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
      </div>
      <div className="field-group">
        <label htmlFor="rename-desc">Description</label>
        <input id="rename-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
      </div>
      {error && <p className="muted">{error}</p>}
      <div className="admin-row admin-actions">
        <button type="submit" className="btn" disabled={saving}>
          Save
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function PasteImport({ listId, onImported }: { listId: string; onImported: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PasteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(dryRun: boolean): Promise<void> {
    setBusy(true);
    setError(null);
    if (dryRun) setResult(null);
    try {
      const r = await api<PasteResult>(`/api/admin/lists/${listId}/paste`, { method: 'POST', body: { text, dryRun } });
      setResult(r);
      if (!dryRun) {
        setText('');
        onImported();
      }
    } catch (err) {
      setError(explain(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-detail">
      <h3>Add addresses</h3>
      <div className="field-group">
        <label htmlFor="paste-box">Paste a list</label>
        <textarea
          id="paste-box"
          className="admin-paste"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'one@example.com\ntwo@example.com\n\n…or CSV:\nname,email\nDusty Dave,dusty@example.com\n\n…or "Dusty Dave <dusty@example.com>"'}
        />
        <span className="field-hint">
          One per line, comma/semicolon/tab separated, a CSV export with a header row, or Name &lt;address&gt; — mix
          them freely. Duplicates and junk are reported, not silently dropped.
        </span>
      </div>
      <div className="admin-row admin-actions">
        <button className="btn-secondary" disabled={busy || !text.trim()} onClick={() => void run(true)}>
          Check it
        </button>
        <button className="btn" disabled={busy || !text.trim() || !result} onClick={() => void run(false)}>
          Add to list
        </button>
      </div>
      {!result && text.trim() !== '' && <p className="field-hint">Check it first, then the Add button unlocks.</p>}
      {error && <p className="muted">{error}</p>}
      {result && (
        <>
          <div className="admin-stats">
            <Stat label="addresses found" value={result.parsed} />
            {result.dryRun ? (
              <Stat label="would be added" value={result.wouldAdd ?? 0} />
            ) : (
              <Stat label="added" value={result.added ?? 0} />
            )}
            <Stat label="already on list" value={result.alreadyOnList} />
            <Stat label="duplicates in paste" value={result.duplicates} />
            <Stat label="unusable lines" value={result.invalid} />
          </div>
          <p className="muted">
            {result.dryRun ? 'Nothing written yet. ' : `Done. ${result.newContacts ?? 0} brand-new contacts. `}
            {result.usedHeader && 'Treated the first row as a CSV header. '}
            {result.truncated && `Only the first 10,000 addresses were read. `}
          </p>
          {result.autoExcluded && Object.keys(result.autoExcluded).length > 0 && (
            <p className="muted">
              Auto-held-back:{' '}
              {Object.entries(result.autoExcluded).map(([k, n]) => (
                <span key={k} className="pill pill-dim">
                  {k} {n}
                </span>
              ))}
            </p>
          )}
          {result.invalidSamples.length > 0 && (
            <>
              <p className="muted">Lines with no usable address:</p>
              {result.invalidSamples.map((s) => (
                <div key={s.line} className="admin-email-row muted">
                  line {s.line}: {s.text}
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- Campaigns ---------- */

function CampaignsPanel({ openId, onOpen }: { openId: string | null; onOpen: (id: string | null) => void }) {
  const queryClient = useQueryClient();
  const [composing, setComposing] = useState(false);

  const list = useQuery({
    queryKey: ['outreach-campaigns'],
    queryFn: () => api<CampaignListResponse>('/api/admin/campaigns'),
    refetchInterval: (query) => (query.state.data?.campaigns.some((c) => c.status === 'sending') ? 5_000 : false),
  });
  const lists = useQuery({
    queryKey: ['outreach-lists'],
    queryFn: () => api<{ lists: ListRow[]; audiences: Audience[] }>('/api/admin/lists'),
  });

  function refresh(): void {
    void queryClient.invalidateQueries({ queryKey: ['outreach-campaigns'] });
    if (openId) void queryClient.invalidateQueries({ queryKey: ['outreach-campaign', openId] });
  }

  if (openId) {
    return <CampaignDetailView id={openId} onBack={() => onOpen(null)} onChanged={refresh} />;
  }

  return (
    <section className="card">
      <h2>Campaigns</h2>
      {(list.isLoading || list.isError) && <Loading q={list} />}
      {list.data?.campaigns.length === 0 && !composing && (
        <p className="muted">No campaigns yet. Pick a list, write the mail, send yourself a test, then start it.</p>
      )}

      {list.data?.campaigns.map((c) => (
        <div key={c.id} className="admin-table-row">
          <div>
            <strong>{c.name}</strong>{' '}
            <span className={`pill ${c.status === 'sending' ? 'pill-warn' : 'pill-dim'}`}>{c.status}</span>{' '}
            <span className="pill pill-dim">{c.template}</span>
            <div className="muted">{c.subject}</div>
            <div className="muted">
              to “{c.listName}” · {c.sent}/{c.total} sent
              {c.pending > 0 && <> · {c.pending} queued</>}
              {c.failed > 0 && <> · {c.failed} failed</>}
              {' · '}
              {c.throttlePerMinute}/min · created {fmt(c.createdAt)}
            </div>
            {c.total > 0 && (
              <div className="admin-progress" aria-hidden="true">
                <span style={{ width: `${Math.round((c.sent / c.total) * 100)}%` }} />
              </div>
            )}
          </div>
          <button className="btn-ghost" onClick={() => onOpen(c.id)}>
            Open
          </button>
        </div>
      ))}

      {composing && list.data && lists.data ? (
        <CampaignForm
          defaults={list.data.defaults}
          lists={lists.data.lists}
          onDone={(id) => {
            setComposing(false);
            refresh();
            onOpen(id);
          }}
          onCancel={() => setComposing(false)}
        />
      ) : (
        <div className="admin-row admin-actions">
          <button
            className="btn"
            onClick={() => setComposing(true)}
            disabled={!list.data || !lists.data || lists.data.lists.length === 0}
          >
            New campaign
          </button>
          {lists.data?.lists.length === 0 && <p className="muted">Make a contact list first.</p>}
        </div>
      )}
    </section>
  );
}

function CampaignForm({
  defaults,
  lists,
  existing,
  onDone,
  onCancel,
}: {
  defaults: Record<Template, TemplateDefaults>;
  lists: ListRow[];
  existing?: CampaignFields;
  onDone: (id: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [template, setTemplate] = useState<Template>((existing?.template as Template) ?? 'announcement');
  const [subject, setSubject] = useState(existing?.subject ?? defaults.announcement.subject);
  const [listId, setListId] = useState(existing?.listId ?? lists[0]?.id ?? '');
  const [headline, setHeadline] = useState(existing?.headline ?? defaults.announcement.headline);
  const [intro, setIntro] = useState(existing?.intro ?? defaults.announcement.intro);
  const [ctaLabel, setCtaLabel] = useState(existing?.ctaLabel ?? 'Open the board →');
  const [ctaPath, setCtaPath] = useState(existing?.ctaPath ?? '/');
  const [throttle, setThrottle] = useState(existing?.throttlePerMinute ?? 20);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Switching template swaps in that template's starter copy, unless edited. */
  function changeTemplate(next: Template): void {
    const from = defaults[template];
    setTemplate(next);
    if (subject === from.subject) setSubject(defaults[next].subject);
    if (headline === from.headline) setHeadline(defaults[next].headline);
    if (intro === from.intro) setIntro(defaults[next].intro);
  }

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = {
      name,
      subject,
      listId,
      template,
      headline,
      intro,
      ctaLabel: template === 'announcement' ? ctaLabel || null : null,
      ctaPath: template === 'announcement' ? ctaPath || null : null,
      throttlePerMinute: throttle,
    };
    try {
      if (existing) {
        await api(`/api/admin/campaigns/${existing.id}`, { method: 'PUT', body });
        onDone(existing.id);
      } else {
        const res = await api<{ id: string }>('/api/admin/campaigns', { method: 'POST', body });
        onDone(res.id);
      }
    } catch (err) {
      setError(explain(err));
    } finally {
      setSaving(false);
    }
  }

  const selectedList = lists.find((l) => l.id === listId);

  return (
    <form className="admin-detail" onSubmit={(e) => void submit(e)}>
      <h3>{existing ? 'Edit campaign' : 'New campaign'}</h3>
      <div className="field-group">
        <label htmlFor="camp-name">Internal name</label>
        <input
          id="camp-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          required
          placeholder="Only you see this"
        />
      </div>
      <div className="field-group">
        <label htmlFor="camp-list">Send to</label>
        <select id="camp-list" value={listId} onChange={(e) => setListId(e.target.value)} required>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.sendable} sendable)
            </option>
          ))}
        </select>
        {selectedList?.kind === 'dynamic' && (
          <span className="field-hint">Rebuilt from the userbase right before the send, so it can't go out stale.</span>
        )}
      </div>
      <div className="field-group">
        <label htmlFor="camp-template">Template</label>
        <select id="camp-template" value={template} onChange={(e) => changeTemplate(e.target.value as Template)}>
          <option value="announcement">Announcement — you write the whole body</option>
          <option value="invite">v1 launch invite — fixed feature copy, per-person CTA</option>
        </select>
        <span className="field-hint">
          {template === 'invite'
            ? 'Feature sections and the share block are baked in; the call to action adapts to whether each person posted as a driver or a rider. Skips anyone who already has an account.'
            : 'Headline plus a body you write. One optional button.'}
        </span>
      </div>
      <div className="field-group">
        <label htmlFor="camp-subject">Subject line</label>
        <input id="camp-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} required />
      </div>
      <div className="field-group">
        <label htmlFor="camp-headline">Headline</label>
        <input id="camp-headline" value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={200} />
      </div>
      <div className="field-group">
        <label htmlFor="camp-intro">{template === 'invite' ? 'Opening paragraphs' : 'Body'}</label>
        <textarea id="camp-intro" rows={10} value={intro} onChange={(e) => setIntro(e.target.value)} maxLength={20000} />
        <span className="field-hint">
          {template === 'invite'
            ? 'Blank line between paragraphs. The feature sections, CTA, share block and footer are part of the template.'
            : 'Blank line = new paragraph. “## ” starts a heading, “- ” makes a bullet, **asterisks** bold text, and {{name}} inserts the recipient’s name.'}
        </span>
      </div>
      {template === 'announcement' && (
        <>
          <div className="field-group">
            <label htmlFor="camp-cta-label">Button label (optional)</label>
            <input id="camp-cta-label" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} maxLength={60} />
          </div>
          <div className="field-group">
            <label htmlFor="camp-cta-path">Button link</label>
            <input id="camp-cta-path" value={ctaPath} onChange={(e) => setCtaPath(e.target.value)} maxLength={300} />
            <span className="field-hint">A path like /post, or a full https:// URL. Leave the label blank for no button.</span>
          </div>
        </>
      )}
      <div className="field-group">
        <label htmlFor="camp-throttle">Send rate (emails per minute)</label>
        <input
          id="camp-throttle"
          type="number"
          min={1}
          max={500}
          value={throttle}
          onChange={(e) => setThrottle(Math.max(1, Math.min(500, Math.round(Number(e.target.value) || 1))))}
        />
        <span className="field-hint">Keep it low on a young sending domain. 20/min clears 350 addresses in ~18 min.</span>
      </div>
      {error && <p className="muted">{error}</p>}
      <div className="admin-row admin-actions">
        <button type="submit" className="btn" disabled={saving || !name || !listId}>
          {existing ? 'Save changes' : 'Create'}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function CampaignDetailView({ id, onBack, onChanged }: { id: string; onBack: () => void; onChanged: () => void }) {
  const queryClient = useQueryClient();
  const [previewSegment, setPreviewSegment] = useState<PreviewSegment>('both');
  const [testTo, setTestTo] = useState('');
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  const detail = useQuery({
    queryKey: ['outreach-campaign', id],
    queryFn: () => api<CampaignDetail>(`/api/admin/campaigns/${id}`),
    refetchInterval: (query) => (query.state.data?.campaign.status === 'sending' ? 5_000 : false),
  });
  const campaignList = useQuery({
    queryKey: ['outreach-campaigns'],
    queryFn: () => api<CampaignListResponse>('/api/admin/campaigns'),
  });
  const lists = useQuery({
    queryKey: ['outreach-lists'],
    queryFn: () => api<{ lists: ListRow[]; audiences: Audience[] }>('/api/admin/lists'),
  });

  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: ['outreach-campaign', id] });
    onChanged();
  }

  async function act(path: string, confirmText?: string): Promise<void> {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    try {
      await api(`/api/admin/campaigns/${id}${path}`, { method: 'POST', body: {} });
      invalidate();
    } catch (err) {
      window.alert(explain(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(): Promise<void> {
    if (!window.confirm('Delete this campaign and its send history?')) return;
    setBusy(true);
    try {
      await api(`/api/admin/campaigns/${id}`, { method: 'DELETE' });
      onChanged();
      onBack();
    } catch (err) {
      window.alert(explain(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendTest(): Promise<void> {
    setBusy(true);
    setTestStatus(null);
    try {
      const res = await api<{ sent: boolean; dryRun: boolean }>(`/api/admin/campaigns/${id}/test`, {
        method: 'POST',
        body: { to: testTo, segment: previewSegment },
      });
      setTestStatus(
        res.dryRun ? 'Dry run — logged, not delivered' : res.sent ? 'Sent ✓' : 'Blocked (suppressed address)',
      );
    } catch (err) {
      setTestStatus(explain(err));
    } finally {
      setBusy(false);
    }
  }

  if (detail.isLoading || detail.isError || !detail.data) return <Loading q={detail} />;

  const c = detail.data.campaign;
  const sending = c.status === 'sending';

  if (editing && campaignList.data && lists.data) {
    return (
      <section className="card">
        <button className="admin-inline-link" onClick={() => setEditing(false)}>
          ← Back to campaign
        </button>
        <CampaignForm
          defaults={campaignList.data.defaults}
          lists={lists.data.lists}
          existing={c}
          onDone={() => {
            setEditing(false);
            invalidate();
          }}
          onCancel={() => setEditing(false)}
        />
      </section>
    );
  }

  return (
    <section className="card">
      <button className="admin-inline-link" onClick={onBack}>
        ← All campaigns
      </button>
      <h2>
        {c.name} <span className={`pill ${sending ? 'pill-warn' : 'pill-dim'}`}>{c.status}</span>{' '}
        <span className="pill pill-dim">{c.template}</span>
      </h2>
      <p className="muted">
        {c.subject} · to “{detail.data.listName}” ({detail.data.listSendable} sendable) · {c.throttlePerMinute}/min ·
        started {fmt(c.startedAt)} · finished {fmt(c.finishedAt)}
      </p>

      <div className="admin-stats">
        {detail.data.breakdown.map((b) => (
          <Stat key={b.status} label={b.status} value={b.n} />
        ))}
        {detail.data.breakdown.length === 0 && <Stat label="recipients" value={0} />}
      </div>

      <div className="admin-row admin-actions">
        {!sending && c.status !== 'done' && (
          <button
            className="btn"
            disabled={busy}
            onClick={() => void act('/start', `Send this to ${detail.data.listSendable} people, for real?`)}
          >
            {c.status === 'paused' ? 'Resume sending' : 'Start sending'}
          </button>
        )}
        {c.status === 'done' && (
          <button
            className="btn-secondary"
            disabled={busy}
            onClick={() => void act('/start', 'Send to anyone added to the list since last time?')}
          >
            Send to new contacts
          </button>
        )}
        {sending && (
          <button className="btn-danger" disabled={busy} onClick={() => void act('/pause')}>
            Pause
          </button>
        )}
        <button className="btn-ghost" disabled={busy || sending} onClick={() => setEditing(true)}>
          Edit
        </button>
        <button className="btn-ghost" disabled={busy} onClick={() => void act('/retry-failed')}>
          Retry failed
        </button>
        <button className="btn-danger" disabled={busy || sending} onClick={() => void remove()}>
          Delete
        </button>
      </div>

      <div className="admin-detail">
        <h3>Send a test to yourself</h3>
        <div className="admin-toolbar">
          <input
            className="admin-search"
            type="email"
            placeholder="you@example.com"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
          />
          {c.template === 'invite' && (
            <select
              value={previewSegment}
              onChange={(e) => setPreviewSegment(e.target.value as PreviewSegment)}
              aria-label="Preview as"
            >
              <option value="both">as both</option>
              <option value="rider">as a rider</option>
              <option value="driver">as a driver</option>
            </select>
          )}
          <button className="btn-secondary" disabled={busy || !testTo} onClick={() => void sendTest()}>
            Send test
          </button>
        </div>
        {testStatus && <p className="muted">{testStatus}</p>}
      </div>

      <div className="admin-detail">
        <h3>Preview</h3>
        <iframe
          className="admin-email-preview"
          title="Campaign email preview"
          src={`/api/admin/campaigns/${id}/preview?segment=${previewSegment}`}
        />
      </div>

      {detail.data.problems.length > 0 && (
        <div className="admin-detail">
          <h3>Failures</h3>
          {detail.data.problems.map((p) => (
            <div key={p.email} className="admin-email-row muted">
              {p.email} · {p.attempts} attempts · {p.error ?? 'unknown'}
            </div>
          ))}
        </div>
      )}

      {detail.data.recent.length > 0 && (
        <div className="admin-detail">
          <h3>Most recent sends</h3>
          {detail.data.recent.map((r) => (
            <div key={r.email} className="admin-email-row muted">
              {fmt(r.sentAt)} · {r.status} · {r.email}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- Tab root ---------- */

export default function AdminOutreachTab() {
  const [subTab, setSubTab] = useState<SubTab>('lists');
  const [openListId, setOpenListId] = useState<string | null>(null);
  const [openCampaignId, setOpenCampaignId] = useState<string | null>(null);

  return (
    <>
      <div className="seg admin-tabs" role="tablist" aria-label="Outreach sections">
        <button
          type="button"
          aria-pressed={subTab === 'lists'}
          onClick={() => {
            setSubTab('lists');
            setOpenCampaignId(null);
          }}
        >
          Lists
        </button>
        <button
          type="button"
          aria-pressed={subTab === 'campaigns'}
          onClick={() => {
            setSubTab('campaigns');
            setOpenListId(null);
          }}
        >
          Campaigns
        </button>
      </div>

      {subTab === 'lists' &&
        (openListId ? (
          <ListDetail id={openListId} onBack={() => setOpenListId(null)} />
        ) : (
          <ListsPanel onOpenList={setOpenListId} />
        ))}

      {subTab === 'campaigns' && <CampaignsPanel openId={openCampaignId} onOpen={setOpenCampaignId} />}
    </>
  );
}
