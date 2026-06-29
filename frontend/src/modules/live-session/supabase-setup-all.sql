-- ============================================================================
-- ContextOS · Live Session — COMPLETE setup (run this ONE file)
-- Idempotent: safe to run on a fresh project or to repair a partial one.
-- Creates tables, realtime, RLS, admin RPCs, and Storage policies.
-- After running, the chat + polls work immediately.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists public.live_sessions (
  id          uuid primary key default gen_random_uuid(),
  topic       text        not null,
  start_time  timestamptz not null default now(),
  end_time    timestamptz not null,
  is_active   boolean     not null default true,
  created_by  text,
  created_at  timestamptz not null default now()
);

create table if not exists public.live_messages (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.live_sessions(id) on delete cascade,
  text            text not null check (char_length(text) between 1 and 2000),
  user_session_id text not null,
  created_at      timestamptz not null default now()
);

create table if not exists public.live_polls (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references public.live_sessions(id) on delete cascade,
  question    text        not null,
  image_url   text,
  options     jsonb       not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  is_active   boolean     not null default true,
  created_by  text
);
-- in case live_polls existed without session_id:
alter table public.live_polls add column if not exists session_id uuid
  references public.live_sessions(id) on delete cascade;

create table if not exists public.live_poll_votes (
  poll_id         uuid not null references public.live_polls(id) on delete cascade,
  user_session_id text not null,
  selected_option int  not null,
  created_at      timestamptz not null default now(),
  primary key (poll_id, user_session_id)
);

create index if not exists live_sessions_active_idx on public.live_sessions (is_active, end_time desc);
create index if not exists live_messages_session_idx on public.live_messages (session_id, created_at desc);
create index if not exists live_polls_session_idx on public.live_polls (session_id, is_active);

-- ── Realtime ────────────────────────────────────────────────────────────────
alter table public.live_sessions   replica identity full;
alter table public.live_messages   replica identity full;
alter table public.live_polls      replica identity full;
alter table public.live_poll_votes replica identity full;

do $$
declare t text;
begin
  foreach t in array array['live_sessions','live_messages','live_polls','live_poll_votes'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; when undefined_object then null; end;
  end loop;
end $$;

-- ── RLS + policies (idempotent) ─────────────────────────────────────────────
alter table public.live_sessions   enable row level security;
alter table public.live_messages   enable row level security;
alter table public.live_polls      enable row level security;
alter table public.live_poll_votes enable row level security;

do $$
begin
  -- public read
  if not exists (select 1 from pg_policies where policyname='live_sessions_read')   then create policy "live_sessions_read"   on public.live_sessions   for select using (true); end if;
  if not exists (select 1 from pg_policies where policyname='live_messages_read')   then create policy "live_messages_read"   on public.live_messages   for select using (true); end if;
  if not exists (select 1 from pg_policies where policyname='live_polls_read')      then create policy "live_polls_read"      on public.live_polls      for select using (true); end if;
  if not exists (select 1 from pg_policies where policyname='live_poll_votes_read') then create policy "live_poll_votes_read" on public.live_poll_votes for select using (true); end if;

  -- session + poll writes (admin gated client-side)
  if not exists (select 1 from pg_policies where policyname='live_sessions_write') then create policy "live_sessions_write" on public.live_sessions for all using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where policyname='live_polls_write')    then create policy "live_polls_write"    on public.live_polls    for all using (true) with check (true); end if;

  -- anonymous participation
  if not exists (select 1 from pg_policies where policyname='live_messages_insert_active') then
    create policy "live_messages_insert_active" on public.live_messages for insert with check (
      exists (select 1 from public.live_sessions s where s.id = session_id and s.is_active and s.end_time > now()));
  end if;
  if not exists (select 1 from pg_policies where policyname='live_poll_votes_insert_active') then
    create policy "live_poll_votes_insert_active" on public.live_poll_votes for insert with check (
      exists (select 1 from public.live_polls p where p.id = poll_id and p.is_active and p.expires_at > now()));
  end if;
end $$;

-- ── Admin RPCs ──────────────────────────────────────────────────────────────
create or replace function public.end_live_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.live_sessions set is_active=false where id=p_session_id;
  delete from public.live_messages where session_id=p_session_id;
  -- polls are independent (own 24h window); intentionally not deactivated here
end; $$;
grant execute on function public.end_live_session(uuid) to anon, authenticated;

create or replace function public.live_cleanup_expired()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.live_sessions set is_active=false where end_time  <= now() and is_active;
  update public.live_polls    set is_active=false where expires_at <= now() and is_active;
  delete from public.live_messages m using public.live_sessions s
    where m.session_id = s.id and s.end_time <= now();
end; $$;
grant execute on function public.live_cleanup_expired() to anon, authenticated;

-- ── Storage policies: poll images in contextos-documents/live-polls/ ─────────
do $$
begin
  if not exists (select 1 from pg_policies where policyname='live_polls_storage_insert') then
    create policy "live_polls_storage_insert" on storage.objects for insert to anon, authenticated
      with check (bucket_id='contextos-documents' and (storage.foldername(name))[1]='live-polls');
  end if;
  if not exists (select 1 from pg_policies where policyname='live_polls_storage_read') then
    create policy "live_polls_storage_read" on storage.objects for select to anon, authenticated
      using (bucket_id='contextos-documents' and (storage.foldername(name))[1]='live-polls');
  end if;
end $$;


-- ── Promotion banners (16:4 ad images shown between polls) ───────────────────
create table if not exists public.live_promotions (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  link_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by text
);
alter table public.live_promotions replica identity full;
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.live_promotions';
  exception when duplicate_object then null; when undefined_object then null; end;
end $$;
alter table public.live_promotions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where policyname='live_promotions_read') then
    create policy "live_promotions_read" on public.live_promotions for select using (true); end if;
  if not exists (select 1 from pg_policies where policyname='live_promotions_write') then
    create policy "live_promotions_write" on public.live_promotions for all using (true) with check (true); end if;
end $$;

-- Force PostgREST to reload its schema cache (fixes PGRST205 immediately).
notify pgrst, 'reload schema';
