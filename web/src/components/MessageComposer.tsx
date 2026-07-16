import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { buildShareAndPatch, startConversation } from '../api/messages';
import { useMe } from '../api/session';
import { enqueue } from '../offline/outbox';
import type { Listing, Me, SendMessageInput } from '../api/types';
import { directionArrow, formatTravelDate } from '../lib/format';
import PhoneInput from './PhoneInput';
import { showToast } from './Toast';

interface MessageComposerProps {
  listing: Listing;
  onClose: () => void;
}

interface ShareContactFieldsProps {
  me: Me | null | undefined;
  shareEmail: boolean;
  sharePhone: boolean;
  onShareEmailChange: (value: boolean) => void;
  onSharePhoneChange: (value: boolean) => void;
  newEmail: string;
  onNewEmailChange: (value: string) => void;
  newPhone: string;
  onNewPhoneChange: (value: string) => void;
}

/** Shared share-contact UI for opting to include profile contact info in a message.
 *  Used by both the composer modal (new conversation) and the thread composer. */
export function ShareContactFields({
  me,
  shareEmail,
  sharePhone,
  onShareEmailChange,
  onSharePhoneChange,
  newEmail,
  onNewEmailChange,
  newPhone,
  onNewPhoneChange,
}: ShareContactFieldsProps) {
  return (
    <div className="share-fields">
      <p className="share-fields-label">Share contact info</p>
      <p className="field-hint">
        Off by default. If shared, it appears inside this message only — never on the public
        board.
      </p>

      <label className="share-row">
        <input
          type="checkbox"
          checked={shareEmail}
          onChange={(e) => onShareEmailChange(e.target.checked)}
        />
        <span>{me?.email ? `Email — ${me.email}` : 'Email — add one'}</span>
      </label>
      {shareEmail && !me?.email && (
        <input
          type="email"
          className="share-row-input"
          placeholder="you@example.com"
          value={newEmail}
          onChange={(e) => onNewEmailChange(e.target.value)}
          aria-label="Email to share"
        />
      )}

      <label className="share-row">
        <input
          type="checkbox"
          checked={sharePhone}
          onChange={(e) => onSharePhoneChange(e.target.checked)}
        />
        <span>{me?.phone ? `Phone — ${me.phone}` : 'Phone — add one'}</span>
      </label>
      {sharePhone && !me?.phone && (
        <div className="share-row-input">
          <PhoneInput value={newPhone} onChange={onNewPhoneChange} />
        </div>
      )}
    </div>
  );
}

export default function MessageComposer({ listing, onClose }: MessageComposerProps) {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const [body, setBody] = useState('');
  const [shareEmail, setShareEmail] = useState(false);
  const [sharePhone, setSharePhone] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  if (listing.isMine) return null;

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!body.trim()) return;

    const { share, patch } = buildShareAndPatch(me, { shareEmail, sharePhone, newEmail, newPhone });

    // FIFO outbox: queue the profile update first so it lands before the
    // message, even if both are still queued when connectivity returns.
    if (patch) {
      void enqueue({ label: 'update contact', method: 'PATCH', path: '/api/me', body: patch });
    }

    const input: SendMessageInput = {
      clientId: crypto.randomUUID(),
      body: body.trim(),
      share,
    };

    startConversation(queryClient, listing.id, input);

    showToast(
      navigator.onLine ? 'Message sent' : "Message queued — it will send when you're online",
    );
    onClose();
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="composer-title"
    >
      <div className="modal-sheet">
        <h2 id="composer-title">Message {listing.name}</h2>
        <p className="composer-listing-summary">
          {listing.type === 'driver' ? '🚗' : '🎒'} {directionArrow(listing.direction)} ·{' '}
          {formatTravelDate(listing.travelDate)}
        </p>

        <form className="composer-form" onSubmit={handleSubmit}>
          <div className="field-group">
            <label htmlFor="composer-body">Your message</label>
            <textarea
              id="composer-body"
              autoFocus
              required
              maxLength={2000}
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <ShareContactFields
            me={me}
            shareEmail={shareEmail}
            sharePhone={sharePhone}
            onShareEmailChange={setShareEmail}
            onSharePhoneChange={setSharePhone}
            newEmail={newEmail}
            onNewEmailChange={setNewEmail}
            newPhone={newPhone}
            onNewPhoneChange={setNewPhone}
          />

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn">
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
