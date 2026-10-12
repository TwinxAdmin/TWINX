-- Értékbecslés job → előzmény-sor kapcsolat. Enélkül a kész becslés
-- szerkesztője a job azonosítójával próbált menteni („Nem található ez az értékbecslés").
alter table public.valuation_jobs
  add column if not exists history_id uuid references public.usage_history(id) on delete set null;

-- A motor levezetése (audit) a jobon is: ebből épül az egyoldalas lap indoklás-listája
-- még mielőtt az előzmény-lista frissülne.
alter table public.valuation_jobs
  add column if not exists audit jsonb;
