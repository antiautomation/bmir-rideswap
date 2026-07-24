import { Link } from 'react-router-dom';
import Avatar from '../components/Avatar';
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

      <ul className="card inbox-list">
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
                className={
                  cancelled
                    ? 'inbox-row inbox-row--cancelled'
                    : c.counterpartAvatarVersion
                      ? 'inbox-row inbox-row--avatar'
                      : 'inbox-row'
                }
              >
                {c.counterpartAvatarVersion ? (
                  <span className="inbox-avatar-slot">
                    <Avatar
                      thumbSrc={`/api/conversations/${c.id}/avatar-thumb?v=${c.counterpartAvatarVersion}`}
                      fullSrc={`/api/conversations/${c.id}/avatar?v=${c.counterpartAvatarVersion}`}
                      name={c.counterpartName}
                      size={40}
                    />
                    <span className="inbox-dot inbox-dot--overlay" data-visible={unread} aria-hidden="true" />
                  </span>
                ) : (
                  <span className="inbox-dot" data-visible={unread} aria-hidden="true" />
                )}
                <div className="inbox-main">
                  <span className={unread ? 'inbox-name unread' : 'inbox-name'}>
                    {c.counterpartName}
                  </span>
                  <span className="inbox-context">
                    {c.listing.type === 'driver' ? '🚗' : '🎒'} {directionArrow(c.listing.direction)} ·{' '}
                    {formatTravelDate(c.listing.travelDate)}
                    {cancelled && ' · (cancelled)'}
                  </span>
                  <span className="inbox-preview">{previewText}</span>
                </div>
                <span className="inbox-time">{when}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
