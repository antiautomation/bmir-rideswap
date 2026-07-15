import { NavLink } from 'react-router-dom';

const navLinkClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : undefined);

export default function Header() {
  return (
    <header className="header">
      <div className="header-brand">
        <NavLink to="/" className="header-wordmark">
          RideFinder
        </NavLink>
        <span className="header-tagline">rides to &amp; from Black Rock City</span>
      </div>
      <nav className="header-nav" aria-label="Primary">
        <NavLink to="/" end className={navLinkClass}>
          Board
        </NavLink>
        <NavLink to="/post" className={navLinkClass}>
          Post a ride
        </NavLink>
        <NavLink to="/matches" className={navLinkClass}>
          Matches
        </NavLink>
        <NavLink to="/messages" className={navLinkClass}>
          Messages
        </NavLink>
        <NavLink to="/me" className={navLinkClass}>
          You
        </NavLink>
      </nav>
    </header>
  );
}
