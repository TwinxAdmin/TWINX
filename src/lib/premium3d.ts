// Prémium 3D („Alaprajzból 3D") — a modul állapota és a várólista. SZERVEROLDALI modul (service_role).
// Migráció: 20261020150000_premium3d-coming-soon.sql.
//
//   app_settings.premium3d_status:
//     "hidden"      — a menüpont csak az adminnak látszik
//     "coming_soon" — mindenki látja „Hamarosan" jelvénnyel; megnyitva a bemutató + „Értesíts, ha elérhető"; generálás NEM indítható
//     "available"   — ELŐKÉSZÍTVE: élesre egy külön feladat köti be (addig a nem-admin itt is csak a bemutatót látja)
//   Az ADMIN minden állapotban használhatja a modult (fejlesztés, teszt).
// Tartalék: ha a migráció még nem futott le, az állapot "hidden" (a felhasználók semmit nem látnak, nem törik el semmi).
import { createAdminClient } from "@/lib/supabase/admin";

export type Premium3dStatus = "hidden" | "coming_soon" | "available";
export const PREMIUM3D_SETTING_KEY = "premium3d_status";
export const PREMIUM3D_MIGRATION = "20261020150000_premium3d-coming-soon.sql";
/** A nem-adminnak szóló üzenet, ha a modul még nem használható (szerveroldali tiltásnál). */
export const PREMIUM3D_SOON_MESSAGE = "A Prémium 3D hamarosan érkezik — a modul még fejlesztés alatt áll.";

const norm = (v: unknown): Premium3dStatus | null => (v === "hidden" || v === "coming_soon" || v === "available" ? v : null);

export async function premium3dStatus(): Promise<{ status: Premium3dStatus; migrated: boolean; updatedAt: string | null }> {
  try {
    const { data, error } = await createAdminClient()
      .from("app_settings").select("value, updated_at").eq("key", PREMIUM3D_SETTING_KEY).maybeSingle();
    const s = !error ? norm(data?.value) : null;
    if (s) return { status: s, migrated: true, updatedAt: (data?.updated_at as string) ?? null };
  } catch { /* tábla hiányzik / hálózati hiba → tartalék */ }
  return { status: "hidden", migrated: false, updatedAt: null };
}

/** Használhatja-e a modult (3D-generálás, projektek) ez a valódi szerepkör? Most: csak az admin. */
export function canUsePremium3d(realRole: string | null | undefined): boolean {
  // „available" élesítése külön feladat — addig felhasználónak minden állapotban zárva.
  return realRole === "admin";
}

export async function setPremium3dStatus(status: Premium3dStatus, userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await createAdminClient().from("app_settings").upsert(
    { key: PREMIUM3D_SETTING_KEY, value: status, updated_at: new Date().toISOString(), updated_by: userId },
    { onConflict: "key" },
  );
  if (error) return { ok: false, error: /app_settings/.test(error.message) ? `Futtasd le a ${PREMIUM3D_MIGRATION} migrációt.` : error.message };
  return { ok: true };
}

// --- Várólista ---------------------------------------------------------------
export async function isOnWaitlist(userId: string): Promise<boolean> {
  const { data } = await createAdminClient().from("premium3d_waitlist").select("user_id").eq("user_id", userId).maybeSingle();
  return !!data;
}

export async function joinWaitlist(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await createAdminClient()
    .from("premium3d_waitlist").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  if (error) return { ok: false, error: /premium3d_waitlist/.test(error.message) ? `Futtasd le a ${PREMIUM3D_MIGRATION} migrációt.` : error.message };
  return { ok: true };
}

export type WaitlistRow = { userId: string; name: string | null; email: string | null; createdAt: string };
export async function listWaitlist(): Promise<{ migrated: boolean; rows: WaitlistRow[] }> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("premium3d_waitlist").select("user_id, created_at").order("created_at", { ascending: false }).limit(1000);
  if (error) return { migrated: false, rows: [] };
  const ids = (data ?? []).map((r) => r.user_id as string);
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", ids);
    for (const p of profs ?? []) if (p.full_name) names.set(p.id as string, String(p.full_name));
  }
  const emails = new Map<string, string>();
  if (ids.length) {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of list?.users ?? []) if (ids.includes(u.id) && u.email) emails.set(u.id, u.email);
  }
  return {
    migrated: true,
    rows: (data ?? []).map((r) => ({ userId: r.user_id as string, name: names.get(r.user_id as string) ?? null, email: emails.get(r.user_id as string) ?? null, createdAt: r.created_at as string })),
  };
}
