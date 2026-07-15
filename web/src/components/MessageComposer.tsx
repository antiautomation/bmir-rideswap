import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { buildShareAndPatch, startConversation } from '../api/messages';
import { useMe } from '../api/session';
import { enqueue } from '../offline/outbox';
import type { Listing, Me, SendMessageInput } from '../api/types';
import { directionArrow, formatTravelDate } from '../lib/format';
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

/** Shared checkbox UI for opting to share profile contact info in a message.
 *  Used by both the composer (new conversation) and the thread reply bar. */
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
    <div className="share-contact">
      <span className="form-section-title">Share my contact info</span>
      <p className="field-hint">
        Off by default. If shared, it appears inside this message only — never on the public
        board.
      </p>

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={shareEmail}
          onChange={(e) => onShareEmailChange(e.target.checked)}
        />
        {me?.email ? `Share my email (${me.email})` : 'Share my email'}
      </label>
      {shareEmail && !me?.email && (
        <input
          type="email"
          placeholder="you@example.com"
          value={newEmail}
          onChange={(e) => onNewEmailChange(e.target.value)}
          aria-label="Email to share"
        />
      )}

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={sharePhone}
          onChange={(e) => onSharePhoneChange(e.target.checked)}
        />
        {me?.phone ? `Share my phone (${me.phone})` : 'Share my phone'}
      </label>
      {sharePhone && !me?.phone && (
        <input
          type="tel"
          placeholder="(555) 555-5555"
          value={newPhone}
          onChange={(e) => onNewPhoneChange(e.target.value)}
          aria-label="Phone to share"
        />
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
          <div className="form-field">
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

          <div className="composer-actions">
            <button type="button" className="button-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="form-submit">
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
