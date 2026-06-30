-- ContextOS · Live Session — add 'sponsored' flag to promotions (paid vs own).
-- Run once. Idempotent.
alter table public.live_promotions add column if not exists sponsored boolean not null default false;
notify pgrst, 'reload schema';
