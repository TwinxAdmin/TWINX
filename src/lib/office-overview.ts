// Irodai felület — összesítő adatok (CSAK szerveroldal, service_role).
// A jogosultságot a hívó API route dönti el; itt csak az adat összerakása történik.
//
// Fogalmak (foglalásos keret, office-reserve.sql):
//   • kiosztva  = a nem korlátlan tagok lefoglalt kereteinek összege
//   • szabad    = irodai egyenleg − kiosztva
//   • felhasznált = az időszak 'spend' naplósorai (a visszatérítettek nélkül)
//   • munkák    = a usage_history azon sorai, amelyek IRODAI módban készültek (office_id)
import { createAdminClient } from "@/lib/supabase/admin";
import { activityTitle, featureLabel } from "@/lib/activity";
import { SERVICE_LABELS, type OfficeMember } from "@/lib/office";
import { listMembers, officeFree } from "@/lib/office-server";

export type OverviewRange = "7d" | "14d" | "30d" | "all";
export type OfficeRoleLabel = "owner" | "manager" | "member";

export const RANGE_DAYS: Record<Exclude<OverviewRange, "all">, number> = { "7d": 7, "14d": 14, "30d": 30 };

/** Ismeretlen / hiányzó érték esetén 30 nap. */
export function parseRange(v: string | null): OverviewRange {
  return v === "7d" || v === "14d" || v === "30d" || v === "all" ? v : "30d";
}

/** Az időszak kezdete ISO-ban (az „összes" esetén null). */
export function rangeStart(r: OverviewRange): string | null {
  if (r === "all") return null;
  return new Date(Date.now() - RANGE_DAYS[r] * 24 * 3600 * 1000).toISOString();
}

export function roleLabelOf(m: { role: string; can_allocate?: boolean; canAllocate?: boolean }): OfficeRoleLabel {
  if (m.role === "owner") return "owner";
  return m.can_allocate || m.canAllocate ? "manager" : "member";
}

export function serviceLabel(svc: string | null | undefined): string {
  if (!svc) return "Egyéb";
  return SERVICE_LABELS[svc] ?? featureLabel(svc);
}

export type MemberStat = OfficeMember & {
  roleLabel: OfficeRoleLabel;
  spent: number;                      // felhasznált az időszakban
  works: number;                      // irodai munkák az időszakban
  services: Record<string, number>;   // modulonként felhasznált kredit
  everAllocated: boolean;             // kapott-e valaha keretet („elfogyott" vs „még nincs kerete")
};

const MAX_ROWS = 10000;

/** Vezetői összesítő: KPI-k + tagonkénti statisztika. */
export async function managerOverview(officeId: string, range: OverviewRange) {
  const admin = createAdminClient();
  const from = rangeStart(range);

  let spendQ = admin.from("office_ledger").select("member_id, amount, service_id, note")
    .eq("office_id", officeId).eq("kind", "spend").limit(MAX_ROWS);
  if (from) spendQ = spendQ.gte("created_at", from);

  let worksQ = admin.from("usage_history").select("user_id").eq("office_id", officeId).limit(MAX_ROWS);
  if (from) worksQ = worksQ.gte("created_at", from);

  const [members, money, { data: spends }, { data: works }, { data: allocs }] = await Promise.all([
    listMembers(officeId),
    officeFree(officeId),
    spendQ,
    worksQ,
    admin.from("office_ledger").select("member_id").eq("office_id", officeId).eq("kind", "allocate").gt("amount", 0).limit(MAX_ROWS),
  ]);

  const spentBy = new Map<string, { total: number; services: Record<string, number> }>();
  for (const r of spends ?? []) {
    if (r.note === "visszatérítve" || !r.member_id) continue;
    const id = r.member_id as string;
    const used = -(r.amount as number);
    const svc = (r.service_id as string) || "egyeb";
    const cur = spentBy.get(id) ?? { total: 0, services: {} };
    cur.total += used;
    cur.services[svc] = (cur.services[svc] ?? 0) + used;
    spentBy.set(id, cur);
  }
  const worksBy = new Map<string, number>();
  for (const w of works ?? []) worksBy.set(w.user_id as string, (worksBy.get(w.user_id as string) ?? 0) + 1);
  const allocated = new Set((allocs ?? []).map((a) => a.member_id as string));

  const stats: MemberStat[] = members.map((m) => ({
    ...m,
    roleLabel: roleLabelOf(m),
    spent: spentBy.get(m.userId)?.total ?? 0,
    works: worksBy.get(m.userId) ?? 0,
    services: spentBy.get(m.userId)?.services ?? {},
    everAllocated: allocated.has(m.userId),
  }));

  return {
    kpi: {
      balance: money.balance,
      allocated: money.allocated,
      free: money.free,
      spent: stats.reduce((s, m) => s + m.spent, 0),
      works: stats.reduce((s, m) => s + m.works, 0),
      members: stats.length,
      managers: stats.filter((m) => m.roleLabel !== "member").length,
    },
    members: stats,
  };
}

/** Kolléga-összesítő: a saját keret, saját kredit, saját felhasználás. */
export async function memberOverview(officeId: string, userId: string, range: OverviewRange) {
  const admin = createAdminClient();
  const from = rangeStart(range);

  let spendQ = admin.from("office_ledger").select("amount, note")
    .eq("office_id", officeId).eq("member_id", userId).eq("kind", "spend").limit(MAX_ROWS);
  if (from) spendQ = spendQ.gte("created_at", from);
  let worksQ = admin.from("usage_history").select("id", { count: "exact", head: true })
    .eq("office_id", officeId).eq("user_id", userId);
  if (from) worksQ = worksQ.gte("created_at", from);

  const [{ data: spends }, { count }, { data: wallet }] = await Promise.all([
    spendQ, worksQ,
    admin.from("wallets").select("balance").eq("user_id", userId).maybeSingle(),
  ]);
  const spent = (spends ?? []).filter((r) => r.note !== "visszatérítve").reduce((s, r) => s - (r.amount as number), 0);
  return { spent, works: count ?? 0, wallet: (wallet?.balance as number | undefined) ?? 0 };
}

export type WorkRow = {
  id: string;
  feature: string;
  moduleLabel: string;
  title: string;
  createdAt: string;
  credits: number;
  fileUrl?: string | null;
  folders?: string[];
};

/** Egy tag IRODAI munkái (cím, modul, dátum, kredit) — max 50, a legfrissebb elöl. */
export async function memberWorks(officeId: string, userId: string, range: OverviewRange): Promise<WorkRow[]> {
  const from = rangeStart(range);
  let q = createAdminClient().from("usage_history")
    .select("id, feature_used, input_data, created_at, credits_charged")
    .eq("office_id", officeId).eq("user_id", userId)
    .order("created_at", { ascending: false }).limit(50);
  if (from) q = q.gte("created_at", from);
  const { data } = await q;
  return (data ?? []).map((h) => ({
    id: h.id as string,
    feature: h.feature_used as string,
    moduleLabel: featureLabel(h.feature_used as string),
    title: activityTitle(h.feature_used as string, h.input_data as Record<string, unknown> | null),
    createdAt: h.created_at as string,
    credits: (h.credits_charged as number) ?? 0,
  }));
}

/** A SAJÁT munkáim (privát és irodai is) + melyik közös mappában vannak ebben az irodában. */
export async function myWorks(officeId: string, userId: string, range: OverviewRange): Promise<WorkRow[]> {
  const admin = createAdminClient();
  const from = rangeStart(range);
  let q = admin.from("usage_history")
    .select("id, feature_used, input_data, output_file_url, created_at, credits_charged")
    .eq("user_id", userId)
    .order("created_at", { ascending: false }).limit(50);
  if (from) q = q.gte("created_at", from);
  const { data } = await q;
  const rows = data ?? [];
  const ids = rows.map((r) => r.id as string);

  const folderNames = new Map<string, string[]>();
  if (ids.length) {
    const { data: folders } = await admin.from("office_folders").select("id, name").eq("office_id", officeId);
    const fname = new Map((folders ?? []).map((f) => [f.id as string, f.name as string]));
    if (fname.size) {
      const { data: items } = await admin.from("office_folder_items")
        .select("history_id, folder_id").in("history_id", ids).in("folder_id", [...fname.keys()]);
      for (const it of items ?? []) {
        const list = folderNames.get(it.history_id as string) ?? [];
        const n = fname.get(it.folder_id as string);
        if (n) list.push(n);
        folderNames.set(it.history_id as string, list);
      }
    }
  }

  return rows.map((h) => ({
    id: h.id as string,
    feature: h.feature_used as string,
    moduleLabel: featureLabel(h.feature_used as string),
    title: activityTitle(h.feature_used as string, h.input_data as Record<string, unknown> | null),
    createdAt: h.created_at as string,
    credits: (h.credits_charged as number) ?? 0,
    fileUrl: (h.output_file_url as string | null) ?? null,
    folders: folderNames.get(h.id as string) ?? [],
  }));
}

export type LedgerRow = {
  id: number;
  kind: "purchase" | "allocate" | "spend" | "adjust";
  amount: number;
  note: string | null;
  service: string | null;
  createdAt: string;
  actorName: string | null;
  memberName: string | null;
};

/**
 * Kredit-mozgások.
 *  • scope "office": az egész iroda pénzmozgásai (feltöltés, kiosztás, korrekció — a költések nélkül);
 *  • scope "member": egy tag saját keretének minden változása (a költéseivel együtt).
 */
export async function ledger(officeId: string, scope: { kind: "office" } | { kind: "member"; userId: string }, limit = 20): Promise<LedgerRow[]> {
  const admin = createAdminClient();
  let q = admin.from("office_ledger")
    .select("id, kind, amount, note, service_id, created_at, actor_id, member_id")
    .eq("office_id", officeId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));
  q = scope.kind === "office" ? q.in("kind", ["purchase", "allocate", "adjust"]) : q.eq("member_id", scope.userId);
  const { data } = await q;
  const rows = data ?? [];

  const ids = [...new Set(rows.flatMap((r) => [r.actor_id, r.member_id]).filter(Boolean) as string[])];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await admin.from("profiles").select("id, full_name").in("id", ids);
    for (const p of profiles ?? []) if (p.full_name) names.set(p.id as string, p.full_name as string);
    // Név nélküli tagoknál az e-mail cím (a taglistából).
    if (names.size < ids.length) {
      for (const m of await listMembers(officeId)) if (!names.has(m.userId) && m.email) names.set(m.userId, m.email);
    }
  }

  return rows.map((r) => ({
    id: r.id as number,
    kind: r.kind as LedgerRow["kind"],
    amount: r.amount as number,
    note: (r.note as string | null) ?? null,
    service: r.service_id ? serviceLabel(r.service_id as string) : null,
    createdAt: r.created_at as string,
    actorName: r.actor_id ? names.get(r.actor_id as string) ?? "Ismeretlen" : null,
    memberName: r.member_id ? names.get(r.member_id as string) ?? "Ismeretlen" : null,
  }));
}
