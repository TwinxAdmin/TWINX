-- Szakember-kereső — PRO (mélykutatás) aszinkron mód.
-- A Deep Research percekig futhat, ezért aszinkron: a keresés 'processing' állapotban
-- mentődik, a kliens lekérdezi, míg el nem készül. Idempotens; Supabase → SQL Editor.

alter table public.professional_searches
  add column if not exists status text not null default 'completed',   -- 'processing' | 'completed' | 'failed'
  add column if not exists pplx_request_id text;                       -- Perplexity async request id

create index if not exists professional_searches_status_idx
  on public.professional_searches (user_id, status);
