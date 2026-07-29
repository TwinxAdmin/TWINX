-- =====================================================================
-- Twinx — Stripe webhook megerősítése éles indulás előtt
-- Futtasd a Supabase SQL Editorban a DEPLOY ELŐTT.
--
-- Miért kell: eddig a vásárlás rögzítése és a kredit jóváírása két külön
-- lépés volt. Ha a rögzítés sikerült, de a jóváírás elhasalt, a partner
-- FIZETETT, de nem kapott kreditet — és az újrapróbálkozást pont az egyedi
-- kulcs blokkolta.
--
-- A megoldás: a jóváírás EGYETLEN adatbázis-tranzakcióban történik a
-- "megjelöléssel" együtt (credit_purchase_apply). Így nem létezik olyan
-- pillanat, amikor a sor jóváírtnak látszik, de a kredit nem ment át —
-- és két párhuzamos webhook sem adhat kétszer kreditet.
-- =====================================================================

-- Mikor íródott jóvá a kredit (null = még nem).
alter table public.credit_purchases add column if not exists credited_at timestamptz;

-- Éles vagy teszt fizetés volt-e. A régi soroknál ismeretlen (null) marad,
-- hogy a teszt vásárlások ne rontsák el visszamenőleg a bevétel-riportot.
alter table public.credit_purchases add column if not exists livemode boolean;

-- A MEGLÉVŐ, régi vásárlásokat jóváírtnak tekintjük (a régi kód már jóváírta).
-- Az "1 órán belüli" sorokat kihagyjuk, hogy egy épp futó, félbemaradt
-- jóváírást ne jelöljünk tévesen késznek.
update public.credit_purchases
   set credited_at = created_at
 where credited_at is null
   and created_at < now() - interval '1 hour';

-- A függőben maradt (fizetett, de jóvá nem írt) vásárlások gyors megtalálásához.
create index if not exists credit_purchases_pending_idx
  on public.credit_purchases (created_at) where credited_at is null;

-- ---------------------------------------------------------------------
-- Jóváírás EGYSZER, egyetlen tranzakcióban.
-- Visszatér: true = most írtuk jóvá, false = már jóvá volt írva (vagy nincs sor).
-- A kredit mennyisége a MENTETT sorból jön, nem a webhook adatából — így
-- manipulált metadata sem adhat több kreditet.
-- ---------------------------------------------------------------------
create or replace function public.credit_purchase_apply(p_session_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid;
  v_credits integer;
begin
  -- A sor "elkapása": csak EGY hívó nyerhet (a sor zárolva van az UPDATE alatt).
  update public.credit_purchases
     set credited_at = now()
   where stripe_session_id = p_session_id
     and credited_at is null
   returning user_id, credits into v_user, v_credits;

  if v_user is null then
    return false;  -- már jóváírva, vagy nincs ilyen vásárlás
  end if;

  -- UGYANEBBEN a tranzakcióban írjuk jóvá. Ha ez hibázik, a fenti UPDATE is
  -- visszagördül → a következő webhook újra nekifuthat.
  insert into public.wallets (user_id, balance)
  values (v_user, v_credits)
  on conflict (user_id) do update
    set balance = public.wallets.balance + excluded.balance,
        updated_at = now();

  return true;
end;
$$;

revoke all on function public.credit_purchase_apply(text) from public, anon, authenticated;
grant execute on function public.credit_purchase_apply(text) to service_role;
