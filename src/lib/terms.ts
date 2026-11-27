// ÁSZF + Adatkezelési tájékoztató elfogadásának rögzítése — CSAK szerveroldal (D74, 9. lépés).
// A profilon: terms_version (ÁSZF), privacy_version (tájékoztató), terms_accepted_at (az elfogadás ideje).
// Migrációk: 20261012200044_terms-acceptance.sql, 20261127140000_legal-privacy-version.sql.
// A változatok a src/lib/legal.ts-ből (LEGAL_VERSION); elfogadott = MINDKÉT mező pontosan az aktuális változat.
import { createAdminClient } from "@/lib/supabase/admin";
import { ASZF_VERSION, PRIVACY_VERSION } from "@/lib/legal";

const MIGRATION_HINT = "Az elfogadás mentéséhez futtasd le a 20261127140000_legal-privacy-version.sql migrációt.";

/** Elfogadás mentése (mindkét dokumentum aktuális változata + időpont). Hiba esetén szöveges hibát ad vissza. */
export async function recordTermsAcceptance(userId: string): Promise<string | null> {
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ terms_version: ASZF_VERSION, privacy_version: PRIVACY_VERSION, terms_accepted_at: new Date().toISOString() })
    .eq("id", userId);
  if (!error) return null;
  return /privacy_version|terms_/.test(error.message) ? MIGRATION_HINT : error.message;
}

/** Elfogadta-e az AKTUÁLIS változatokat? `updated`: fogadott el korábbit (→ „Frissítettük…" szöveg).
 *  null = nem dönthető el (pl. a migráció előtt) — ilyenkor nem kérdezünk és nem tiltunk. */
export async function termsStatus(userId: string): Promise<{ accepted: boolean; updated: boolean } | null> {
  const { data, error } = await createAdminClient().from("profiles").select("terms_version, privacy_version").eq("id", userId).maybeSingle();
  if (error || !data) return null;
  const tv = data.terms_version as string | null, pv = data.privacy_version as string | null;
  const accepted = tv === ASZF_VERSION && pv === PRIVACY_VERSION;
  return { accepted, updated: !accepted && tv !== null };
}

/** Szerveroldali kapu a modulok indításához (credits.ts): true = indítható. Migráció előtt nem tilt. */
export async function legalAccepted(userId: string): Promise<boolean> {
  const s = await termsStatus(userId);
  return s === null || s.accepted;
}
