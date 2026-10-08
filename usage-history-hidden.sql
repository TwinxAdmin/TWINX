-- usage-history-hidden.sql — „Törlés" a Korábbi munkák oldalon = ELREJTÉS.
-- A CLAUDE.md szerint a tárhelyről nem törlünk: a munka és a fájl megmarad, csak a saját
-- listáidból (Korábbi munkák, saját mappák, Munkáim) tűnik el. Az „Elrejtett munkák" nézetből visszahozható.
alter table public.usage_history add column if not exists hidden_at timestamptz;
create index if not exists usage_history_user_visible_idx on public.usage_history (user_id, created_at desc) where hidden_at is null;
