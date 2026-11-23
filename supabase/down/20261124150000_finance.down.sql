-- VISSZACSINÁLÁS: 20261124150000_finance.sql
-- FIGYELEM: az ajánlatok, a fizetési tételek és a lejárati értesítések elvesznek. A cap_add_pack visszaáll a
-- terv 20 szerinti (fizetési tétel nélküli) változatra. Újrafuttatható.

drop function if exists public.expiry_mark_notified(uuid, date, integer);
drop function if exists public.expiry_notifications_due();
drop function if exists public.payment_close(uuid, uuid, text, text);
drop function if exists public.payment_mark_paid(uuid, uuid, date, text);
drop function if exists public.payment_set_invoiced(uuid, uuid, text, date);
drop function if exists public.payment_add(uuid, uuid, uuid, text, text, integer, numeric, date, date, date);
drop function if exists public.quote_accept(uuid, uuid, jsonb);
drop function if exists public.quote_update_status(uuid, uuid, text);
drop function if exists public.quote_create(uuid, uuid, uuid, text, integer, numeric, date, text);
drop function if exists public.company_billing_snapshot(uuid);

alter table if exists public.module_cap_adjustments drop constraint if exists module_cap_adjustments_payment_fk;
drop table if exists public.expiry_notifications;
drop table if exists public.company_payments;
drop table if exists public.company_quotes;

-- A pluszcsomag korábbi (terv 20) változata:
create or replace function public.cap_add_pack(p_actor uuid, p_cm uuid, p_extra_cost_ft integer, p_extra_units integer,
  p_price_net integer, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cm public.company_modules%rowtype; v_period text := public.budapest_period(); v_id uuid;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  if coalesce(p_extra_cost_ft, 0) <= 0 or coalesce(trim(p_reason), '') = '' then return jsonb_build_object('ok', false, 'error', 'hianyzo_mezo'); end if;
  select * into cm from public.company_modules where id = p_cm for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if cm.monthly_cap is null then return jsonb_build_object('ok', false, 'error', 'nincs_keret'); end if;
  insert into public.module_cap_adjustments (company_module_id, period, extra_cost_ft, extra_units, price_net, reason, created_by)
  values (p_cm, v_period, p_extra_cost_ft, p_extra_units, p_price_net, trim(p_reason), p_actor) returning id into v_id;
  insert into public.access_audit_log (actor_id, action, company_id, module_key, details)
  values (p_actor, 'pluszcsomag_hozzaadva', cm.company_id, cm.module_key,
          jsonb_build_object('period', v_period, 'extra_cost_ft', p_extra_cost_ft, 'extra_units', p_extra_units));
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;
revoke all on function public.cap_add_pack(uuid, uuid, integer, integer, integer, text) from public, anon, authenticated;
grant execute on function public.cap_add_pack(uuid, uuid, integer, integer, integer, text) to service_role;
