# Live Session module

A **fully isolated, plug-in** feature for ContextOS. Adds a "Live Session" header
button that opens an in-page panel (drawer on desktop, bottom sheet on mobile)
with two tabs: real-time anonymous chat and admin polls. Backed by **Supabase
Realtime**.

Everything lives under `src/modules/live-session/`. The host app is touched in
exactly **one place** — a single import + `<LiveSessionButton />` in the landing
nav. No existing component, style, route, or behaviour was modified.

---

## 1. File structure (all new)

```
src/modules/live-session/
├── index.ts                     # public surface → { LiveSessionButton, isLiveConfigured }
├── config.ts                    # admin email, limits, table names, durations
├── types.ts                     # LiveSession / LiveMessage / LivePoll / PollTally
├── supabase-schema.sql          # tables + RLS + realtime publication + cleanup fn
├── lib/
│   ├── supabaseClient.ts        # isolated, lazy Supabase client (own instance)
│   └── userSession.ts           # anonymous per-browser id (localStorage)
├── hooks/
│   ├── useCountdown.ts          # 1s ticking countdown to an ISO target
│   ├── useIsAdmin.ts            # Clerk email === ADMIN_EMAIL
│   ├── useLiveSession.ts        # active session subscribe + admin create/end
│   ├── useLiveMessages.ts       # last-100 messages subscribe + send
│   └── useLivePolls.ts          # polls + votes subscribe, live tally, vote/create
└── components/
    ├── LiveSessionButton.tsx    # the header trigger (the only export you mount)
    ├── LivePanel.tsx            # portal overlay + slide-in drawer/sheet + tabs
    ├── LiveTab.tsx              # chat UI + countdown + admin start
    └── PollsTab.tsx            # poll cards, animated bars, voting, admin create
```

## 2. Injecting the header button (zero layout changes)

```tsx
import { LiveSessionButton } from "@/modules/live-session";

// ...inside the existing nav's right-hand cluster:
<LiveSessionButton />
```

It renders **only** a design-system `<Button>` (brand-green, `size="sm"`, with a
live pulse dot) plus a portal-mounted panel appended to `document.body`. No
floating elements; nothing else in the nav shifts.

## 3. Isolated state

There is no global store. State is local to the module and scoped to the panel:
the subscriptions in `useLiveSession`, `useLiveMessages`, and `useLivePolls` all
take an `enabled`/`sessionId` argument and only attach Supabase channels while
the panel is open, tearing every channel down on close (no leaks). Chat memory
is hard-capped at `MAX_MESSAGES` (100).

## 4. Supabase integration

1. Run `supabase-schema.sql` once in the Supabase SQL editor.
2. Set the env vars (already added to `.env` / `.env.production`):
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...   # public anon key — safe in the browser
   ```
3. `npm install` (adds `@supabase/supabase-js`, already in `package.json`).

If the env vars are missing the panel renders a friendly "not configured" state
and the rest of the site is unaffected.

## 5. Real-time flow

- **Open panel** → subscribe to active session, its messages, active polls + votes.
- **Chat**: send → row INSERT → realtime echo updates every client → UI keeps
  last 100.
- **Polls**: vote → row INSERT (composite PK `poll_id+user_session_id` ⇒ one vote
  each) → realtime vote stream re-aggregates percentages live with animated bars.
- **Close panel** → all channels removed.

## 6. Admin rule

Only `majigarrishi291@gmail.com` (see `config.ts`) sees the create-session /
create-poll UI, gated client-side via Clerk. Because the app uses Clerk (not
Supabase Auth), RLS can't read the Clerk email; `supabase-schema.sql` documents
an optional hardening block that blocks all anon writes to sessions/polls so the
admin creates content from the Supabase dashboard or a service-key script.

## 7. Cleanup / auto-delete

`live_cleanup_expired()` flags ended sessions/polls inactive and deletes messages
of ended sessions. Schedule it with `pg_cron` (snippet in the SQL) or call ad hoc.
