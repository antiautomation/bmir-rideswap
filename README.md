# RideFinder

RideFinder is a free, no-login rideshare board for Burning Man. Post a ride offer or a ride
request in under a minute — no account, no password, just a human-readable recovery code
that gets you back in from any device. Messaging is private by default: your email and
phone are never shown on a listing, and get shared with another burner only when you
explicitly choose to send them in a message. RideFinder also matches drivers and riders
automatically based on direction, date, location, and gear/passenger space, and emails you
a digest when something relevant shows up. The whole thing is a PWA built to survive
playa connectivity — spotty signal, offline stretches, install-to-home-screen — so it
still works when you're standing in the dust with one bar.

Live at [ridefinder.site](https://ridefinder.site).

## How it works

**No-login sessions.** There are no usernames or passwords. The first time you post,
the server creates an anonymous user and drops a long-lived session cookie in your
browser — that's your login. Alongside it you get a **recovery code**, a friendly
three-part phrase like `dusty-camel-8214`. That code *is* your account: enter it in
`POST /api/session/recover` on any device (phone, laptop, a friend's tablet at camp)
and you're back in as the same user, with the same listings and messages. There's
nothing else to remember and nothing a support person can reset for you except by
banning the account — so don't lose the code.

**Magic links** do the same job by email. Every digest email carries a link that logs
you in and drops you on the right page (your inbox, a specific listing) — no code to
type. These links are intentionally multi-use and last 30 days, because mail clients
and spam filters routinely "click" links in the background to prescan them; a one-time
token would burn itself on the scanner and lock out the actual recipient. That's safe
because the GET handler for magic links (`/a/:token`) does nothing except establish a
session — no side effects a prefetch could trigger.

**Contact sharing is per-message, not per-profile.** Your email/phone live on your
profile, but a listing never displays them and a conversation doesn't either — by
default. When you send a message you can opt in to attach your email and/or phone to
*that message*; the server snapshots whatever value was on your profile at send time
and stores it on the message row. Later profile edits don't retroactively change what
you already shared, and the other person never sees anything you didn't check the box
for.

**Matching** runs synchronously every time a listing is created, edited, or cancelled.
Each driver listing is scored against every live rider listing heading the same
direction (and vice versa): same-day beats nearby-day (date component), same
normalized location beats fuzzy-similar beats "flexible" (location, via Postgres
trigram similarity), cargo space has to cover the rider's stuff (a hard filter, not
just a score bonus), overlapping time windows add points, and very-new listings get a
small freshness bump. Anything below a minimum score, or a date more than 2 days off,
or where the rider's stuff won't fit the driver's cargo, doesn't become a match at
all. Matches surface on the Matches page and in digest emails.

**Digest emails** run on a cron tick and respect a per-user frequency: `instant`
(next tick after something happens), `hourly`, `daily`, or `off`. A digest rolls up
unread messages by conversation plus any new matches since your last one, links back
via a magic link, and is skipped entirely if there's nothing to report.

## Stack

npm workspaces, two packages:

- **`server/`** — Node 22, [Hono](https://hono.dev) for routing, [Drizzle
  ORM](https://orm.drizzle.team) + Postgres for data, `node-cron` for the digest and
  cleanup jobs, and AWS SESv2 for outbound email.
- **`web/`** — Vite + React 19, TanStack Query with a `localStorage` persister (so the
  board renders from cache instantly, even offline), `vite-plugin-pwa` for the
  service worker/manifest, and a small hand-written CSS design system — see
  [`web/DESIGN.md`](web/DESIGN.md) ("High Desert Night") for tokens, components, and
  layout rules.

One Railway service serves both: the Hono app answers `/api/*`, then falls back to
serving `web/dist` as static files and `index.html` for everything else (a classic SPA
catch-all). There's no separate frontend deployment or CDN — `npm run build` builds
web first, then server, and the server reads `web/dist` off disk at boot.

Migrations are plain, ordered SQL files in `server/drizzle/*.sql`, applied by a small
custom runner (`server/src/db/migrate.ts`) on every boot — not `drizzle-kit migrate`.
It takes a Postgres advisory lock, tracks applied files in a `schema_migrations`
table, and runs any new ones in a transaction. Safe to run concurrently (e.g. two
instances booting at once); the loser just waits for the lock and finds nothing left
to do.

## Local development

Prerequisites: Node ≥ 22. Docker (Desktop or OrbStack) is optional — only needed if
you want a local Postgres via `docker-compose.yml`; otherwise point `DATABASE_URL` at
any reachable Postgres (e.g. a Railway database).

```bash
cp .env.example .env          # fill in / adjust as needed
docker compose up -d          # optional: local Postgres on :5433
npm install
npm run dev                   # server on :3000, Vite on :5173 (proxied to the server)
```

Other useful scripts:

```bash
npm run build                 # build web, then server, into web/dist and server/dist
npm start                      # run the built server (node server/dist/index.js)
npm run typecheck              # tsc --noEmit across both workspaces
```

To seed demo data for local testing, use `npm run seed:demo --workspace server`
(a seeding script is being added alongside this README — check `server/package.json`
if it's not there yet).

## Deployment

Railway auto-deploys every push to `main`. `railway.json` pins the build to
`npm run build` (Nixpacks) and the start command to `npm start`, with a healthcheck
at `/healthz` and **`numReplicas: 1`**. That single-replica constraint isn't
incidental — the digest/cleanup cron jobs run in-process (`node-cron`, no external
scheduler) and rate limiting is an in-memory sliding window (`server/src/lib/rateLimit.ts`).
Scaling to multiple replicas would double-send digests and let rate limits reset per
instance; don't do it without moving both to something shared (e.g. Postgres-backed
locks/counters) first.

Environment variables (see `.env.example`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `PORT` | Port the server listens on (Railway sets this itself in production) |
| `APP_ORIGIN` | Public base URL, used to build links in emails |
| `NODE_ENV` | `production` enables secure cookies |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` | SES credentials for sending email |
| `SES_FROM` | From address/name for outbound mail |
| `EMAIL_DRY_RUN` | `1` logs emails to the console instead of sending — keep this on until SES is out of the SES sandbox |
| `ADMIN_KEY` | Shared secret; `POST /api/admin/claim {key}` promotes the current session to admin |

`JOBS_DISABLED=1` (not in `.env.example`, but read by `server/src/jobs/index.ts`) skips
starting the cron jobs entirely — handy for local runs where you don't want digest
emails firing.

## Architecture notes

- **Auth** is a cookie session (`rs_session`, `httpOnly`, 1-year TTL) whose value is a
  random token; only its SHA-256 hash is stored (`auth_tokens.token_hash`), so a
  database leak alone doesn't hand out working sessions. Recovery codes and magic
  links follow the same hash-then-store pattern.
- **Recovery codes** are memorable three-part strings (adjective-noun-4digits, e.g.
  `dusty-camel-8214`) rather than opaque tokens, specifically so a burner can read one
  off another person's screen or write it on a wrist.
- **Magic links are deliberately multi-use and last 30 days** — see "How it works"
  above. Every GET under `/a/:token` is side-effect-free by design so mail-client link
  prefetching can't burn or misuse them.
- **Digest cron** takes a Postgres advisory lock (`pg_try_advisory_lock`) before each
  tick so overlapping ticks (or, in the future, overlapping replicas) don't double
  send, and it's idempotent per-message/per-match: messages get `emailed_at` stamped,
  matches get `notified_driver_at`/`notified_rider_at` stamped, so a crash mid-tick
  just means some rows retry next minute rather than duplicating mail.
- **Offline outbox**: the web app queues writes (post, edit, message, etc.) in
  `localStorage` when offline, each tagged with a client-generated `clientId`. The
  server treats `clientId` as an idempotency key on listings and messages, so a
  retried queue flush after a flaky connection can't create duplicates.
- **Matching recomputes synchronously** on every listing create/update/cancel/delete
  (`recomputeMatchesForListing`) rather than on a batch job — matches are always
  current by the time you look at them, at the cost of a bit more write-path work.
- **Moderation** is community-driven: three independent flags on a listing
  auto-hide it (`hiddenAt`), pending admin review. Admin access itself isn't a
  role you're born with — any session can claim it once via `POST /api/admin/claim`
  with the shared `ADMIN_KEY`, then acts through `/admin` in the web app.
- **Anti-abuse** is honeypot fields + layered rate limits (DB-count-based for the
  abuse-critical paths like listings/day, in-memory sliding windows for
  lighter-weight ones) instead of a CAPTCHA — this stays a zero-friction, no-login
  board.

## Repo layout

```
server/src/
  routes/       # session, listings, conversations, matches, admin, magic-link exchange
  jobs/         # digest cron tick, token/match cleanup
  email/        # SES client + digest HTML/text templates
  matching/     # driver/rider scoring + recompute-on-write
  auth/         # session tokens, recovery codes, magic links, middleware
  db/           # Drizzle schema, pg pool, custom migration runner
  lib/          # rate limiting, phone normalization, listing expiry rules
server/drizzle/ # ordered *.sql migrations applied on boot

web/src/
  pages/        # board, post/edit, listing detail, matches, messages/thread, profile, admin
  components/   # cards, forms, filter bar, status bar, tab bar, toasts, install prompt
  api/          # typed fetch client per resource
  offline/      # connectivity detection + the localStorage-backed write outbox
  styles/       # hand-written CSS design system (tokens, base, board, forms, ...)

legacy/         # v1 — static Firebase app, kept in the repo until v2 fully replaces it
```

## History

v1 (in `legacy/`) was a static Firebase-backed rideshare board built in August 2025 —
vanilla JS, Firestore, anonymous auth, session codes, real-time listeners. It worked,
and its product ideas (no-login sessions, soft deletes, community flagging) carried
straight into v2's design. v2 is a ground-up rewrite started in 2026 on a proper
server + Postgres, adding what v1 couldn't easily do: truly private messaging (no
contact info on public listings), automatic driver/rider matching, email digests with
magic-link login, and an offline-first PWA built for the realities of playa
connectivity.

## License

MIT — see [LICENSE](LICENSE).
