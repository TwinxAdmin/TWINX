-- =====================================================================
-- Twinx — irodai egyenleg feltöltése BANKKÁRTYÁVAL (Stripe)
-- Futtasd a Supabase SQL Editorban a 20261017115051_card-invoicing.sql UTÁN. Újrafuttatható.
--
-- A kártyás vásárlás során megjelölhető, hogy a kredit egy iroda közös egyenlegére menjen.
-- A jóváírás továbbra is EGYETLEN tranzakcióban történik (credit_purchase_apply):
--   • office_id üres  → a vásárló saját pénztárcája (mint eddig);
--   • office_id meg van adva → az iroda egyenlege + bejegyzés az irodai naplóba („purchase");
--     ha az iroda közben megszűnt, a kredit NEM vész el: a vásárló saját pénztárcájába kerül.
-- =====================================================================

alter table public.credit_purchases
  add column if not exists office_id uuid references public.offices (id) on delete set null;

create or replace function public.credit_purchase_apply(p_session_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid;
  v_credits integer;
  v_office  uuid;
begin
  -- A sor "elkapása": csak EGY hívó nyerhet (a sor zárolva van az UPDATE alatt).
  update public.credit_purchases
     set credited_at = now()
   where stripe_session_id = p_session_id
     and credited_at is null
   returning user_id, credits, office_id into v_user, v_credits, v_office;

  if v_user is null then
    return false;  -- már jóváírva, vagy nincs ilyen vásárlás
  end if;

  if v_office is not null then
    update public.offices set balance = balance + v_credits where id = v_office;
    if found then
      insert into public.office_ledger (office_id, kind, actor_id, amount, note)
      values (v_office, 'purchase', v_user, v_credits, 'Bankkártyás feltöltés');
      return true;
    end if;
    -- az iroda már nem létezik → a vásárló saját egyenlegére (lent)
  end if;

  insert into public.wallets (user_id, balance)
  values (v_user, v_credits)
  on conflict (user_id) do update
    set balance = public.wallets.balance + excluded.balance,
        updated_at = now();

  return true;
end;
$$;

revoke all on function public.credit_purchase_apply(text) from public, anon, authenticated;
