-- ============================================================================
-- ContextOS · Live Session module — Migration v2 (bug fixes + new features)
-- Run AFTER supabase-schema.sql. Safe to re-run (idempotent).
-- Fixes: realtime delivery, session-scoped polls, admin manual times,
--        auto-delete on session end, poll image upload (Storage).
-- ============================================================================

-- 1) Polls now belong to a session ------------------------------------------
alter table public.live_polls
  add column if not exists session_id uuid references public.live_sessions(id) on delete cascade;
create index if not exists live_polls_session_idx on public.live_polls (session_id, is_active);

-- 2) Realtime reliability ----------------------------------------------------
-- REPLICA IDENTITY FULL makes UPDATE/DELETE events carry the old row, which the
-- client needs to remove deleted votes/messages from the UI in real time.
alter table public.live_sessions   replica identity full;
alter table public.live_messages   replica identity full;
alter table public.live_polls      replica identity full;
alter table public.live_poll_votes replica identity full;

-- Ensure tables are in the realtime publication (no error if already present).
do $$
declare t text;
begin
  foreach t in array array['live_sessions','live_messages','live_polls','live_poll_votes'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- 3) Atomic session end / cleanup (SECURITY DEFINER so anon key can run it) ---
-- Deactivates the session, deactivates its polls, deletes its chat messages.
create or replace function public.end_live_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.live_sessions set is_active = false where id = p_session_id;
  update public.live_polls    set is_active = false where session_id = p_session_id;
  delete from public.live_messages where session_id = p_session_id;
end;
$$;
grant execute on function public.end_live_session(uuid) to anon, authenticated;

-- Time-based sweep: end any session/poll whose end time has passed and delete
-- the messages of ended sessions. Schedule with pg_cron (snippet at bottom).
create or replace function public.live_cleanup_expired()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.live_sessions set is_active = false where end_time  <= now() and is_active;
  update public.live_polls    set is_active = false where expires_at <= now() and is_active;
  delete from public.live_messages m
  using public.live_sessions s
  where m.session_id = s.id and s.end_time <= now();
end;
$$;
grant execute on function public.live_cleanup_expired() to anon, authenticated;

-- 4) Storage: poll images in the existing private bucket under live-polls/ ----
-- Anon may upload to and read objects only under the live-polls/ folder. The
-- client uses a long-lived signed URL (private bucket, no public exposure).
do $$
begin
  -- upload (admin gated client-side; folder-restricted at DB level)
  if not exists (select 1 from pg_policies where policyname = 'live_polls_storage_insert') then
    create policy "live_polls_storage_insert" on storage.objects
      for insert to anon, authenticated
      with check (bucket_id = 'contextos-documents' and (storage.foldername(name))[1] = 'live-polls');
  end if;
  -- read (needed to mint signed URLs)
  if not exists (select 1 from pg_policies where policyname = 'live_polls_storage_read') then
    create policy "live_polls_storage_read" on storage.objects
      for select to anon, authenticated
      using (bucket_id = 'contextos-documents' and (storage.foldername(name))[1] = 'live-polls');
  end if;
end $$;

-- Optional pg_cron schedule (every 2 min):
--   select cron.schedule('live-cleanup','*/2 * * * *',$$ select public.live_cleanup_expired(); $$);
