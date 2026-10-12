-- A korábbi videók is kapják meg az ingatlan címét a „Munkáim" / „Korábbi munkák" listákhoz.
-- Forrás: video_jobs.title (a varázslóban megadott ingatlancím), a kimeneti fájl URL-je alapján párosítva.
update public.usage_history h
set input_data = coalesce(h.input_data, '{}'::jsonb) || jsonb_build_object('address', j.title)
from public.video_jobs j
where h.feature_used = 'video'
  and j.output_url is not null
  and j.output_url = h.output_file_url
  and nullif(trim(coalesce(j.title, '')), '') is not null
  and coalesce(h.input_data ->> 'address', '') = '';
