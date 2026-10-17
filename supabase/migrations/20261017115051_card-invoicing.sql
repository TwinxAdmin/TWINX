-- =====================================================================
-- Twinx — bankkártyás kreditvásárlás + automatikus számla (Stripe → Számlázz.hu Számla Agent)
-- Futtasd a Supabase SQL Editorban. Újrafuttatható.
--
-- A vásárlási napló (credit_purchases) a számla állapotát is viszi:
--   none      — még nem próbáltuk (vagy régi, kézi sor)
--   issuing   — épp kiállítjuk (zárolás, hogy két párhuzamos webhook ne állítson ki két számlát)
--   issued    — kiállítva (invoice_number)
--   failed    — a Számlázz.hu egyértelmű hibát adott → a következő webhook-újraküldés újrapróbálja
--   uncertain — nem kaptunk egyértelmű választ (pl. időtúllépés) → NEM próbáljuk újra magától
--               (különben dupla számla lehetne); az admin ellenőrzi a Számlázz.hu-ban
-- =====================================================================

alter table public.credit_purchases add column if not exists billing_snapshot   jsonb;        -- a számlázási adat pillanatképe a fizetéskor
alter table public.credit_purchases add column if not exists immediate_consent_at timestamptz; -- „azonnali teljesítést kérem, elállási jogomat elvesztem"
alter table public.credit_purchases add column if not exists invoice_status     text not null default 'none';
alter table public.credit_purchases add column if not exists invoice_number     text;
alter table public.credit_purchases add column if not exists invoice_issued_at  timestamptz;
alter table public.credit_purchases add column if not exists invoice_error      text;
alter table public.credit_purchases add column if not exists invoice_attempts   integer not null default 0;
alter table public.credit_purchases add column if not exists invoice_claimed_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'credit_purchases_invoice_status_chk') then
    alter table public.credit_purchases
      add constraint credit_purchases_invoice_status_chk
      check (invoice_status in ('none', 'issuing', 'issued', 'failed', 'uncertain'));
  end if;
end $$;

-- Az admin felülethez: a figyelmet igénylő (hibás / bizonytalan) számlák gyors megtalálása.
create index if not exists credit_purchases_invoice_attention_idx
  on public.credit_purchases (created_at) where invoice_status in ('failed', 'uncertain');

-- ---------------------------------------------------------------------
-- Számla-kiállítás „elkapása": csak EGY hívó nyerhet. Akkor vehető fel, ha
--   • még nem próbáltuk (none) vagy egyértelmű hibával bukott (failed), vagy
--   • „issuing" állapotban ragadt több mint 10 perce (pl. a szerver leállt a hívás előtt).
-- Visszatér: a sor adatai (user_id, credits, amount_huf, billing_snapshot), vagy üres, ha nem vehető fel.
-- ---------------------------------------------------------------------
create or replace function public.credit_purchase_claim_invoice(p_session_id text)
returns table (user_id uuid, credits integer, amount_huf integer, billing_snapshot jsonb, invoice_attempts integer)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  return query
  update public.credit_purchases cp
     set invoice_status = 'issuing',
         invoice_claimed_at = now(),
         invoice_attempts = cp.invoice_attempts + 1
   where cp.stripe_session_id = p_session_id
     and cp.credited_at is not null
     and (cp.invoice_status in ('none', 'failed')
          or (cp.invoice_status = 'issuing' and cp.invoice_claimed_at < now() - interval '10 minutes'))
  returning cp.user_id, cp.credits, cp.amount_huf, cp.billing_snapshot, cp.invoice_attempts;
end;
$$;

revoke all on function public.credit_purchase_claim_invoice(text) from public, anon, authenticated;
