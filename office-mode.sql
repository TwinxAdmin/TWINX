-- =====================================================================
-- Twinx — IRODAI MUNKAMÓD + KREDITLEVONÁS (IR5)
-- Futtasd a Supabase SQL Editorban az office.sql + office-topup.sql UTÁN.
-- Idempotens: többször is lefuttatható.
--
-- • office_members.work_mode: 'office' = az irodai keretből dolgozik,
--   'private' = a saját pénztárcájából. Új tagnál alapból 'office'.
-- • credit_refund(): sikertelen generálás utáni visszatérítés oda, AHONNAN
--   levontuk (iroda vagy saját pénztárca) — hogy irodai kredit ne vándoroljon
--   a tag saját egyenlegére, és fordítva.
-- =====================================================================

alter table public.office_members
  add column if not exists work_mode text not null default 'office'
  check (work_mode in ('office', 'private'));

-- Visszatérítés: ha az elmúlt 1 napban van ugyanekkora, még vissza nem térített
-- IRODAI levonása, oda megy vissza (iroda egyenlege + a tag kerete); különben a
-- saját pénztárcába. Visszatér: 'office' vagy 'wallet'.
create or replace function public.credit_refund(p_user uuid, p_amount integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     bigint;
  v_office uuid;
  v_role   text;
  v_unl    boolean;
begin
  if p_amount is null or p_amount <= 0 then return 'none'; end if;

  select l.id, l.office_id into v_id, v_office
    from public.office_ledger l
   where l.member_id = p_user
     and l.kind = 'spend'
     and l.amount = -p_amount
     and l.note is null
     and l.created_at > now() - interval '1 day'
   order by l.created_at desc
   limit 1
   for update;

  if v_id is not null then
    update public.office_ledger set note = 'visszatérítve' where id = v_id;
    update public.offices set balance = balance + p_amount where id = v_office;

    select role, unlimited into v_role, v_unl
      from public.office_members where user_id = p_user and office_id = v_office;
    if found and not (v_role = 'owner' or v_unl) then
      update public.office_members set allowance = allowance + p_amount
       where user_id = p_user and office_id = v_office;
    end if;

    insert into public.office_ledger (office_id, kind, actor_id, member_id, amount, note)
    values (v_office, 'adjust', p_user, p_user, p_amount, 'Visszatérítés (sikertelen generálás)');
    return 'office';
  end if;

  perform public.wallet_add(p_user, p_amount);
  return 'wallet';
end;
$$;

revoke all on function public.credit_refund(uuid, integer) from public, anon, authenticated;
grant execute on function public.credit_refund(uuid, integer) to service_role;
