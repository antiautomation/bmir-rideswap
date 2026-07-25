/* Shown when any API call answers 403 'banned' (see api/client.ts). Replaces
   the whole app — a banned session can browse nothing and post nothing. */
export default function BannedScreen() {
  return (
    <div className="banned-screen">
      <div className="banned-card card">
        <span className="banned-emoji" aria-hidden="true">
          ⛔
        </span>
        <h1>You&rsquo;ve been banned</h1>
        <p>
          This session can no longer use RideFinder. Bans happen when listings or messages break
          the community&rsquo;s rules — usually scams, spam, or harassment.
        </p>
        <p>
          Think this is a mistake? Email{' '}
          <a href="mailto:matching@ridefinder.site">matching@ridefinder.site</a> and a human will
          take a look.
        </p>
      </div>
    </div>
  );
}
