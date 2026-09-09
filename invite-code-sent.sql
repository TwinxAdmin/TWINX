-- =====================================================================
-- TWINX — ajándékkód KIKÜLDÉSÉNEK naplózása
-- Futtasd a Supabase SQL Editorban az ingatlan-invites.sql UTÁN.
--
-- Miért kell: az elfogadás mostantól CSAK legenerálja a kódot, a levél nem
-- megy ki automatikusan. A munkatárs előbb megnézi az előnézetet, és külön
-- gombbal küldi ki. Ezek az oszlopok mutatják, hogy megtörtént-e a kiküldés,
-- mikor, és melyik kolléga indította.
-- =====================================================================

alter table public.ingatlan_invites add column if not exists code_sent_at       timestamptz;
alter table public.ingatlan_invites add column if not exists code_sent_by_email text;

comment on column public.ingatlan_invites.code_sent_at is
  'Mikor ment ki a kódot tartalmazó levél a jelentkezőnek. NULL = még nem küldtük ki.';
comment on column public.ingatlan_invites.code_sent_by_email is
  'Melyik munkatárs indította a kiküldést (admin vagy sales).';

-- A KORÁBBI kiadott kódokat kiküldöttnek jelöljük, hogy ne mutassa őket
-- „még nincs kiküldve" állapotúnak a régi (automatikus küldésű) rendszerből.
update public.ingatlan_invites
   set code_sent_at = coalesce(code_sent_at, decided_at, created_at)
 where code is not null and code_sent_at is null;
