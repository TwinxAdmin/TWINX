-- branding-agent-photo.sql — az arculat-profilhoz az ügynök (partner) saját fotója.
-- A hirdetésen a jobb oszlopban jelenik meg (körkép + név + elérhetőség).
alter table public.branding_profiles add column if not exists agent_photo_url text;
