// Irodai fiók — CSAK szerveroldali segédek (service_role kliens).
import { createAdminClient } from "@/lib/supabase/admin";
import type { MyOffice, OfficeMember } from "@/lib/office";

type MemberRow = { office_id: string; user_id: string; role: "owner" | "member"; allowance: number; unlimited: boolean; can_allocate: boolean };
const MEMBER_COLS = "office_id, user_id, role, allowance, unlimited, can_allocate";

/** Az összes iroda, amelynek a felhasználó tagja (név szerint), csatlakozás sorrendjében. */
export async function listMyOffices(userId: string): Promise<{ id: string; name: string; role: "owner" | "member" }[]> {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("office_members").select("office_id, role, joined_at").eq("user_id", userId).order("joined_at", { ascending: true });
  const list = rows ?? [];
  if (list.length === 0) return [];
  const { data: offices } = await admin.from("offices").select("id, name").in("id", list.map((r) => r.office_id as string));
  const names = new Map((offices ?? []).map((o) => [o.id as string, o.name as string]));
  return list.map((r) => ({ id: r.office_id as string, name: names.get(r.office_id as string) ?? "Iroda", role: r.role as "owner" | "member" }));
}

/**
 * Munkakontextus: melyik iroda van kiválasztva, és irodai módban dolgozik-e.
 * Ha a office-multi.sql még nem futott le, a régi work_mode oszlopból következtet.
 */
export async function getWorkContext(userId: string): Promise<{ officeId: string | null; useOffice: boolean }> {
  const admin = createAdminClient();
  const { data: ctx, error } = await admin
    .from("user_office_context").select("office_id, use_office").eq("user_id", userId).maybeSingle();
  if (!error && ctx) return { officeId: (ctx.office_id as string) ?? null, useOffice: !!ctx.use_office };
  // Tartalék (régi séma vagy még nincs kontextus): az első tagság + annak work_mode-ja.
  const { data: m } = await admin
    .from("office_members").select("office_id, work_mode").eq("user_id", userId).order("joined_at", { ascending: true }).limit(1);
  const first = m?.[0];
  return { officeId: (first?.office_id as string) ?? null, useOffice: (first?.work_mode ?? "office") === "office" };
}

/** Kiválasztott iroda + mód mentése. */
export async function setWorkContext(userId: string, patch: { officeId?: string | null; useOffice?: boolean }) {
  const admin = createAdminClient();
  const cur = await getWorkContext(userId);
  const row = {
    user_id: userId,
    office_id: patch.officeId !== undefined ? patch.officeId : cur.officeId,
    use_office: patch.useOffice !== undefined ? patch.useOffice : cur.useOffice,
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from("user_office_context").upsert(row);
  return error;
}

/** Tagsági sor egy MEGADOTT irodában (vagy null). */
export async function getMembershipIn(userId: string, officeId: string): Promise<MemberRow | null> {
  const { data } = await createAdminClient()
    .from("office_members").select(MEMBER_COLS).eq("user_id", userId).eq("office_id", officeId).maybeSingle();
  return (data as MemberRow | null) ?? null;
}

/**
 * A felhasználó tagsága a KIVÁLASZTOTT irodában. Ha nincs kiválasztva (vagy már nem tag
 * ott), az első irodája — így a régi, egy-irodás hívások változatlanul működnek.
 */
export async function getMembership(userId: string): Promise<MemberRow | null> {
  const ctx = await getWorkContext(userId);
  if (ctx.officeId) {
    const m = await getMembershipIn(userId, ctx.officeId);
    if (m) return m;
  }
  const { data } = await createAdminClient()
    .from("office_members").select(MEMBER_COLS).eq("user_id", userId).order("joined_at", { ascending: true }).limit(1);
  return (data?.[0] as MemberRow | undefined) ?? null;
}

/** A felhasználó (kiválasztott) irodájának nézete — szerveroldalon, hogy a tag ne kapja meg az egyenleget. */
export async function loadMyOffice(userId: string): Promise<MyOffice | null> {
  const admin = createAdminClient();
  const m = await getMembership(userId);
  if (!m) return null;

  const { data: o } = await admin
    .from("offices").select("id, name, balance, join_code").eq("id", m.office_id).single();
  if (!o) return null;

  const ctx = await getWorkContext(userId);
  const isOwner = m.role === "owner";
  const base: MyOffice = {
    workMode: ctx.useOffice && ctx.officeId === m.office_id ? "office" : "private",
    id: o.id as string,
    name: o.name as string,
    role: isOwner ? "owner" : "member",
    allowance: m.allowance ?? 0,
    unlimited: !!m.unlimited,
    canAllocate: !!m.can_allocate,
  };
  // A létrehozó ÉS a vezető (kiosztó jogú tag) látja az egyenleget és a csatlakozási kódot.
  if (!(isOwner || m.can_allocate)) return base;

  const { count } = await admin
    .from("office_members").select("user_id", { count: "exact", head: true }).eq("office_id", o.id);
  return { ...base, joinCode: o.join_code as string, balance: (o.balance as number) ?? 0, memberCount: count ?? 1 };
}

/** Az iroda taglistája névvel és e-maillel (a létrehozó és a kiosztók nézetéhez). */
export async function listMembers(officeId: string): Promise<OfficeMember[]> {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("office_members")
    .select("user_id, role, allowance, unlimited, can_allocate, joined_at, joined_via")
    .eq("office_id", officeId)
    .order("joined_at", { ascending: true });
  const list = rows ?? [];
  if (list.length === 0) return [];

  const ids = list.map((r) => r.user_id as string);
  const { data: profiles } = await admin.from("profiles").select("id, full_name").in("id", ids);
  const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string) || ""]));
  const emails = await Promise.all(
    ids.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      return [id, data.user?.email ?? ""] as const;
    })
  );
  const emailMap = new Map(emails);

  return list.map((r) => ({
    userId: r.user_id as string,
    name: names.get(r.user_id as string) || "",
    email: emailMap.get(r.user_id as string) || "",
    role: r.role as "owner" | "member",
    allowance: (r.allowance as number) ?? 0,
    unlimited: !!r.unlimited,
    canAllocate: !!r.can_allocate,
    joinedAt: r.joined_at as string,
  }));
}

/**
 * Keret kiosztása egy MEGADOTT irodában. Az office-multi.sql-ben lévő office_allocate_in-t
 * hívja; ha az még nincs lefuttatva, a régi (egy-irodás) office_allocate-re esik vissza.
 * Visszatér: az új keret, vagy null, ha nem engedélyezett; hiba esetén { error }.
 */
export async function allocateIn(officeId: string, actor: string, member: string, delta: number, note: string | null) {
  // Foglalásos modell (office-reserve.sql): a szabályokat az adatbázis kényszeríti ki,
  // a hibát kódként adja vissza (OFFICE_…) — ezt az officeErrorMessage() fordítja le.
  return createAdminClient().rpc("office_allocate_in", {
    p_office: officeId, p_actor: actor, p_member: member, p_delta: delta, p_note: note,
  });
}

/** Az adatbázis OFFICE_… hibakódjai érthető, magyar üzenetként. */
export function officeErrorMessage(raw: string | undefined | null): string {
  const m = raw ?? "";
  if (m.includes("OFFICE_FREE_INSUFFICIENT")) return "Nincs ennyi szabadon kiosztható kredit. Tölts fel, vagy vegyél vissza keretet valakitől.";
  if (m.includes("OFFICE_ALLOWANCE_LOW")) return "Ennyit nem lehet visszavenni — a kolléga kerete 0 alá menne.";
  if (m.includes("OFFICE_TARGET_UNLIMITED")) return "A létrehozónak és a korlátlan tagnak nem kell keret — ők a szabad részből dolgoznak.";
  if (m.includes("OFFICE_NOT_ALLOWED")) return "Ehhez nincs jogod (magadnak sem oszthatsz keretet).";
  if (m.includes("OFFICE_WRITE_FORBIDDEN") || m.includes("OFFICE_ROLE_LOCKED") || m.includes("OFFICE_OWNER_LOCKED")) return "A művelet nem engedélyezett.";
  return m || "Ismeretlen hiba.";
}

/** Egyenleg, kiosztott (lefoglalt) keretek összege és a szabadon kiosztható rész. */
export async function officeFree(officeId: string): Promise<{ balance: number; allocated: number; free: number }> {
  const { data } = await createAdminClient().rpc("office_free", { p_office: officeId });
  const row = (Array.isArray(data) ? data[0] : data) as { balance?: number; allocated?: number; free?: number } | null;
  return { balance: row?.balance ?? 0, allocated: row?.allocated ?? 0, free: row?.free ?? 0 };
}
