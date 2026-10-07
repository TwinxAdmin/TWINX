-- =====================================================================
-- Twinx — IRODAI EGYENLEG FELTÖLTÉSE (IR6b)
-- Futtasd a Supabase SQL Editorban az office.sql + credit-billing.sql UTÁN.
-- Idempotens: többször is lefuttatható.
--
-- A meglévő kredit-megrendelés folyamatot (számla → befizetés → jóváhagyás)
-- használjuk: ha a megrendelésen ott az office_id, a jóváhagyáskor a kredit
-- az IRODA egyenlegére kerül (nem a megrendelő saját pénztárcájába).
-- =====================================================================

-- 1) A megrendelés melyik irodának szól (null = saját kredit, mint eddig).
alter table public.credit_requests
  add column if not exists office_id uuid references public.offices (id) on delete set null;

-- 2) Jóváhagyás: a meglévő függvény bővítése az irodai ággal.
--    Minden egyetlen tranzakcióban: kérés lezárása + jóváírás + naplózás.
create or replace function public.credit_request_approve(
  p_id          uuid,
  p_admin       uuid,
  p_admin_email text,
  p_amount      integer,   -- null vagy 0 = a kért mennyiség
  p_note        text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid;
  v_email   text;
  v_granted integer;
  v_kind    text;
  v_office  uuid;
  v_oname   text;
begin
  update public.credit_requests
     set status           = 'approved',
         decided_by       = p_admin,
         decided_by_email = p_admin_email,
         decided_at       = now(),
         decision_note    = p_note,
         granted_amount   = coalesce(nullif(p_amount, 0), amount),
         invoice_status   = case when billing_kind = 'invoice' then 'paid' else invoice_status end,
         paid_at          = case when billing_kind = 'invoice' then now() else paid_at end
   where id = p_id
     and status = 'pending'
   returning user_id, user_email, granted_amount, billing_kind, office_id
        into v_user, v_email, v_granted, v_kind, v_office;

  if v_user is null then
    return 0;  -- már elbírálták
  end if;

  if v_office is not null then
    -- IRODAI megrendelés → az iroda egyenlegére + irodai napló.
    update public.offices set balance = balance + v_granted where id = v_office
      returning name into v_oname;
    insert into public.office_ledger (office_id, kind, actor_id, amount, note)
    values (v_office, 'purchase', v_user, v_granted,
            case when v_kind = 'invoice' then 'Befizetett számla' else 'Jóváírás' end);
  else
    -- Saját kredit → a megrendelő pénztárcája (mint eddig).
    insert into public.wallets (user_id, balance)
    values (v_user, v_granted)
    on conflict (user_id) do update
      set balance = public.wallets.balance + excluded.balance,
          updated_at = now();
  end if;

  insert into public.credit_grants (admin_id, admin_email, user_id, user_email, amount, note)
  values (p_admin, p_admin_email, v_user, v_email, v_granted,
          case when v_kind = 'invoice' then 'Befizetett számla' else 'Kredit-kérés jóváhagyva' end
          || case when v_office is not null then ' — IRODAI EGYENLEG: ' || coalesce(v_oname, '?') else '' end
          || coalesce(' — ' || nullif(trim(p_note), ''), ''));

  return v_granted;
end;
$$;

revoke all on function public.credit_request_approve(uuid, uuid, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.credit_request_approve(uuid, uuid, text, integer, text)
  to service_role;

-- 3) Az office_add (admin közvetlen jóváírás) a szerverről hívható legyen.
grant execute on function public.office_add(uuid, integer, uuid, text, text) to service_role;
grant execute on function public.office_allocate(uuid, uuid, integer, text) to service_role;
grant execute on function public.office_deduct(uuid, integer, text) to service_role;
