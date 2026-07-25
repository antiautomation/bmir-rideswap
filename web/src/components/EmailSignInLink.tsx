import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api/client';

/* Email sign-in links. Two entry points share one request + one status set:
   - EmailSignInLinkForm: the standing "get a link" option next to recovery codes.
   - EmailTakenNotice: the inline 409 offer, shown when an email is on another account.
   The server answers /api/session/email-link identically whether or not the account
   exists, so the confirmation copy must stay neutral. */

type LinkStatus = 'idle' | 'busy' | 'sent' | 'rate_limited' | 'invalid' | 'failed';

const SENT_COPY =
  'If that address has a RideFinder account, a sign-in link is on its way. Check your inbox.';

async function requestEmailLink(email: string): Promise<LinkStatus> {
  try {
    await api('/api/session/email-link', { method: 'POST', body: { email } });
    return 'sent';
  } catch (err) {
    if (err instanceof ApiError && err.status === 429) return 'rate_limited';
    if (err instanceof ApiError && err.status === 400) return 'invalid';
    return 'failed';
  }
}

function StatusNote({ status }: { status: LinkStatus }) {
  if (status === 'rate_limited') {
    return <p className="form-note form-note--error">Too many requests — try again in a bit.</p>;
  }
  if (status === 'invalid') {
    return <p className="form-note form-note--error">That doesn&rsquo;t look like an email address.</p>;
  }
  if (status === 'failed') {
    return <p className="form-note form-note--error">Couldn&rsquo;t send the link — try again in a moment.</p>;
  }
  return null;
}

/** Standing "email me a link" option — lives beside the recovery-code form. */
export function EmailSignInLinkForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<LinkStatus>('idle');

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('busy');
    setStatus(await requestEmailLink(email.trim()));
  }

  return (
    <div className="email-link-block">
      <span className="field-group-label">Or get a sign-in link by email</span>
      {status === 'sent' ? (
        <p className="form-note">{SENT_COPY}</p>
      ) : (
        <>
          <form className="recover-row" onSubmit={(e) => void handleSubmit(e)}>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email address"
            />
            <button type="submit" className="btn-secondary" disabled={status === 'busy'}>
              Email me a link
            </button>
          </form>
          <StatusNote status={status} />
        </>
      )}
    </div>
  );
}

/** Inline error for a 409 email_taken, with a one-click way back into the other
 *  account. Rendered inside existing <form>s, so the trigger is a plain button. */
export function EmailTakenNotice({ email }: { email: string }) {
  const [status, setStatus] = useState<LinkStatus>('idle');

  async function handleClick(): Promise<void> {
    setStatus('busy');
    setStatus(await requestEmailLink(email));
  }

  if (status === 'sent') return <p className="form-note">{SENT_COPY}</p>;

  return (
    <div className="email-taken">
      <p className="form-note form-note--error">
        That email already belongs to another RideFinder account.
      </p>
      <button
        type="button"
        className="btn-secondary"
        disabled={status === 'busy'}
        onClick={() => void handleClick()}
      >
        📧 Email me a sign-in link
      </button>
      <StatusNote status={status} />
    </div>
  );
}
