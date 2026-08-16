import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { buildShareAndPatch, needsIntro, startConversation, useLastSentMessage } from '../api/messages';
import { useMe } from '../api/session';
import { enqueue } from '../offline/outbox';
import { useConnectivity } from '../offline/connectivity';
import type { Listing, Me, SendMessageInput } from '../api/types';
import { directionArrow, formatTravelDate } from '../lib/format';
import PhoneInput from './PhoneInput';
import PhotoAttach, { type AttachedPhoto } from './PhotoAttach';
import { showToast } from './Toast';

interface MessageComposerProps {
  listing: Listing;
  onClose: () => void;
}

interface IntroduceYourselfFieldsProps {
  me: Me | null | undefined;
  /** Whose listing this is — used in the hint so the ask has an obvious reason. */
  recipientName: string;
  name: string;
  onNameChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  idPrefix?: string;
}

/** Collects the name/email the server requires before any message can be sent.
 *  Renders nothing once the profile already has both. Shared by the new-conversation
 *  composer and the thread reply composer. */
export function IntroduceYourselfFields({
  me,
  recipientName,
  name,
  onNameChange,
  email,
  onEmailChange,
  idPrefix = 'intro',
}: IntroduceYourselfFieldsProps) {
  const missing = needsIntro(me);
  if (!missing.name && !missing.email) return null;

  return (
    <div className="share-fields">
      <p className="share-fields-label">Introduce yourself</p>
      <p className="field-hint">
        Needed so {recipientName} knows who&rsquo;s asking and replies can reach you. Never shown
        publicly.
      </p>

      {missing.name && (
        <div className="field-group">
          <label htmlFor={`${idPrefix}-name`}>Your name</label>
          <input
            id={`${idPrefix}-name`}
            type="text"
            required
            maxLength={60}
            placeholder="Playa name or first name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
          />
        </div>
      )}

      {missing.email && (
        <div className="field-group">
          <label htmlFor={`${idPrefix}-email`}>Your email</label>
          <input
            id={`${idPrefix}-email`}
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

interface ShareContactFieldsProps {
  me: Me | null | undefined;
  /** Live value of the introduce-yourself email when that block is collecting one.
   *  Present (even as '') means: mirror it in the row label and never render a
   *  second email input — the address is already being typed above. */
  mirroredEmail?: string;
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
  mirroredEmail,
  shareEmail,
  sharePhone,
  onShareEmailChange,
  onSharePhoneChange,
  newEmail,
  onNewEmailChange,
  newPhone,
  onNewPhoneChange,
}: ShareContactFieldsProps) {
  const mirroring = mirroredEmail !== undefined;
  const emailLabel = me?.email
    ? `Email — ${me.email}`
    : mirroring
      ? mirroredEmail.trim()
        ? `Email — ${mirroredEmail.trim()}`
        : 'Email — enter above'
      : 'Email — add one';

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
        <span>{emailLabel}</span>
      </label>
      {shareEmail && !me?.email && !mirroring && (
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
  const [introName, setIntroName] = useState(me?.name ?? '');
  const [introEmail, setIntroEmail] = useState('');
  const [photo, setPhoto] = useState<AttachedPhoto | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  // Text queues offline; a photo cannot, since the bytes go up before the send.
  const { status: connectivity } = useConnectivity();
  // People messaging many listings resend near-identical intros; one tap pulls
  // the previous text, photo, and share choices back in, all still editable.
  const { data: lastSent } = useLastSentMessage();
  const [reuseApplied, setReuseApplied] = useState(false);

  if (listing.isMine) return null;

  const missing = needsIntro(me);
  const last = lastSent?.message ?? null;
  const canReuse = last !== null && !reuseApplied;

  function handleReuse(): void {
    if (!last) return;
    setBody(last.body);
    setPhoto(
      last.photoId && last.photoThumbUrl && last.photoWidth !== null && last.photoHeight !== null
        ? {
            photoId: last.photoId,
            width: last.photoWidth,
            height: last.photoHeight,
            // A server URL, not an object URL: the previous upload previews
            // straight from the API (revokeObjectURL on it is a harmless no-op).
            previewUrl: last.photoThumbUrl,
          }
        : null,
    );
    setShareEmail(last.sharedEmail);
    setSharePhone(last.sharedPhone);
    setReuseApplied(true);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    // A photo on its own is a message; text alone still is too.
    if ((!body.trim() && !photo) || uploadingPhoto) return;

    const { share, patch } = buildShareAndPatch(me, {
      shareEmail,
      sharePhone,
      newEmail,
      newPhone,
      introName,
      introEmail,
    });

    // FIFO outbox: queue the profile update first so it lands before the
    // message, even if both are still queued when connectivity returns.
    if (patch) {
      void enqueue({ label: 'update contact', method: 'PATCH', path: '/api/me', body: patch });
    }

    const input: SendMessageInput = {
      clientId: crypto.randomUUID(),
      body: body.trim(),
      ...(photo ? { photoId: photo.photoId } : {}),
      share,
    };

    if (photo) URL.revokeObjectURL(photo.previewUrl);
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
          {canReuse && (
            <div className="composer-reuse">
              <button type="button" className="btn-secondary" onClick={handleReuse}>
                ↩️ Reuse last message
              </button>
              <span className="field-hint">
                Fills in your previous text{last?.photoId ? ', photo,' : ' and'} share settings —
                edit anything before sending.
              </span>
            </div>
          )}

          <IntroduceYourselfFields
            me={me}
            recipientName={listing.name}
            name={introName}
            onNameChange={setIntroName}
            email={introEmail}
            onEmailChange={setIntroEmail}
            idPrefix="composer-intro"
          />

          <div className="field-group">
            <label htmlFor="composer-body">Your message</label>
            <textarea
              id="composer-body"
              autoFocus
              // Not required once a photo is attached — the photo is the message.
              required={!photo}
              maxLength={2000}
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <PhotoAttach
              photo={photo}
              onChange={setPhoto}
              onUploadingChange={setUploadingPhoto}
              disabled={connectivity === 'offline'}
            />
          </div>

          <ShareContactFields
            me={me}
            mirroredEmail={missing.email ? introEmail : undefined}
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
