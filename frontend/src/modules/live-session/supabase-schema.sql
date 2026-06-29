-- ============================================================================
-- ContextOS · Live Session module — Supabase schema
-- ============================================================================
-- ISOLATED feature module. These tables are namespaced with the `live_` prefix
-- so they never collide with existing application tables. Run this once in the
-- Supabase SQL editor for project `qkjllxisllvuspidyaaf`.
--
-- Mapping from the original Firebase spec:
--   activeSession  -> live_sessions
--   messages       -> live_messages   (one row per message, session_id FK)
--   polls          -> live_polls
--   pollVotes      -> live_poll_votes (composite PK = one vote per user/poll)
-- ============================================================================

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- ── Sessions ────────────────────────────────────────────────────────────────
create table if not exists public.live_sessions (
  id          uuid primary key default gen_random_uuid(),
  topic       text        not null,
  start_time  timestamptz not null default now(),
  end_time    timestamptz not null,           -- start_time + 1 hour (set by admin/UI)
  is_active   boolean     not null default true,
  created_by  text,                            -- admin email (audit only)
  created_at  timestamptz not null default now()
);
create index if not exists live_sessions_active_idx on public.live_sessions (is_active, end_time desc);

-- ── Messages ────────────────────────────────────────────────────────────────
create table if not exists public.live_messages (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.live_sessions(id) on delete cascade,
  text            text not null check (char_length(text) between 1 and 2000),
  user_session_id text not null,               -- anonymous browser id
  created_at      timestamptz not null default now()
);
create index if not exists live_messages_session_idx on public.live_messages (session_id, created_at desc);

-- ── Polls ───────────────────────────────────────────────────────────────────
create table if not exists public.live_polls (
  id          uuid primary key default gen_random_uuid(),
  question    text        not null,
  image_url   text,
  options     jsonb       not null default '[]'::jsonb,  -- ["Option A","Option B",...]
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,            -- created_at + 24 hours
  is_active   boolean     not null default true,
  created_by  text
);
create index if not exists live_polls_active_idx on public.live_polls (is_active, expires_at desc);

-- ── Poll votes ──────────────────────────────────────────────────────────────
-- Composite PK enforces exactly one vote per (poll, user_session_id) at the DB
-- level — no application logic can be bypassed to double-vote.
create table if not exists public.live_poll_votes (
  poll_id         uuid not null references public.live_polls(id) on delete cascade,
  user_session_id text not null,
  selected_option int  not null,               -- index into live_polls.options
  created_at      timestamptz not null default now(),
  primary key (poll_id, user_session_id)
);

-- ============================================================================
-- Realtime — only these tables are published, so clients subscribe narrowly.
-- ============================================================================
alter publication supabase_realtime add table public.live_sessions;
alter publication supabase_realtime add table public.live_messages;
alter publication supabase_realtime add table public.live_polls;
alter publication supabase_realtime add table public.live_poll_votes;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.live_sessions   enable row level security;
alter table public.live_messages   enable row level security;
alter table public.live_polls      enable row level security;
alter table public.live_poll_votes enable row level security;

-- Public READ access (anonymous users, no login) -----------------------------
create policy "live_sessions_read"   on public.live_sessions   for select using (true);
create policy "live_messages_read"   on public.live_messages   for select using (true);
create policy "live_polls_read"      on public.live_polls      for select using (true);
create policy "live_poll_votes_read" on public.live_poll_votes for select using (true);

-- Anonymous participation: anyone may post a chat message into an ACTIVE,
-- non-expired session, and cast a vote on an ACTIVE, non-expired poll.
create policy "live_messages_insert_active" on public.live_messages
  for insert with check (
    exists (
      select 1 from public.live_sessions s
      where s.id = session_id and s.is_active = true and s.end_time > now()
    )
  );

create policy "live_poll_votes_insert_active" on public.live_poll_votes
  for insert with check (
    exists (
      select 1 from public.live_polls p
      where p.id = poll_id and p.is_active = true and p.expires_at > now()
    )
  );

-- Admin-only content creation -------------------------------------------------
-- NOTE: the app authenticates with Clerk, not Supabase Auth, so RLS cannot read
-- the Clerk email directly. There are two enforcement layers:
--   1. CLIENT: the panel only renders the "create" UI for the admin email.
--   2. DB (optional hardening, below): block session/poll INSERT/UPDATE/DELETE
--      from the anon key entirely. The admin then creates content via the
--      Supabase dashboard or a service-key script. Uncomment to enforce.
--
-- create policy "live_sessions_no_anon_write" on public.live_sessions
--   for all using (false) with check (false);
-- create policy "live_polls_no_anon_write" on public.live_polls
--   for all using (false) with check (false);
--
-- With the policies above commented OUT, the anon key may insert sessions/polls
-- (gated by the client-side admin check). This keeps the module self-contained
-- with no backend changes. Enable the hardening policies for production.

-- Default (no hardening): allow writes so the admin UI works with the anon key.
create policy "live_sessions_write"  on public.live_sessions  for all using (true) with check (true);
create policy "live_polls_write"     on public.live_polls     for all using (true) with check (true);

-- ============================================================================
-- Auto-cleanup: delete messages once their session has ended.
-- Call manually, or schedule with pg_cron (see below).
-- ============================================================================
create or replace function public.live_cleanup_expired()
returns void language plpgsql security definer as $$
begin
  -- Flag ended sessions / polls inactive
  update public.live_sessions set is_active = false where end_time <= now() and is_active = true;
  update public.live_polls    set is_active = false where expires_at <= now() and is_active = true;
  -- Auto-delete messages belonging to ended sessions
  delete from public.live_messages m
  using public.live_sessions s
  where m.session_id = s.id and s.end_time <= now();
end;
$$;

-- Optional scheduling (requires the pg_cron extension):
--   select cron.schedule('live-cleanup', '*/5 * * * *', $$ select public.live_cleanup_expired(); $$);
