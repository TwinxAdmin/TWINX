-- =====================================================================
-- AJÁNDÉKKÓD TESZT — takarítás előtte és utána
-- Teszt e-mail cím:  mym.kontakt@gmail.com
--
-- Fontos háttér: a kampány számlálója az `ingatlan_invites` táblában azokat a
-- sorokat számolja, amelyekhez MÁR KIADOTT kód tartozik (code is not null).
-- Tehát a keret akkor szabadul fel újra, ha a teszt-sort töröljük.
-- A `redeemed_by` FK „on delete set null", ezért a felhasználó törlése önmagában
-- NEM szabadítja fel a helyet — a sort külön kell törölni (lásd lent).
-- =====================================================================


-- =====================================================================
-- A) TESZT ELŐTT — a mym.kontakt@gmail.com fiók eltakarítása
-- =====================================================================

-- A/0) Mi van most ezen a címen? (előbb nézd meg, csak utána törölj)
select id, email, created_at from auth.users        where email = 'mym.kontakt@gmail.com';
select id, role, invite_code, signup_source from public.profiles
  where id in (select id from auth.users where email = 'mym.kontakt@gmail.com');
select id, name, email, status, code, redeemed_by, created_at
  from public.ingatlan_invites where email = 'mym.kontakt@gmail.com';

-- A/1) A FIÓK TÖRLÉSE a Supabase felületén:
--      Authentication → Users → mym.kontakt@gmail.com → ⋯ → Delete user
--      Minden hozzá tartozó adat (profil, pénztárca, előzmények) kaszkádban törlődik.
--      (SQL-ből is menne — `delete from auth.users where email = '...';` —
--       de a felületen biztonságosabb, mert ott látod, mit törölsz.)

-- A/2) Ha maradt korábbi jelentkezés ezen a címen, azt is töröld,
--      különben „már jelentkeztél" hibát kapsz a landingen:
delete from public.ingatlan_invites where email = 'mym.kontakt@gmail.com';

-- A/3) Ellenőrzés: hány kód van kiadva a kampányban (ez a szám a 50-ből)?
select count(*) as kiadott_kodok from public.ingatlan_invites where code is not null;


-- =====================================================================
-- B) TESZT UTÁN — az elhasznált 1 db kód visszaállítása
--    (a sikeres kiadás + beváltás ellenőrzése után futtasd)
-- =====================================================================

-- B/1) A teszt-fiókról vedd le a beváltás-jelölést (ha beváltottad a kódot).
update public.profiles
   set invite_code = null, signup_source = null
 where id in (select id from auth.users where email = 'mym.kontakt@gmail.com');

-- B/2) A teszt-jelentkezés törlése → a kampány kerete visszaáll.
delete from public.ingatlan_invites where email = 'mym.kontakt@gmail.com';

-- B/3) Ellenőrzés: a kiadott kódok száma eggyel csökkent.
select count(*) as kiadott_kodok from public.ingatlan_invites where code is not null;

-- B/4) OPCIONÁLIS: a teszt-fiókra jóváírt kredit visszavétele.
--      (Ha a fiókot úgyis törlöd az Authentication → Users alatt, felesleges.)
-- update public.wallets w
--    set balance = greatest(0, w.balance - 7)
--  where w.user_id in (select id from auth.users where email = 'mym.kontakt@gmail.com');
