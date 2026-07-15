import { useState } from 'react';
import { useMe } from '../api/session';
import { useStoredState } from '../lib/prefs';

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function RecoveryCodeNotice() {
  const { data: me } = useMe();
  const [acknowledged, setAcknowledged] = useStoredState('ridefinder-code-ack-v1', false);
  const [copied, setCopied] = useState(false);

  if (!me?.recoveryCode || acknowledged) return null;

  const code = me.recoveryCode;

  async function handleCopy(): Promise<void> {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="recovery-code-title">
      <div className="modal-sheet">
        <h2 id="recovery-code-title">Save your session code</h2>
        <p className="recovery-code-display">{code}</p>
        <button type="button" className="button-secondary" onClick={() => void handleCopy()}>
          {copied ? 'Copied ✓' : 'Copy code'}
        </button>
        <p className="modal-body-text">
          This code is your only key to this session. Enter it on any device (menu → You →
          Recover) to pick up your listings and messages there. Screenshot it or write it on your
          arm.
        </p>
        <button type="button" className="form-submit" onClick={() => setAcknowledged(true)}>
          I saved it
        </button>
      </div>
    </div>
  );
}
