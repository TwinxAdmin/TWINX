-- „Alaprajzból bejárható 3D lakás" — 3. lépés: a helyiségek berendezése (építő / szabályalapú), helyiségenként.
-- furnishing: { "<roomId>": { items: [...], source, rationale, issues, rounds, seconds, costUsd, model, plan_revision, created_at } }
-- A berendezés a jóváhagyott terv adott változatához tartozik (plan_revision); utólagos javításnál csak a rebuild_rooms
-- helyiségei kapnak újat. Írás CSAK a szerveren. Újrafuttatható.

alter table public.floorplan_projects add column if not exists furnishing jsonb not null default '{}'::jsonb;

comment on column public.floorplan_projects.furnishing is 'Helyiségenkénti berendezés (bútorlista + forrás + mérés) — roomId → objektum.';
