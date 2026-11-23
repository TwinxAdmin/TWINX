// Egyedi modulok elérhetősége (terv 14 / 2.5) — CSAK szerver. Minden egyedi modul oldala és végpontja ezt hívja.
import { createAdminClient } from "@/lib/supabase/admin";
import { MODULE_REGISTRY } from "@/lib/module-registry";

/** Az admin mindig; más akkor, ha van aktív hozzáférése egy aktív, érvényes céges moduljához (bármelyik cégében). */
export async function userCanUseModule(userId: string, moduleKey: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (p?.role === "admin") return true;
  const { data: rows } = await admin.from("module_access").select("company_module_id")
    .eq("user_id", userId).eq("module_key", moduleKey).eq("status", "aktiv");
  for (const r of rows ?? []) {
    const { data: ok } = await admin.rpc("user_has_module_access", { p_user: userId, p_cm: r.company_module_id });
    if (ok === true) return true;
  }
  return false;
}

/** A felhasználó által elérhető egyedi modulok kulcsai (a Moduljaim menühöz). Hiányzó migrációnál üres. */
export async function accessibleModuleKeys(userId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data: rows, error } = await admin.from("module_access").select("company_module_id, module_key")
    .eq("user_id", userId).eq("status", "aktiv");
  if (error) return [];
  const keys = new Set<string>();
  for (const r of rows ?? []) {
    if (keys.has(r.module_key as string)) continue;
    const { data: ok } = await admin.rpc("user_has_module_access", { p_user: userId, p_cm: r.company_module_id });
    if (ok === true) keys.add(r.module_key as string);
  }
  return MODULE_REGISTRY.filter((m) => keys.has(m.key)).map((m) => m.key);
}

/** Cégvezető-e bármelyik aktív cégben (a „Hozzáférések" menüponthoz). */
export async function isAnyCompanyHead(userId: string): Promise<boolean> {
  const { count, error } = await createAdminClient().from("company_members").select("company_id", { count: "exact", head: true })
    .eq("user_id", userId).eq("status", "aktiv").eq("is_company_head", true);
  return !error && (count ?? 0) > 0;
}
