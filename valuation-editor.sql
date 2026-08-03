-- valuation-editor.sql — szerkeszthető értékbecslés.
-- A riport szövegét is eltároljuk, hogy a partner később újranyithassa és
-- tovább szerkeszthesse ugyanazt a becslést (a PDF cserélhető).
--
-- BIZTONSÁG: szándékosan NEM adunk a felhasználónak UPDATE jogot a
-- usage_history-ra (az RLS sorokat szűr, nem oszlopokat — így át tudná írni
-- a credits_charged mezőt is). A mentést a szerver végzi, tulajdonos-ellenőrzéssel.

alter table public.usage_history
  add column if not exists output_text text,
  add column if not exists edited_at timestamptz;

comment on column public.usage_history.output_text is
  'A generált (és a partner által esetleg szerkesztett) riport szövege.';
comment on column public.usage_history.edited_at is
  'Az utolsó partner-oldali szerkesztés ideje. NULL = még nem szerkesztették.';
