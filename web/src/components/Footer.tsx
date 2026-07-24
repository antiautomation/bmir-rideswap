import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="site-footer">
      <p>
        Built with 🔥 by <strong>Wavy Davy</strong> &amp; the <strong>BMIR 94.5 FM</strong> family —
        a free community service, by burners, for burners.
      </p>
      <p>
        Not affiliated with the Burning Man Project or Black Rock City LLC. Ride at your own
        judgment. Leave no trace.
      </p>
      <nav className="site-footer-links" aria-label="Footer">
        <Link to="/privacy">Privacy Policy</Link>
        <a href="mailto:matching@ridefinder.site">Contact</a>
        <Link to="/">Board</Link>
      </nav>
    </footer>
  );
}
