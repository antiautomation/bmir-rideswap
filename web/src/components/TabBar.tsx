import { NavLink } from 'react-router-dom';
import { useUnreadTotal } from '../api/messages';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'tab-bar-link active' : 'tab-bar-link';

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function BoardIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
      <path d="M8 4v5" />
    </svg>
  );
}

function PostIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function MatchesIcon() {
  return (
    <svg {...iconProps}>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v5h-5" />
    </svg>
  );
}

function MessagesIcon() {
  return (
    <svg {...iconProps}>
      <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}

export default function TabBar() {
  const unread = useUnreadTotal();

  return (
    <nav className="tab-bar" aria-label="Primary">
      <NavLink to="/" end className={navLinkClass}>
        <BoardIcon />
        Board
      </NavLink>
      <NavLink to="/post" className={navLinkClass}>
        <PostIcon />
        Post
      </NavLink>
      <NavLink to="/matches" className={navLinkClass}>
        <MatchesIcon />
        Matches
      </NavLink>
      <NavLink to="/messages" className={navLinkClass}>
        <span className="tab-bar-icon-wrap">
          <MessagesIcon />
          {unread > 0 && (
            <span className="unread-badge" aria-label={`${unread} unread messages`}>
              {unread}
            </span>
          )}
        </span>
        Messages
      </NavLink>
      <NavLink to="/me" className={navLinkClass}>
        <ProfileIcon />
        You
      </NavLink>
    </nav>
  );
}
