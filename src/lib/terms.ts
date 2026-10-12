// ÁSZF-elfogadás rögzítése — CSAK szerveroldal (20261012200044_terms-acceptance.sql).
// A profilon: melyik változatot (TERMS_VERSION) és mikor fogadta el a partner.
import { createAdminClient } from "@/lib/supabase/admin";
import { TERMS_VERSION } from "@/lib/legal";

/** Elfogadás mentése. Ha a migráció még nem futott le, a hibát visszaadjuk (a hívó dönti el, mit kezd vele). */
export async function recordTermsAcceptance(userId: string): Promise<string | null> {
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() })
    .eq("id", userId);
  if (!error) return null;
  return /terms_/.test(error.message) ? "Az ÁSZF-elfogadáshoz futtasd le a 20261012200044_terms-acceptance.sql migrációt." : error.message;
}

/** Elfogadta-e az AKTUÁLIS változatot, és fogadott-e el korábbit (→ „frissült" szöveg)?
 *  null = nem dönthető el, pl. a migráció előtt — ilyenkor nem kérdezünk. */
export async function termsStatus(userId: string): Promise<{ accepted: boolean; updated: boolean } | null> {
  const { data, error } = await createAdminClient().from("profiles").select("terms_version").eq("id", userId).maybeSingle();
  if (error || !data) return null;
  const v = data.terms_version as string | null;
  return { accepted: v === TERMS_VERSION, updated: v !== null && v !== TERMS_VERSION };
}
