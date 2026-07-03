-- =====================================================================
-- Twinx AI Portal — Stripe / kredit kiegészítések (3. fázis)
-- Futtasd a Supabase SQL Editorban a schema.sql UTÁN.
-- =====================================================================

-- 1) Vásárlások naplója (idempotencia + audit) -------------------------
-- A stripe_session_id egyedi: ha a webhook kétszer fut, nem írunk jóvá duplán.
create table if not exists public.credit_purchases (
  id                 uuid primary key default gen_random_uuid(),
  stripe_session_id  text not null unique,
  user_id            uuid not null references auth.users (id) on delete cascade,
  service_id         uuid not null references public.services (id) on delete cascade,
  credits            integer not null,
  created_at         timestamptz not null default now()
);

alter table public.credit_purchases enable row level security;

drop policy if exists "credit_purchases_select_own" on public.credit_purchases;
create policy "credit_purchases_select_own" on public.credit_purchases
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "credit_purchases_admin_write" on public.credit_purchases;
create policy "credit_purchases_admin_write" on public.credit_purchases
  for all using (public.is_admin()) with check (public.is_admin());


-- 2) Atomikus kredit jóváírás -----------------------------------------
-- Létrehozza vagy növeli a felhasználó adott modulhoz tartozó egyenlegét.
create or replace function public.add_credits(
  p_user_id uuid,
  p_service_id uuid,
  p_amount integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_credits (user_id, service_id, remaining_credits)
  values (p_user_id, p_service_id, p_amount)
  on conflict (user_id, service_id) do update
    set remaining_credits = public.user_credits.remaining_credits + excluded.remaining_credits,
        updated_at = now();
end;
$$;


-- 3) Atomikus kredit levonás ------------------------------------------
-- Csak akkor von le, ha van elég kredit. Visszatér: true = sikeres levonás,
-- false = nincs elég kredit. (Az admin/sales megkerülést a backend intézi.)
create or replace function public.deduct_credit(
  p_user_id uuid,
  p_service_id uuid,
  p_amount integer default 1
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.user_credits
    set remaining_credits = remaining_credits - p_amount,
        updated_at = now()
  where user_id = p_user_id
    and service_id = p_service_id
    and remaining_credits >= p_amount;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;
