import { Link } from 'react-router-dom';

/* Answers here state real system behavior — expiry windows, digest frequencies,
   the photo unlock rule, recovery codes — and must be kept in sync when those
   change. Retention numbers match the privacy policy. */

function QA({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="help-qa">
      <summary>
        {q} <span className="chevron">▾</span>
      </summary>
      <div className="help-qa-body">{children}</div>
    </details>
  );
}

export default function HelpPage() {
  return (
    <article className="help-page">
      <Link to="/" className="btn-ghost">
        ← Back to RideFinder
      </Link>
      <h1>Help</h1>
      <p className="muted">The quick version first, then answers to everything else.</p>

      <h2>How to use RideFinder</h2>
      <ol className="help-steps">
        <li>
          <strong>Browse the board.</strong> The front page lists drivers offering seats and
          riders looking for them. Filter by direction (to or from Black Rock City), date, and
          departure area — or just scroll.
        </li>
        <li>
          <strong>Post your ride.</strong> Hit <em>Post</em>, pick driver or rider, and fill in
          your name (playa names welcome), city, travel date, how many seats or how much gear
          space you&rsquo;ve got, and an email so replies can reach you. No account, no password
          — posting quietly creates a session on your device.
        </li>
        <li>
          <strong>Save your session code.</strong> The <em>You</em> page shows a short code like{' '}
          <code>dusty-camel-lantern</code>. Write it down or screenshot it — it&rsquo;s how you sign
          back in from another device or after clearing your browser.
        </li>
        <li>
          <strong>Message people.</strong> See a good match? Hit <em>Message</em> on their card
          and introduce yourself. Your email and phone stay hidden unless you tick a share box
          inside a message — sharing is always your call, one conversation at a time.
        </li>
        <li>
          <strong>Check your matches.</strong> The <em>Matches</em> tab scores every compatible
          listing against yours — same dates, nearby departure points, gear that fits — so the
          best candidates float to the top.
        </li>
        <li>
          <strong>Let email do the watching.</strong> Your email is saved when you post — just
          pick a digest frequency on the <em>You</em> page. We&rsquo;ll email you when new
          messages or matches show up, with a link that signs you straight in.
        </li>
        <li>
          <strong>Close the loop.</strong> Found your ride? <em>Deactivate</em> your listing from
          the <em>You</em> page so people stop reaching out. Plans changed? Edit it instead.
        </li>
      </ol>

      <h2>Accounts &amp; signing in</h2>
      <QA q="Do I need an account?">
        <p>
          No. There&rsquo;s nothing to register and no password to invent. The first time you
          post or message, RideFinder sets a private cookie on your device — that&rsquo;s your
          session. Everything you own (listings, messages, settings) hangs off it.
        </p>
      </QA>
      <QA q="What's a session code and why should I care?">
        <p>
          It&rsquo;s a short human-friendly code (like <code>dusty-camel-lantern</code>) shown on
          your <em>You</em> page. It&rsquo;s the key to your stuff: enter it on any other device
          — or after clearing your cookies — and you&rsquo;re back in with everything intact.
          Treat it like a password: anyone who has it can act as you.
        </p>
      </QA>
      <QA q="I cleared my cookies / got a new phone. Is everything gone?">
        <p>
          Not if you have your session code — enter it under <em>You → Recover a session</em>.
          No code? Any RideFinder email in your inbox contains a sign-in link that restores
          your session too — and if your email is on your profile you don&rsquo;t need one at
          all: use <em>Or get a sign-in link by email</em> on the <em>You</em> page and
          we&rsquo;ll send you a fresh link. If you have neither, the old listings are
          unreachable — post fresh, and screenshot the code this time.
        </p>
      </QA>
      <QA q="Can I use RideFinder on my phone and laptop at the same time?">
        <p>
          Yes. Sign in on the second device with your session code (or via a link from any
          RideFinder email). Sessions last up to a year each, and you can sign out of all
          devices at once from the <em>You</em> page if one goes missing.
        </p>
      </QA>
      <QA q="How do the email sign-in links work? Are they safe?">
        <p>
          Every email we send contains a personal magic link that signs you in without a
          password. Links expire after 30 days and only work for your account. Don&rsquo;t
          forward RideFinder emails — the link inside is a working key to your session.
        </p>
      </QA>
      <QA q="Can two accounts share one email address?">
        <p>
          No — an email belongs to one account. If you try to use an address that&rsquo;s already
          on another account, we&rsquo;ll offer to email you a sign-in link to get back into that
          one instead. Handy when you&rsquo;ve accidentally made a second account.
        </p>
      </QA>

      <h2>Listings</h2>
      <QA q="What's the difference between a driver and a rider listing?">
        <p>
          Drivers have a vehicle and seats to fill; riders need a seat. Pick whichever you are
          for that trip. Offering a ride up but need one back? Post two listings — one per
          direction, one per role.
        </p>
      </QA>
      <QA q="What do the fields mean (gear space, time window)?">
        <p>
          <em>Seats</em> is how many humans you can take (or how many of you need seats).{' '}
          <em>Gear</em> is honest talk about cargo: a backpack is not eight bins and a bike.{' '}
          <em>Time window</em> is roughly when you want to roll — it helps matching pair early
          birds with early birds. Put everything else (music tastes, smoke policy, stops,
          cost-split expectations) in the details field. More detail, better matches, fewer
          surprise conversations.
        </p>
      </QA>
      <QA q="How long does my listing stay up?">
        <p>
          Until a few hours after your departure window passes, in your departure point&rsquo;s
          local time — a morning window expires that afternoon, and &ldquo;flexible&rdquo;
          listings stay up until roughly 4am the next day. Expired listings drop off the public
          board on their own within a few days. You don&rsquo;t need to clean up after the burn;
          the playa provides, and so does the cron job.
        </p>
      </QA>
      <QA q="How do I edit, deactivate, or delete a listing?">
        <p>
          From the <em>You</em> page, or your own card on the board. <em>Edit</em> changes details
          in place. <em>Deactivate</em> pulls it off the board but keeps it on your <em>You</em>{' '}
          page and in any thread you already started, so nobody messaging you hits a dead end.{' '}
          <em>Delete</em> lives under the ⋯ menu and removes it for good.
        </p>
      </QA>
      <QA q="Can I post more than one listing?">
        <p>
          Yes — different dates, directions, or vehicles all warrant separate listings. Just
          retire the ones that no longer apply so riders don&rsquo;t chase ghosts.
        </p>
      </QA>
      <QA q="My listing vanished. What happened?">
        <p>
          Either its departure window passed (it expired normally), you deactivated it, or it was
          hidden after multiple user reports. If you think it was hidden unfairly, email{' '}
          <a href="mailto:matching@ridefinder.site">matching@ridefinder.site</a>.
        </p>
      </QA>

      <h2>Matching</h2>
      <QA q="How does matching actually work?">
        <p>
          Every driver listing is scored against every rider listing going the same direction
          (0–100) on four things: how close the travel dates are, how similar the departure
          locations look, whether your gear fits their cargo space, and how well the time
          windows overlap. Fresh listings get a small boost. Rides can also match when a
          rider&rsquo;s city sits along the driver&rsquo;s route to or from Black Rock City —
          say a Tucson driver and a Phoenix rider — which shows up as &ldquo;on the way&rdquo;
          on the match. Scores recompute automatically whenever listings change —
          there&rsquo;s no button to press.
        </p>
      </QA>
      <QA q="What do the little tags on a match mean?">
        <p>
          They&rsquo;re the reasons behind the score — &ldquo;same day,&rdquo; &ldquo;nearby
          departure,&rdquo; &ldquo;fits your gear,&rdquo; and so on. High score, several tags:
          message that person.
        </p>
      </QA>
      <QA q="Can I narrow down or tidy my matches?">
        <p>
          Yes — the <em>Matches</em> tab has filters for minimum score, gear, and whether the
          person has a photo. Star (★) a match to pin it to the top, or <em>Hide</em> ones that
          don&rsquo;t fit — hidden matches aren&rsquo;t deleted, and the &ldquo;show hidden
          matches&rdquo; toggle brings them back. Stars and hidden matches follow your account
          across devices.
        </p>
      </QA>
      <QA q="Why do I have no matches?">
        <p>
          Matches require a live listing of yours plus compatible listings from the other role.
          Early in the season the board is thin — set your digest to daily and let the matches
          come to you as more burners post.
        </p>
      </QA>

      <h2>Messages &amp; contact info</h2>
      <QA q="Is my email or phone number ever shown publicly?">
        <p>
          Never. Nothing on the public board includes contact info. Your email and phone live
          on your private profile and are shared only when <em>you</em> tick the share boxes
          inside a specific message — and then only with that one person.
        </p>
      </QA>
      <QA q="How does messaging work?">
        <p>
          Conversations live in the <em>Messages</em> tab, attached to a listing. The other
          person gets notified by email (at whatever frequency they chose). You don&rsquo;t
          need to trade numbers to make a plan — but when you&rsquo;re ready to, tick the share
          box and your contact info rides along with that message.
        </p>
        <p>
          Your first message asks for your name and email if you haven&rsquo;t posted yet — so
          the person you&rsquo;re writing to knows who&rsquo;s asking, and their reply can reach
          you.
        </p>
      </QA>
      <QA q="I shared my phone number in one conversation. Can others see it?">
        <p>
          No. Sharing is per-message, per-conversation. The recipient sees what you shared;
          nobody else does.
        </p>
      </QA>
      <QA q="Why am I being told to slow down when messaging?">
        <p>
          Gentle rate limits keep spammers from carpet-bombing the board — a cap on brand-new
          conversations per hour and on total messages per hour. Normal humans making ride
          plans won&rsquo;t hit them; scripts will.
        </p>
      </QA>
      <QA q="Someone's being creepy or spammy. What do I do?">
        <p>
          Don&rsquo;t reply, and report their listing (⋯ menu → <em>Report</em>). Listings
          reported by several different people are hidden automatically and reviewed. For
          anything urgent, email{' '}
          <a href="mailto:matching@ridefinder.site">matching@ridefinder.site</a> with the
          listing or conversation details.
        </p>
      </QA>

      <h2>Profile photos</h2>
      <QA q="How do profile photos work?">
        <p>
          They&rsquo;re optional. Upload one from the <em>You</em> page (JPG, PNG, WebP — and
          HEIC on iPhones/Safari — up to 10&nbsp;MB) and it&rsquo;s cropped into a circle from
          the center, so put your face in the middle. Next to your listings, others see only a
          small blurred thumbnail — tap your own thumbnail on the <em>You</em> page to preview
          exactly what a match sees.
        </p>
      </QA>
      <QA q="When can someone see my full-size photo?">
        <p>
          Only after <em>you message them</em>. So if someone messages you, they&rsquo;ve shown
          you their full photo by doing it; they see yours full-size once you reply. Until
          then, everyone else gets the blurred thumbnail — which is generated separately at low
          resolution, so there&rsquo;s no hidden detail to &ldquo;enhance.&rdquo;
        </p>
      </QA>
      <QA q="Can I remove my photo?">
        <p>
          Anytime, from the <em>You</em> page — it&rsquo;s deleted immediately, thumbnail and
          all. We never keep your original upload; it&rsquo;s discarded the moment the circle
          crop is made.
        </p>
      </QA>

      <h2>Email &amp; notifications</h2>
      <QA q="What emails will I get, and how often?">
        <p>
          Only what you asked for: new-message and new-match notifications, bundled at the
          frequency you pick on the <em>You</em> page — instant, hourly, daily, or off. They
          come from <code>matching@ridefinder.site</code>.
        </p>
      </QA>
      <QA q="I'm not getting emails.">
        <p>
          Check that your address is saved on the <em>You</em> page and your frequency
          isn&rsquo;t <em>off</em>, then check spam for{' '}
          <code>matching@ridefinder.site</code> and mark it not-spam. If an earlier email to
          you bounced hard, our sender may have paused your address — write to{' '}
          <a href="mailto:matching@ridefinder.site">matching@ridefinder.site</a> and
          we&rsquo;ll clear it.
        </p>
      </QA>
      <QA q="How do I unsubscribe?">
        <p>
          Set frequency to <em>off</em> on the <em>You</em> page, or use the link in the footer
          of any email. Messages still arrive in the app either way.
        </p>
      </QA>

      <h2>Offline &amp; on-playa</h2>
      <QA q="Does RideFinder work offline?">
        <p>
          Mostly, yes. Once you&rsquo;ve loaded it, the app and your last-seen board, matches,
          messages, and profile thumbnails are cached on your device. Anything you post while
          offline is queued and sent automatically when you reconnect — a status bar tells you
          what&rsquo;s pending.
        </p>
      </QA>
      <QA q="Can I install it like an app?">
        <p>
          Yes — it&rsquo;s a PWA. On iPhone: Share → <em>Add to Home Screen</em>. On Android:
          the install prompt or browser menu → <em>Install app</em>. Same thing on desktop
          Chrome. No app store involved.
        </p>
      </QA>
      <QA q="Will it work in Black Rock City?">
        <p>
          Plan on no. Connectivity in BRC ranges from bad to none, and that&rsquo;s part of the
          charm. Sort your ride out <em>before</em> you&rsquo;re in the dust — and for the ride
          home, make your exodus plan (and trade phone numbers with your driver) while you
          still have bars, ideally before you pass Empire. The offline cache means you can at
          least re-read your messages and saved plans from the playa.
        </p>
      </QA>

      <h2>Safety &amp; good form</h2>
      <QA q="Is it safe to ride with a stranger?">
        <p>
          The same way it&rsquo;s safe to camp next to one: usually wonderful, never
          guaranteed. We don&rsquo;t vet anyone — this is a bulletin board, not a background
          check. Message enough to get a feel for the person, do a phone or video call before
          committing, tell a friend your plan and plate number, and trust your gut — bailing on
          a weird vibe is always allowed. You&rsquo;re responsible for your own ride; see the{' '}
          <Link to="/privacy">privacy policy</Link> for the formal version.
        </p>
      </QA>
      <QA q="What's the etiquette on gas money?">
        <p>
          Talk about it before anyone&rsquo;s in the car — it&rsquo;s the number-one avoidable
          awkwardness. Splitting fuel evenly among everyone aboard (driver included) is the
          common default; some drivers decline money and appreciate snacks, playa gifts, or a
          shift behind the wheel instead. Whatever you agree, agree it in writing in the
          message thread.
        </p>
      </QA>
      <QA q="How do I avoid scams?">
        <p>
          Simple rule: money moves only between people who&rsquo;ve met, at the car, on the
          day. Never wire, Venmo, or &ldquo;deposit&rdquo; anything in advance to hold a seat —
          a legitimate burner will never ask. RideFinder itself will never handle payment,
          tickets, or vehicle passes. Anyone selling those here is breaking the rules — report
          them.
        </p>
      </QA>
      <QA q="Does RideFinder handle tickets or vehicle passes?">
        <p>
          No. Rides only. For tickets, use the official Burning Man STEP program — ticket
          listings here get removed.
        </p>
      </QA>

      <h2>The service itself</h2>
      <QA q="What does it cost?">
        <p>
          Nothing. No fees, no ads, no premium tier, no data selling. It&rsquo;s a community
          service run by <strong>Wavy Davy</strong>, part of the{' '}
          <a href="https://bmir.org/" target="_blank" rel="noopener noreferrer">
            BMIR 94.5 FM
          </a>{' '}
          family. If you&rsquo;re curious why it exists, read the{' '}
          <Link to="/about">About page</Link>.
        </p>
      </QA>
      <QA q="Is RideFinder part of the Burning Man organization?">
        <p>
          No — we&rsquo;re not affiliated with the Burning Man Project or Black Rock City LLC.
          We&rsquo;re burners who run a ride board.
        </p>
      </QA>
      <QA q="What happens to my data?">
        <p>
          As little as possible: no analytics, no tracking cookies, no advertising IDs.
          Listings expire shortly after your departure window; messages stay visible to their participants.
          Want everything erased? Email{' '}
          <a href="mailto:matching@ridefinder.site">matching@ridefinder.site</a> from the
          address on your profile. Full details in the{' '}
          <Link to="/privacy">privacy policy</Link>.
        </p>
      </QA>
      <QA q="I found a bug / have an idea.">
        <p>
          We want it! Email <a href="mailto:matching@ridefinder.site">matching@ridefinder.site</a>{' '}
          with what you saw and what device you were on. This thing is built and maintained by
          one burner — reports genuinely help.
        </p>
      </QA>
      <QA q="Is there a bus instead?">
        <p>
          Yes — the official Burner Express runs from Reno and San Francisco and it&rsquo;s a
          great low-carbon option. RideFinder is for everyone else: odd dates, other cities,
          full trucks of camp gear, and people who like road-trip conversation.
        </p>
      </QA>

      <p className="muted">
        Still stuck? <a href="mailto:matching@ridefinder.site">matching@ridefinder.site</a> —
        be patient, there&rsquo;s one of us.
      </p>
    </article>
  );
}
