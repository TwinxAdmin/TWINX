-- google-ads-connection.sql
-- A partner Google Ads OAuth-összekötésének tárolása (refresh token + fiók-azonosítók).
-- A szerver ADMIN klienssel ír/olvas; a partner csak a saját sorát látja (RLS).

create table if not exists public.google_ads_connections (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  refresh_token      text not null,
  customer_id        text,            -- a hirdető ügyfél-ID (csak számjegyek)
  login_customer_id  text,            -- MCC/manager ID, ha van
  email              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.google_ads_connections enable row level security;

drop policy if exists gac_owner_select on public.google_ads_connections;
create policy gac_owner_select on public.google_ads_connections
  for select using (auth.uid() = user_id);

-- Írás/módosítás kizárólag szerveroldalról (service role), ezért nincs insert/update policy.
