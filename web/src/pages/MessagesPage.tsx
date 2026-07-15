import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import { useConversations } from '../api/messages';
import { directionArrow, formatTravelDate, timeAgo } from '../lib/format';

export default function MessagesPage() {
  const { data, isLoading, isError } = useConversations();
  const conversations = data?.conversations ?? [];

  if (isLoading) {
    return <p className="board-loading">Loading messages…</p>;
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        title="No messages yet"
        hint="Message someone from the board and replies land here."
      />
    );
  }

  return (
    <div className="inbox-page">
      <h1>Messages</h1>

      {isError && <p className="board-stale-notice">Showing saved conversations — reconnecting…</p>}

      <ul className="inbox-list">
        {conversations.map((c) => {
          const cancelled = Boolean(c.listing.cancelledAt);
          const unread = c.unreadCount > 0;
          const previewText = c.lastMessage
            ? `${c.lastMessage.isMine ? 'You: ' : ''}${c.lastMessage.body}`
            : 'No messages yet';
          const when = c.lastMessage ? timeAgo(c.lastMessage.createdAt) : timeAgo(c.createdAt);

          return (
            <li key={c.id}>
              <Link
                to={`/messages/${c.id}`}
                className={cancelled ? 'inbox-row inbox-row--cancelled' : 'inbox-row'}
              >
                <span className="inbox-unread-dot" data-visible={unread} aria-hidden="true" />
                <div className="inbox-row-main">
                  <div className="inbox-row-top">
                    <span className={unread ? 'inbox-row-name unread' : 'inbox-row-name'}>
                      {c.counterpartName}
                    </span>
                    <span className="inbox-row-time">{when}</span>
                  </div>
                  <div className="inbox-row-chip">
                    {c.listing.type === 'driver' ? '🚗' : '🎒'} {directionArrow(c.listing.direction)} ·{' '}
                    {formatTravelDate(c.listing.travelDate)}
                    {cancelled && ' · (cancelled)'}
                  </div>
                  <div className="inbox-row-preview">{previewText}</div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
