import { Link } from 'react-router-dom';

/* Ported from legacy/privacy.html (v1, Aug 2025) with facts updated for v2:
   contact info is now private-by-default, Firebase/Analytics/reCAPTCHA are gone,
   hosting moved to Railway, email runs through Amazon SES. The comprehensive
   liability release keeps its original spirit. */
export default function PrivacyPage() {
  return (
    <article className="privacy-page">
      <Link to="/" className="btn-ghost">
        ← Back to RideFinder
      </Link>
      <h1>Privacy Policy</h1>
      <p className="muted">
        RideFinder — rides to &amp; from Black Rock City · Last updated: July 2026
      </p>

      <section className="card privacy-callout">
        <p>
          <strong>⚠️ Important disclaimer:</strong> by using this website and application, you
          acknowledge and agree that you are using this service at your own risk and that you
          release all parties from any and all liability.
        </p>
      </section>

      <h2>1. Introduction</h2>
      <p>
        This Privacy Policy describes how RideFinder (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or
        &ldquo;the Service&rdquo;) collects, uses, and protects your information when you use our
        rideshare coordination service. It applies to all users — drivers, riders, and visitors.
      </p>

      <h2>2. Information we collect</h2>
      <h3>Information you provide</h3>
      <ul>
        <li>A display name (playa names welcome)</li>
        <li>Contact information (email and/or phone) — see section 4 for how it&rsquo;s protected</li>
        <li>Travel details (departure city, direction, dates, time windows, gear volume)</li>
        <li>Messages you send to other users</li>
        <li>A session code, which acts as your login</li>
      </ul>
      <h3>Collected automatically</h3>
      <ul>
        <li>Standard server logs (IP address, browser type) kept briefly for security</li>
        <li>
          One session cookie (httpOnly) that keeps you signed in, and local storage on your device
          for preferences and offline caching
        </li>
        <li>
          <strong>No analytics, no tracking cookies, no advertising identifiers.</strong> The v1
          site used Google Analytics and reCAPTCHA; v2 uses neither.
        </li>
      </ul>

      <h2>3. How we use your information</h2>
      <ul>
        <li>To run the board: show listings, deliver messages, compute ride matches</li>
        <li>To email you about new messages and matches, at the frequency you choose</li>
        <li>To keep the service safe (rate limits, spam prevention, moderation of reports)</li>
        <li>To comply with legal obligations</li>
      </ul>

      <h2>4. Your contact info is private by default</h2>
      <p>
        Unlike v1 (and most ride boards), your email and phone number are{' '}
        <strong>never displayed publicly</strong>. They are:
      </p>
      <ul>
        <li>Stored on your private profile, visible only to you</li>
        <li>
          Shared only when <em>you</em> tick a share box inside a specific message — and then only
          with that one person
        </li>
        <li>Used by us to send you the email updates you asked for</li>
      </ul>
      <p>We may disclose information if required by law, or to protect users&rsquo; safety.</p>

      <h2>5. Third-party services</h2>
      <ul>
        <li>
          <strong>Railway</strong> — application hosting and database (United States)
        </li>
        <li>
          <strong>Amazon Web Services (SES)</strong> — sends our email notifications
        </li>
      </ul>
      <p>
        That&rsquo;s the whole list. These providers have their own privacy policies. Google
        Firebase, Google Analytics, Google reCAPTCHA, and DreamHost — used by v1 — are no longer
        part of the service.
      </p>

      <h2>6. Data retention</h2>
      <ul>
        <li>Listings expire a few hours after their travel window and stop being publicly browsable within 7 days</li>
        <li>Messages remain visible to their participants until deleted</li>
        <li>Sessions last up to a year unless you sign out; magic-link tokens expire after 30 days</li>
        <li>Email delivery logs are kept for operational troubleshooting</li>
        <li>
          Want everything erased? Email{' '}
          <a href="mailto:matching@ridefinder.site">matching@ridefinder.site</a> from the address on
          your profile and we&rsquo;ll delete your account and associated data
        </li>
      </ul>

      <h2>7. Your rights</h2>
      <ul>
        <li>Access, update, or correct your information any time from the You page</li>
        <li>Deactivate or delete your listings yourself</li>
        <li>Change email frequency or unsubscribe entirely (You → Email settings, or any email footer)</li>
        <li>Request full deletion or a copy of your data by email</li>
      </ul>

      <h2>8. Security</h2>
      <p>
        Data is encrypted in transit; session credentials are stored hashed; access to production
        systems is restricted. No method of transmission or storage is 100% secure — please
        don&rsquo;t put anything in a message you wouldn&rsquo;t want leaked in a dust storm.
      </p>

      <h2>9. Children&rsquo;s privacy</h2>
      <p>
        The service is not intended for children under 13, and we do not knowingly collect their
        information.
      </p>

      <h2>10. International users</h2>
      <p>
        The service is operated from the United States; your information is stored and processed
        there.
      </p>

      <h2>11. Changes to this policy</h2>
      <p>
        We may update this policy from time to time; the &ldquo;Last updated&rdquo; date above will
        change when we do. Continued use of the service constitutes acceptance.
      </p>

      <section className="card privacy-callout">
        <h2>🚨 Comprehensive liability release</h2>
        <p>
          By using this service, you release, discharge, and hold harmless: <strong>Wavy Davy</strong>{' '}
          (David Auerbach), creator of RideFinder; the <strong>Burning Man Organization</strong> and{' '}
          <strong>Black Rock City LLC</strong> and all their employees, volunteers, and affiliates;{' '}
          <strong>BMIR 94.5 FM</strong> and all associated personnel; <strong>Railway</strong> and{' '}
          <strong>Amazon Web Services</strong>; all internet service providers, software providers,
          and hardware manufacturers; all government entities; all religious entities and deities;
          all natural forces including but not limited to gravity, weather, solar flares, and cosmic
          radiation; all other users of this service; and all future parties that may become
          involved in any capacity — from any and all claims, damages, losses, injuries, or
          liabilities of any kind arising from your use of this service, including personal injury,
          property damage, financial loss, emotional distress, service interruptions, acts of God,
          and any other damages whatsoever.
        </p>
      </section>

      <h2>12. Service disclaimers</h2>
      <p>
        The service is provided <strong>&ldquo;as is&rdquo;</strong> and{' '}
        <strong>&ldquo;as available&rdquo;</strong> without warranties of any kind. We don&rsquo;t
        guarantee the accuracy of listings, the availability of rides or riders, the behavior of
        other users, or uninterrupted access to the service.
      </p>

      <h2>13. User responsibilities</h2>
      <ul>
        <li>Provide accurate, truthful information</li>
        <li>Respect the privacy and safety of other users</li>
        <li>Comply with applicable laws; don&rsquo;t use the service for harm</li>
        <li>Report suspicious or inappropriate behavior (⋯ → Report listing)</li>
        <li>Use common sense and good judgment — you are responsible for your own safety</li>
      </ul>

      <h2>14. Governing law</h2>
      <p>
        This policy is governed by the laws of the State of California, United States. Disputes
        shall be resolved in the courts of California.
      </p>

      <h2>Contact</h2>
      <p>
        Creator: <strong>Wavy Davy</strong> (David Auerbach) ·{' '}
        <a href="mailto:matching@ridefinder.site">matching@ridefinder.site</a> ·{' '}
        <a href="https://ridefinder.site">ridefinder.site</a>
      </p>
      <p className="muted">
        This is a community service created by a burner, for burners. Please be patient with
        response times.
      </p>
    </article>
  );
}
