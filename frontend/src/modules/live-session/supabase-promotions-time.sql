-- ContextOS · Live Session — admin-set display time for paid promotions.
-- After expires_at, the promo stops appearing to users. Run once. Idempotent.
alter table public.live_promotions add column if not exists expires_at timestamptz;
create index if not exists live_promotions_active_idx on public.live_promotions (is_active, expires_at);
notify pgrst, 'reload schema';
