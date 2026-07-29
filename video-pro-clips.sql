-- =====================================================================
-- Twinx — PRO videó: több AI-klip biztonságos kezelése
-- Futtasd a Supabase SQL Editorban a video-library.sql UTÁN.
--
-- Miért kell: PRO-nál minden fotóból külön AI-klip készül, és a webhookok
-- szinte egyszerre érkeznek vissza. Ha mindegyik a teljes meta mezőt írná
-- felül, az egyik eredménye elveszne (a job örökre „készül" maradna).
-- Ezért a klip-eredményt EGYETLEN atomi UPDATE írja be, a render indítását
-- és a kredit-visszatérítést pedig „csak egyszer" jellegű váltás védi.
-- =====================================================================

-- Egyszeri visszatérítés jelölése (hogy dupla jóváírás ne fordulhasson elő).
alter table public.video_jobs add column if not exists refunded_at timestamptz;

-- 1) Egy AI-klip eredményének atomi beírása. Visszaadja a teljes ai_clips tömböt.
--    Csak létező indexre ír (különben a Postgres a tömb VÉGÉRE fűzne, és
--    összekeverednének a snittek sorrendjei).
create or replace function public.video_clip_result(
  p_job    uuid,
  p_index  int,
  p_url    text,
  p_failed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clips jsonb;
begin
  update public.video_jobs
     set meta = jsonb_set(
           coalesce(meta, '{}'::jsonb),
           array['ai_clips', p_index::text],
           coalesce(meta -> 'ai_clips' -> p_index, '{}'::jsonb)
             || case
                  when p_failed then jsonb_build_object('failed', true)
                  else jsonb_build_object('videoUrl', p_url)
                end,
           false -- ne hozzon létre új elemet: csak meglévő indexet frissítünk
         )
   where id = p_job
     and jsonb_typeof(meta -> 'ai_clips') = 'array'
     and p_index < jsonb_array_length(meta -> 'ai_clips')
   returning meta -> 'ai_clips' into v_clips;

  if v_clips is null then
    -- Nem írtunk (pl. még nincs kliplista): a friss állapotot adjuk vissza.
    select meta -> 'ai_clips' into v_clips from public.video_jobs where id = p_job;
  end if;

  return coalesce(v_clips, '[]'::jsonb);
end;
$$;

-- 1/b) A beküldési azonosítók (requestId) ÖSSZEFÉSÜLÉSE a már beérkezett
--      eredményekkel. Enélkül a beküldés utáni mentés felülírná azt a klipet,
--      amelyik nagyon gyorsan visszaért.
--      FIGYELEM a sorrendre: a jsonb `||` operátornál a JOBB oldal nyer, ezért
--      a p_clips (az új azonosítók) kerül jobbra — így az üres helyfoglaló nem
--      írja felül a valódi requestId-t. A már meglévő videoUrl/failed megmarad,
--      mert azokat a p_clips nem tartalmazza.
create or replace function public.video_clips_init(p_job uuid, p_clips jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clips jsonb;
begin
  update public.video_jobs
     set meta = jsonb_set(
           coalesce(meta, '{}'::jsonb),
           '{ai_clips}',
           (
             select coalesce(jsonb_agg(
                      coalesce(meta -> 'ai_clips' -> i, '{}'::jsonb) || (p_clips -> i)
                      order by i
                    ), '[]'::jsonb)
             from generate_series(0, jsonb_array_length(p_clips) - 1) as i
           ),
           true
         )
   where id = p_job
   returning meta -> 'ai_clips' into v_clips;

  return coalesce(v_clips, '[]'::jsonb);
end;
$$;

-- 2) A render indításának „elkapása": csak EGY hívó kapja meg (animating → rendering).
--    Így a webhook és a lekérdezéses biztonsági háló nem indíthat két rendert.
create or replace function public.video_job_claim_render(p_job uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.video_jobs
     set status = 'rendering'
   where id = p_job
     and status = 'animating';
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

-- 3) Job bukása EGYSZER — visszatérítés csak akkor, ha ez a hívó jelölte meg.
create or replace function public.video_job_fail_once(p_job uuid, p_error text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.video_jobs
     set status = 'failed',
         error = p_error,
         refunded_at = now()
   where id = p_job
     and refunded_at is null
     and status <> 'done';
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

-- Csak a szerveroldali (service_role) kód hívhatja ezeket.
revoke all on function public.video_clip_result(uuid, int, text, boolean) from public, anon;
revoke all on function public.video_clips_init(uuid, jsonb) from public, anon;
revoke all on function public.video_job_claim_render(uuid) from public, anon;
revoke all on function public.video_job_fail_once(uuid, text) from public, anon;

grant execute on function public.video_clip_result(uuid, int, text, boolean) to service_role;
grant execute on function public.video_clips_init(uuid, jsonb) to service_role;
grant execute on function public.video_job_claim_render(uuid) to service_role;
grant execute on function public.video_job_fail_once(uuid, text) to service_role;
