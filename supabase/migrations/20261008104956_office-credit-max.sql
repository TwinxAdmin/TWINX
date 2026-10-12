-- Irodai kreditkérés felső határa: 1000 → 9999 (a kódban ALLOCATE_MAX = 9999)
alter table public.office_credit_requests drop constraint if exists office_credit_requests_amount_check;
alter table public.office_credit_requests
  add constraint office_credit_requests_amount_check check (amount between 1 and 9999);
