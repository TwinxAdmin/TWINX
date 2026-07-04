-- =====================================================================
-- Twinx AI Portal — Közös (globális) kredit-pénztárca
-- Futtasd a Supabase SQL Editorban a schema.sql + stripe.sql UTÁN.
--
-- Váltás: a korábbi modulonkénti egyenleg (user_credits, service_id-nként)
-- helyett EGY közös egyenleg / felhasználó, ami BÁRMELYIK modulban elkölthető.
-- A user_credits táblát nem töröljük (adat megőrzés), csak már nem használjuk.
-- Idempotens: többször is lefuttatható.
-- =====================================================================

-- 1) Pénztárca tábla — 1 egyenleg / felhasználó -----------------------
create table if not exists public.wallets (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  balance     integer not null default 0 check (balance >= 0),
  updated_at  timestamptz not null default now()
);

alter table public.wallets enable row level security;

-- A felhasználó a saját egyenlegét olvassa; írás csak backend (service_role) / admin.
drop policy if exists "wallets_select_own" on public.wallets;
create policy "wallets_select_own" on public.wallets
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "wallets_admin_write" on public.wallets;
create policy "wallets_admin_write" on public.wallets
  for all using (public.is_admin()) with check (public.is_admin());

drop trigger if exists set_wallets_updated_at on public.wallets;
create trigger set_wallets_updated_at
  before update on public.wallets
  for each row execute function public.set_updated_at();


-- 2) Egyszeri migráció: a meglévő modul-egyenlegek összevonása --------
--    Csak akkor tölt, ha a usernek MÉG NINCS pénztárca sora (nehogy
--    ismételt futtatás duplán összevonjon).
insert into public.wallets (user_id, balance)
select user_id, sum(remaining_credits)
from public.user_credits
group by user_id
on conflict (user_id) do nothing;


-- 3) Atomikus jóváírás (globális) -------------------------------------
create or replace function public.wallet_add(
  p_user_id uuid,
  p_amount  integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wallets (user_id, balance)
  values (p_user_id, p_amount)
  on conflict (user_id) do update
    set balance = public.wallets.balance + excluded.balance,
        updated_at = now();
end;
$$;


-- 4) Atomikus levonás (csak ha van elég egyenleg) ---------------------
--    Visszatér: true = sikeres levonás, false = nincs elég egyenleg.
create or replace function public.wallet_deduct(
  p_user_id uuid,
  p_amount  integer default 1
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.wallets
    set balance = balance - p_amount,
        updated_at = now()
  where user_id = p_user_id
    and balance >= p_amount;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;
