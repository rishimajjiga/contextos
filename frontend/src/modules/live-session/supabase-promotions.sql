-- ============================================================================
-- ContextOS · Live Session — promotion banners (16:4 ad images between polls)
-- Run once. Idempotent. Reuses the existing contextos-documents/live-polls/
-- storage policies for the banner images (no extra storage setup needed).
-- ============================================================================
create extension if not exists pgcrypto;

create table if not exists public.live_promotions (
  id          uuid primary key default gen_random_uuid(),
  image_url   text not null,
  link_url    text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  text
);

alter table public.live_promotions replica identity full;

do $$
begin
  begin execute 'alter publication supabase_realtime add table public.live_promotions';
  exception when duplicate_object then null; when undefined_object then null; end;
end $$;

alter table public.live_promotions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname='live_promotions_read') then
    create policy "live_promotions_read" on public.live_promotions for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='live_promotions_write') then
    create policy "live_promotions_write" on public.live_promotions for all using (true) with check (true);
  end if;
end $$;

notify pgrst, 'reload schema';
