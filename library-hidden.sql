-- library-hidden.sql — „Törlés" = ELREJTÉS a videó- és a hirdetés-ellenőrző könyvtárban is.
-- (CLAUDE.md: a tárhelyről nem törlünk.) A fájl megmarad, a listákból eltűnik, és a
-- Korábbi munkák „Elrejtett munkák" nézetéből visszahozható (a hozzá tartozó usage_history sorral együtt).
alter table public.video_jobs add column if not exists hidden_at timestamptz;
alter table public.ad_checks  add column if not exists hidden_at timestamptz;
