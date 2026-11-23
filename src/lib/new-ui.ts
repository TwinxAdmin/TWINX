// „Új felület" kapcsoló és az Ingatlan csomag hozzáférése (terv 12 / 3. szakasz, D30, D40; 3d lépés). CSAK szerver.
//
// - app_settings.new_ui = { enabled: boolean }: ha be van kapcsolva, MINDENKI az új, kredit nélküli felületet kapja.
//   Kikapcsolva csak az admin látja (D51 előnézet); mindenki más a mostani, kredites működést.
// - Ingatlan csomag hozzáférése: company_access (felhasználó × services 'real-estate'); csak admin adja (D30, D44).
// - Bekapcsolt új felületnél: akinek van Ingatlan-hozzáférése, annak NINCS levonás (Márk döntése, 2026-11-23);
//   a pénztárca-tábla láthatatlanul megmarad. A költséget később a láthatatlan havi plafon védi (terv 20).
import { createAdminClient } from "@/lib/supabase/admin";

export const NEW_UI_SETTING_KEY = "new_ui";
export const ESTATE_SERVICE_SLUG = "real-estate";

export async function newUiEnabled(): Promise<boolean> {
  try {
    const { data } = await createAdminClient().from("app_settings").select("value").eq("key", NEW_UI_SETTING_KEY).maybeSingle();
    return (data?.value as { enabled?: boolean } | null)?.enabled === true;
  } catch { return false; }
}

export async function setNewUiEnabled(enabled: boolean, actorId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { error } = await admin.from("app_settings").upsert(
    { key: NEW_UI_SETTING_KEY, value: { enabled }, updated_at: new Date().toISOString(), updated_by: actorId },
    { onConflict: "key" },
  );
  if (error) return { ok: false, error: error.message };
  await admin.from("access_audit_log").insert({ actor_id: actorId, action: enabled ? "uj_felulet_be" : "uj_felulet_ki" });
  return { ok: true };
}

/** Az új felületet látja-e ez a felhasználó: admin mindig, más csak bekapcsolt kapcsolóval. */
export async function newUiFor(role: string | null | undefined): Promise<boolean> {
  return role === "admin" || (await newUiEnabled());
}

let estateServiceId: string | null = null;
async function estateService(): Promise<string | null> {
  if (estateServiceId) return estateServiceId;
  const { data } = await createAdminClient().from("services").select("id").eq("slug", ESTATE_SERVICE_SLUG).maybeSingle();
  estateServiceId = (data?.id as string | undefined) ?? null;
  return estateServiceId;
}

export async function hasEstateAccess(userId: string): Promise<boolean> {
  const sid = await estateService();
  if (!sid) return false;
  const { data } = await createAdminClient().from("company_access").select("id").eq("user_id", userId).eq("service_id", sid).maybeSingle();
  return !!data;
}

/** Az összes Ingatlan-hozzáféréssel rendelkező felhasználó azonosítója (admin listához). */
export async function estateAccessUserIds(): Promise<Set<string>> {
  const sid = await estateService();
  if (!sid) return new Set();
  const { data } = await createAdminClient().from("company_access").select("user_id").eq("service_id", sid);
  return new Set((data ?? []).map((r) => r.user_id as string));
}

export async function setEstateAccess(userId: string, enabled: boolean, actorId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const sid = await estateService();
  if (!sid) return { ok: false, error: "Hiányzik az „Ingatlan” (real-estate) szolgáltatás a services táblából." };
  const admin = createAdminClient();
  const { error } = enabled
    ? await admin.from("company_access").upsert({ user_id: userId, service_id: sid }, { onConflict: "user_id,service_id", ignoreDuplicates: true })
    : await admin.from("company_access").delete().eq("user_id", userId).eq("service_id", sid);
  if (error) return { ok: false, error: error.message };
  await admin.from("access_audit_log").insert({
    actor_id: actorId, action: enabled ? "ingatlan_hozzaferes_megadva" : "ingatlan_hozzaferes_elveve",
    module_key: ESTATE_SERVICE_SLUG, target_user_id: userId,
  });
  return { ok: true };
}

/** Levonás nélkül futhat-e (bekapcsolt új felület + Ingatlan-hozzáférés). */
export async function freeByEstateAccess(userId: string): Promise<boolean> {
  if (!(await newUiEnabled())) return false;
  return hasEstateAccess(userId);
}
