// ÁSZF-elfogadás rögzítése — CSAK szerveroldal (20261012200044_terms-acceptance.sql).
// A profilon: melyik változatot (TERMS_VERSION) és mikor fogadta el a partner.
import { createAdminClient } from "@/lib/supabase/admin";
import { TERMS_VERSION } from "@/lib/legal";

/** Változatszámok összevetése („1.10" > „1.9"): negatív, ha a < b. */
function cmpVersion(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number(n) || 0);
  const pb = b.split(".").map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** Elfogadás mentése. Ha a migráció még nem futott le, a hibát visszaadjuk (a hívó dönti el, mit kezd vele).
 *  Újabb, már elfogadott változatot SOHA nem írunk vissza régebbire (pl. egy régebbi kódú fejlesztői szerverről) —
 *  különben a két változat egymás után újra és újra feldobná az ablakot. */
export async function recordTermsAcceptance(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: cur } = await admin.from("profiles").select("terms_version").eq("id", userId).maybeSingle();
  const prev = (cur?.terms_version as string | null) ?? null;
  if (prev && cmpVersion(prev, TERMS_VERSION) >= 0) return null; // már ezt vagy újabbat elfogadott
  const { error } = await admin
    .from("profiles")
    .update({ terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() })
    .eq("id", userId);
  if (!error) return null;
  return /terms_/.test(error.message) ? "Az ÁSZF-elfogadáshoz futtasd le a 20261012200044_terms-acceptance.sql migrációt." : error.message;
}

/** Elfogadta-e az AKTUÁLIS (vagy újabb) változatot, és fogadott-e el korábbit (→ „frissült" szöveg)?
 *  Az ablak tehát CSAK akkor jön fel újra, ha a TERMS_VERSION-t (src/lib/legal.ts) kézzel megemeljük — Márk kérésére.
 *  null = nem dönthető el, pl. a migráció előtt — ilyenkor nem kérdezünk. */
export async function termsStatus(userId: string): Promise<{ accepted: boolean; updated: boolean } | null> {
  const { data, error } = await createAdminClient().from("profiles").select("terms_version").eq("id", userId).maybeSingle();
  if (error || !data) return null;
  const v = data.terms_version as string | null;
  const accepted = v !== null && cmpVersion(v, TERMS_VERSION) >= 0;
  return { accepted, updated: v !== null && !accepted };
}
