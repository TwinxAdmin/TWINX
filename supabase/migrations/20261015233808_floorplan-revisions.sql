-- „Alaprajzból bejárható 3D lakás" — utólagos geometriai javítás (a kész 3D-ből vissza a 2D javításhoz).
-- approved_plan: a legutóbb jóváhagyott terv pillanatképe — újbóli jóváhagyáskor ehhez hasonlítunk, és csak
--                az érintett helyiségek épülnek újra (rebuild_rooms). revision: hányadik jóváhagyott változat.
-- Újrafuttatható.

alter table public.floorplan_projects add column if not exists approved_plan  jsonb;
alter table public.floorplan_projects add column if not exists rebuild_rooms  jsonb;   -- a legutóbbi jóváhagyáskor érintett helyiség-azonosítók
alter table public.floorplan_projects add column if not exists revision       integer not null default 0;

comment on column public.floorplan_projects.approved_plan is 'A legutóbb jóváhagyott terv (pillanatkép) — utólagos javításnál ehhez képest számoljuk az érintett helyiségeket.';
comment on column public.floorplan_projects.rebuild_rooms is 'A legutóbbi jóváhagyáskor újraépítendő helyiségek azonosítói (első jóváhagyásnál: mind).';
comment on column public.floorplan_projects.revision is 'Hányadik jóváhagyott változat (0 = még nem volt jóváhagyva).';
