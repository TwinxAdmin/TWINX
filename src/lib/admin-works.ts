// Admin → Felhasználók és modulok → „Munkák" fül (design/admin-munkak-latvanyterv.html).
// Az ügyfelek KÉSZ anyagai egy helyen: mit készítenek a modulokkal. CSAK admin (az API ellenőrzi).
//   • csak valódi ügyfelek (profiles.role = 'user') — az admin és a sales próbái nem látszanak
//   • a felhasználó által lomtárba tett munkák (usage_history.hidden_at) sem
//   • szűrés: időszak, modulcsoport, felhasználó (név / e-mail); lapozás a létrehozás ideje szerint (48-asával)
// Forrás: usage_history (minden modul ide naplóz, a videó és a hirdetés-ellenőrzés is). Nincs séma-változás.
import { createAdminClient } from "@/lib/supabase/admin";
import { activityTitle, featureLabel } from "@/lib/activity";
import { GROUPED_FEATURES, groupOf, WORK_GROUPS, type AdminWork, type AdminWorksResult, type WorkGroupKey, type WorksRange } from "@/lib/admin-works-shared";

export type { AdminWork, AdminWorksResult, WorkGroupKey, WorksRange };

export const ADMIN_WORKS_PAGE = 48;

function since(range: WorksRange): string | null {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 0;
  return days ? new Date(Date.now() - days * 86_400_000).toISOString() : null;
}

/** Ügyfelek (role = 'user') neve és e-mail-címe + a NEM ügyfél fiókok (admin, sales…) listája.
 *  Az e-mail az auth-ból jön (a profilban nincs). */
async function people(): Promise<{ customers: Map<string, { name: string; email: string }>; staff: string[] }> {
  const admin = createAdminClient();
  const [{ data: profiles }, list] = await Promise.all([
    admin.from("profiles").select("id, full_name, role"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  const emails = new Map<string, string>();
  for (const u of list.data?.users ?? []) emails.set(u.id, u.email ?? "");
  const customers = new Map<string, { name: string; email: string }>();
  const staff: string[] = [];
  for (const p of profiles ?? []) {
    const id = String(p.id);
    if (p.role !== "user") { staff.push(id); continue; }
    customers.set(id, { name: String(p.full_name ?? "").trim(), email: emails.get(id) ?? "" });
  }
  return { customers, staff };
}

export async function listAdminWorks(opts: {
  range: WorksRange;
  group: WorkGroupKey | "all";
  q: string;
  before: string | null;
}): Promise<AdminWorksResult> {
  const admin = createAdminClient();
  const { customers, staff } = await people();

  // Felhasználó-szűrés: név vagy e-mail részlete (kis- és nagybetű mindegy).
  const q = opts.q.trim().toLowerCase();
  const only = q
    ? [...customers.keys()].filter((id) => { const p = customers.get(id)!; return p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q); })
    : null;
  const empty: AdminWorksResult = { works: [], next: null, counts: { total: 0, users: 0, groups: { enhance: 0, flyer: 0, valuation: 0, video: 0, visualization: 0, other: 0 } } };
  if (only && only.length === 0) return empty;

  const from = since(opts.range);

  // 1) Darabszámok a sávhoz (csak két rövid oszlop; a lista szűrése nem hat rá, csak az időszak és a felhasználó).
  // Felhasználó-szűrés a lekérdezésben: név szerint (in) VAGY — szűrés nélkül — a nem ügyfél fiókok kizárása
  // (not in). Így az URL rövid marad sok ügyfélnél is (a staff-lista kicsi).
  const notStaff = `(${staff.join(",")})`;
  let countQ = admin.from("usage_history").select("feature_used, user_id").is("hidden_at", null).limit(50_000);
  if (only) countQ = countQ.in("user_id", only);
  else if (staff.length) countQ = countQ.not("user_id", "in", notStaff);
  if (from) countQ = countQ.gte("created_at", from);
  const { data: countRows, error: countErr } = await countQ;
  if (countErr) throw new Error(countErr.message);
  const counts = { ...empty.counts, groups: { ...empty.counts.groups } };
  const users = new Set<string>();
  for (const r of countRows ?? []) {
    if (!customers.has(String(r.user_id))) continue; // profil nélküli (törölt) fiók
    counts.groups[groupOf(String(r.feature_used))]++;
    users.add(String(r.user_id));
  }
  counts.total = Object.values(counts.groups).reduce((a, b) => a + b, 0);
  counts.users = users.size;

  // 2) Az aktuális oldal.
  let listQ = admin.from("usage_history")
    .select("id, user_id, feature_used, input_data, output_file_url, created_at")
    .is("hidden_at", null)
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .limit(ADMIN_WORKS_PAGE + 1);
  if (only) listQ = listQ.in("user_id", only);
  else if (staff.length) listQ = listQ.not("user_id", "in", notStaff);
  if (from) listQ = listQ.gte("created_at", from);
  if (opts.before) listQ = listQ.lt("created_at", opts.before);
  if (opts.group === "other") {
    listQ = listQ.not("feature_used", "in", `(${[...GROUPED_FEATURES].map((f) => `"${f}"`).join(",")})`);
  } else if (opts.group !== "all") {
    const g = WORK_GROUPS.find((x) => x.key === opts.group);
    if (g) listQ = listQ.in("feature_used", [...g.features]);
  }
  const { data: rows, error } = await listQ;
  if (error) throw new Error(error.message);

  const page = (rows ?? []).slice(0, ADMIN_WORKS_PAGE);
  const works: AdminWork[] = page.filter((r) => customers.has(String(r.user_id))).map((r) => {
    const feature = String(r.feature_used);
    const p = customers.get(String(r.user_id));
    return {
      id: String(r.id),
      userId: String(r.user_id),
      userName: p?.name || p?.email || "Ismeretlen",
      userEmail: p?.email ?? "",
      feature,
      group: groupOf(feature),
      typeLabel: featureLabel(feature),
      title: activityTitle(feature, r.input_data as Record<string, unknown> | null, r.created_at as string),
      url: (r.output_file_url as string | null) ?? null,
      createdAt: String(r.created_at),
    };
  });
  const next = (rows?.length ?? 0) > ADMIN_WORKS_PAGE ? String(page[page.length - 1].created_at) : null;
  return { works, next, counts };
}
