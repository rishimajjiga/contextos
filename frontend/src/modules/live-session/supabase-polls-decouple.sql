-- ============================================================================
-- ContextOS · Live Session — make polls INDEPENDENT of sessions
-- Run this once. Ending a session will no longer end/deactivate its polls;
-- polls live out their own 24h window. (Re-runnable.)
-- ============================================================================
create or replace function public.end_live_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.live_sessions set is_active = false where id = p_session_id;
  delete from public.live_messages where session_id = p_session_id;
  -- Polls are intentionally left untouched: they run their own 24h window.
end;
$$;
grant execute on function public.end_live_session(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
