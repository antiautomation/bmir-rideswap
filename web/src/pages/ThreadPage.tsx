import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import EmptyState from '../components/EmptyState';
import { ShareContactFields } from '../components/MessageComposer';
import { showToast } from '../components/Toast';
import { ApiError } from '../api/client';
import { buildShareAndPatch, sendReply, useThread } from '../api/messages';
import { useMe } from '../api/session';
import { enqueue } from '../offline/outbox';
import type { Message } from '../api/types';
import { directionArrow, formatTravelDate, timeAgo } from '../lib/format';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function MessageBubble({ message }: { message: Message }) {
  return (
    <div className={message.isMine ? 'bubble-row bubble-row--mine' : 'bubble-row bubble-row--theirs'}>
      <div className={message.isMine ? 'bubble bubble--mine' : 'bubble bubble--theirs'}>
        <p className="bubble-body">{message.body}</p>

        {(message.sharedEmail || message.sharedPhone) && (
          <div className="bubble-contact">
            <p className="bubble-contact-title">📇 Shared contact:</p>
            {message.sharedEmail && <a href={`mailto:${message.sharedEmail}`}>{message.sharedEmail}</a>}
            {message.sharedPhone && (
              <span className="bubble-contact-phone">
                <a href={`sms:${message.sharedPhone}`}>{message.sharedPhone}</a>
                <a href={`tel:${message.sharedPhone}`}>Call</a>
              </span>
            )}
          </div>
        )}

        <p className="bubble-meta">{message.pending ? '⏱ sending…' : timeAgo(message.createdAt)}</p>
      </div>
    </div>
  );
}

export default function ThreadPage() {
  const { convId } = useParams<{ convId: string }>();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { data, isLoading, isError, error } = useThread(convId);
  const listRef = useRef<HTMLDivElement | null>(null);

  const [body, setBody] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [shareEmail, setShareEmail] = useState(false);
  const [sharePhone, setSharePhone] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const messages = data?.messages ?? [];

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight });
  }, [messages.length]);

  if (!convId) {
    return <EmptyState title="Conversation not found" hint="Head back to your messages." />;
  }

  if (isError) {
    const status = error instanceof ApiError ? error.status : null;
    if (status === 403 || status === 404) {
      return (
        <div className="thread-page">
          <EmptyState
            title="Conversation not found"
            hint="It may have been removed, or it isn't yours."
          />
          <p>
            <Link to="/messages" className="back-link">
              ← Messages
            </Link>
          </p>
        </div>
      );
    }
    return (
      <div className="thread-page">
        <EmptyState
          title="Couldn't load this conversation"
          hint="Check your connection and try again."
        />
      </div>
    );
  }

  if (isLoading && !data) {
    return <p className="board-loading">Loading conversation…</p>;
  }

  if (!data) {
    return <EmptyState title="Conversation not found" />;
  }

  function handleSend(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!body.trim() || !convId) return;

    const { share, patch } = buildShareAndPatch(me, { shareEmail, sharePhone, newEmail, newPhone });

    // FIFO outbox: queue the profile update first so it lands before the reply.
    if (patch) {
      void enqueue({ label: 'update contact', method: 'PATCH', path: '/api/me', body: patch });
    }

    sendReply(queryClient, convId, {
      clientId: crypto.randomUUID(),
      body: body.trim(),
      share,
    });

    showToast(
      navigator.onLine ? 'Message sent' : "Message queued — it will send when you're online",
    );

    setBody('');
    setShowShare(false);
    setShareEmail(false);
    setSharePhone(false);
    setNewEmail('');
    setNewPhone('');
  }

  let lastKey = '';

  return (
    <div className="thread-page">
      <div className="thread-header">
        <Link to="/messages" className="back-link">
          ← Messages
        </Link>
        <h1 className="thread-counterpart">{data.counterpartName}</h1>
        <Link to={`/listing/${data.listing.id}`} className="thread-listing-link">
          {data.listing.type === 'driver' ? '🚗' : '🎒'} {directionArrow(data.listing.direction)} ·{' '}
          {formatTravelDate(data.listing.travelDate)}
          {data.listing.cancelledAt && ' · (cancelled)'}
        </Link>
      </div>

      <div className="thread-messages" ref={listRef}>
        {messages.map((m) => {
          const key = dayKey(m.createdAt);
          const showDivider = key !== lastKey;
          lastKey = key;
          return (
            <div key={m.id}>
              {showDivider && (
                <div className="day-divider">
                  <span>{dayLabel(m.createdAt)}</span>
                </div>
              )}
              <MessageBubble message={m} />
            </div>
          );
        })}
      </div>

      <form className="reply-bar" onSubmit={handleSend}>
        <textarea
          className="reply-textarea"
          placeholder="Write a reply…"
          maxLength={2000}
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        <details
          className="reply-share-disclosure"
          open={showShare}
          onToggle={(e) => setShowShare(e.currentTarget.open)}
        >
          <summary>+ share contact</summary>
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
        </details>

        <button type="submit" className="reply-send">
          Send
        </button>
      </form>
    </div>
  );
}
