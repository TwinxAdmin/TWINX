// Korábbi munkák — LOMTÁR és VÉGLEGES TÖRLÉS (CSAK szerveroldal, service_role).
// Migráció: 20261020120000_works-trash.sql.
//
//   • Lomtárba helyezés = usage_history.hidden_at = most (a modul-könyvtárak — video_jobs, ad_checks — is követik).
//   • Visszaállítás = hidden_at = null.
//   • Végleges törlés: a munka MINDEN fájlja (kimenet, eredeti képek, köztes képkockák, régebbi PDF-verziók,
//     előnézetek) törlődik a Storage-ból, majd az adatbázis-sorok. Egy fájlt CSAK akkor törlünk, ha másik munka
//     már nem hivatkozik rá (irodai munkaátadáskor a másolat ugyanazt a fájlt használja) — work_paths_in_use().
//   • Biztonság: csak a munka TULAJDONOSÁNAK saját mappáiban lévő fájl törölhető (`…/<user_id>/…` az útvonalban),
//     így közös anyag (zene, márkaarculat, más felhasználó fájlja) soha nem kerülhet a törlendők közé.
//   • Jogosultság: a saját munkát mindenki; irodai munkát az iroda létrehozója és a vezetők (can_allocate) is.
//   • A kredit törléskor nem jár vissza.
import { createAdminClient } from "@/lib/supabase/admin";
import { getMembershipIn } from "@/lib/office-server";
import { activityTitle } from "@/lib/activity";

export const TRASH_MIGRATION = "20261020120000_works-trash.sql";
/** Ennyi nap után törlődik véglegesen a lomtárból (konfiguráció: WORKS_TRASH_DAYS). */
export const TRASH_DAYS = Math.max(1, Math.round(Number(process.env.WORKS_TRASH_DAYS || 30)));

const BUCKET = "reports";
const PUBLIC_MARK = `/storage/v1/object/public/${BUCKET}/`;

type Admin = ReturnType<typeof createAdminClient>;
export type WorkRow = {
  id: string; user_id: string; office_id: string | null; feature_used: string;
  input_data: Record<string, unknown> | null; output_file_url: string | null; hidden_at: string | null; created_at: string;
};
const ROW_COLS = "id, user_id, office_id, feature_used, input_data, output_file_url, hidden_at, created_at";

export type ItemResult = { id: string; ok: boolean; error?: string };
export type PurgeSummary = { results: ItemResult[]; filesDeleted: number; filesKept: number; bytesFreed: number };

// ---------------------------------------------------------------------------
// Segédek
// ---------------------------------------------------------------------------
/** Nyilvános Storage-URL → objektum-útvonal a reports bucketben (más URL → null). */
export function storagePathOf(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const i = url.indexOf(PUBLIC_MARK);
  if (i < 0) return null;
  try { return decodeURIComponent(url.slice(i + PUBLIC_MARK.length).split("?")[0]); } catch { return null; }
}

/** Egy tetszőleges JSON-érték összes reports-URL-je (mélységi bejárás). */
function collectUrls(value: unknown, out: Set<string>, depth = 0) {
  if (depth > 8 || value == null) return;
  if (typeof value === "string") { if (value.includes(PUBLIC_MARK)) out.add(value); return; }
  if (Array.isArray(value)) { for (const v of value) collectUrls(v, out, depth + 1); return; }
  if (typeof value === "object") for (const v of Object.values(value as Record<string, unknown>)) collectUrls(v, out, depth + 1);
}

async function loadRows(admin: Admin, ids: string[]): Promise<Map<string, WorkRow>> {
  const { data, error } = await admin.from("usage_history").select(ROW_COLS).in("id", ids);
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as WorkRow[]).map((r) => [r.id, r]));
}

/** Kezelheti-e a felhasználó ezt a munkát (lomtár / visszaállítás / végleges törlés)? */
export async function canManageWork(userId: string, row: Pick<WorkRow, "user_id" | "office_id">): Promise<boolean> {
  if (row.user_id === userId) return true;
  if (!row.office_id) return false;
  const m = await getMembershipIn(userId, row.office_id);
  return !!m && (m.role === "owner" || m.can_allocate);
}

/** A modul-könyvtárak rejtése kövesse a munkát (videók, hirdetés-ellenőrzések). */
async function mirrorHidden(admin: Admin, row: WorkRow, hiddenAt: string | null) {
  const url = row.output_file_url;
  if (!url) return;
  if (row.feature_used === "video") await admin.from("video_jobs").update({ hidden_at: hiddenAt }).eq("output_url", url).eq("user_id", row.user_id);
  if (row.feature_used === "ad-check") await admin.from("ad_checks").update({ hidden_at: hiddenAt }).eq("pdf_url", url).eq("user_id", row.user_id);
}

// ---------------------------------------------------------------------------
// Lomtár / visszaállítás
// ---------------------------------------------------------------------------
export async function setTrashed(actorId: string, ids: string[], trashed: boolean): Promise<ItemResult[]> {
  const admin = createAdminClient();
  const rows = await loadRows(admin, ids);
  const at = trashed ? new Date().toISOString() : null;
  const results: ItemResult[] = [];
  for (const id of ids) {
    const row = rows.get(id);
    try {
      if (!row) throw new Error("A munka nem található.");
      if (!(await canManageWork(actorId, row))) throw new Error("Ehhez a munkához nincs jogosultságod.");
      const { error } = await admin.from("usage_history").update({ hidden_at: at }).eq("id", id);
      if (error) throw new Error(/hidden_at/.test(error.message) ? "Futtasd le a 20261008121638_usage-history-hidden.sql migrációt." : error.message);
      await mirrorHidden(admin, row, at);
      results.push({ id, ok: true });
    } catch (e) {
      results.push({ id, ok: false, error: (e as Error).message });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Végleges törlés
// ---------------------------------------------------------------------------
type Plan = { urls: Set<string>; prefixes: Set<string>; cleanups: Array<() => PromiseLike<unknown>> };

/** Egy munka összes fájlja és a hozzá tartozó modul-sorok (amiket a munkával együtt törölni kell). */
async function planWork(admin: Admin, row: WorkRow): Promise<Plan> {
  const urls = new Set<string>();
  const prefixes = new Set<string>();
  const cleanups: Plan["cleanups"] = [];
  const uid = row.user_id;
  if (row.output_file_url) urls.add(row.output_file_url);
  collectUrls(row.input_data, urls);

  // Korábbi verziók (értékbecslés: régebbi PDF-ek) — a sorok a munkával együtt törlődnek (cascade).
  const { data: versions } = await admin.from("work_versions").select("output_file_url").eq("history_id", row.id);
  for (const v of versions ?? []) if (v.output_file_url) urls.add(String(v.output_file_url));

  // Értékbecslés futási sorai.
  const { data: vjobs } = await admin.from("valuation_jobs").select("*").eq("history_id", row.id);
  if (vjobs?.length) { collectUrls(vjobs, urls); cleanups.push(() => admin.from("valuation_jobs").delete().eq("history_id", row.id)); }

  const out = row.output_file_url;
  if (row.feature_used === "video" && out) {
    const { data: jobs } = await admin.from("video_jobs").select("*").eq("user_id", uid).eq("output_url", out);
    for (const j of jobs ?? []) {
      collectUrls(j, urls);
      // Forrásképek és köztes képkockák (a jobhoz tartozó teljes mappa).
      prefixes.add(`video-src/${uid}/${j.id}/`);
      prefixes.add(`video-frames/${uid}/${j.id}/`);
    }
    if (jobs?.length) cleanups.push(() => admin.from("video_jobs").delete().in("id", jobs.map((j) => j.id)));
  }
  if (row.feature_used === "ad-check" && out) {
    const { data: checks } = await admin.from("ad_checks").select("id").eq("user_id", uid).eq("pdf_url", out);
    if (checks?.length) cleanups.push(() => admin.from("ad_checks").delete().in("id", checks.map((c) => c.id)));
  }
  if (row.feature_used === "land-valuation" && out) cleanups.push(() => admin.from("land_jobs").delete().eq("user_id", uid).eq("output_url", out));
  if (row.feature_used === "professional_search" && out) cleanups.push(() => admin.from("professional_searches").delete().eq("user_id", uid).eq("pdf_url", out));
  if (row.feature_used === "supplier_search" && out) cleanups.push(() => admin.from("supplier_searches").delete().eq("user_id", uid).eq("pdf_url", out));

  if (row.feature_used === "image_enhance") {
    // A képjavító job tárolja az EREDETI képeket is (a usage_history csak a javítottakat).
    const enhanced = new Set(urls);
    const { data: jobs } = await admin.from("image_enhance_jobs").select("id, items").eq("user_id", uid).limit(1000);
    for (const j of jobs ?? []) {
      const items = (Array.isArray(j.items) ? j.items : []) as Array<{ original?: string; enhanced?: string }>;
      const hit = items.filter((it) => it.enhanced && enhanced.has(it.enhanced));
      if (!hit.length) continue;
      for (const it of hit) { if (it.original) urls.add(it.original); if (it.enhanced) urls.add(it.enhanced); }
      const rest = items.filter((it) => !(it.enhanced && enhanced.has(it.enhanced)));
      cleanups.push(() => (rest.length
        ? admin.from("image_enhance_jobs").update({ items: rest }).eq("id", j.id)
        : admin.from("image_enhance_jobs").delete().eq("id", j.id)));
    }
    // Elutasított / újragenerált változatok.
    const list = [...urls];
    if (list.length) {
      const { data: rej } = await admin.from("enhance_rejections").select("id, original_url, rejected_url, replacement_url")
        .eq("user_id", uid).or(`replacement_url.in.(${list.map((u) => `"${u}"`).join(",")}),original_url.in.(${list.map((u) => `"${u}"`).join(",")})`);
      for (const r of rej ?? []) { collectUrls(r, urls); }
      if (rej?.length) cleanups.push(() => admin.from("enhance_rejections").delete().in("id", rej.map((r) => r.id)));
    }
  }

  // URL-kulcsos hivatkozások (kedvencek, eszköz-mappák, egyedi nevek) — a fájllal együtt szűnnek meg.
  const all = [...urls];
  if (all.length) {
    cleanups.push(() => admin.from("image_enhance_favorites").delete().eq("user_id", uid).in("enhanced", all));
    cleanups.push(() => admin.from("asset_folder_items").delete().eq("user_id", uid).in("url", all));
    cleanups.push(() => admin.from("asset_item_names").delete().eq("user_id", uid).in("url", all));
  }
  return { urls, prefixes, cleanups };
}

/** Véglegesen töröl egy munkát. A hívó felel a jogosultságért (purgeWorks / purgeExpired ellenőriz). */
async function purgeOne(admin: Admin, row: WorkRow, actorId: string | null, reason: "manual" | "auto") {
  const plan = await planWork(admin, row);
  // Csak a tulajdonos saját mappáiban lévő fájlok (biztonsági határ).
  const own = (p: string) => p.split("/").includes(row.user_id);
  const paths = [...new Set([...plan.urls].map(storagePathOf).filter((p): p is string => !!p && own(p)))];
  const prefixes = [...plan.prefixes].filter(own);

  // Másik munka is hivatkozik rá? → marad.
  let inUse = new Set<string>();
  if (paths.length) {
    const { data, error } = await admin.rpc("work_paths_in_use", { p_paths: paths, p_exclude: [row.id] });
    if (error) throw new Error(/work_paths_in_use/.test(error.message) ? `Futtasd le a ${TRASH_MIGRATION} migrációt.` : error.message);
    inUse = new Set(((data ?? []) as Array<{ path: string }>).map((r) => r.path));
  }
  const toDelete = paths.filter((p) => !inUse.has(p));

  // Pontos fájllista + méret (az előtagok alatti köztes fájlokkal együtt).
  const { data: sized, error: sizeErr } = await admin.rpc("work_storage_sizes", { p_bucket: BUCKET, p_paths: toDelete, p_prefixes: prefixes });
  if (sizeErr) throw new Error(/work_storage_sizes/.test(sizeErr.message) ? `Futtasd le a ${TRASH_MIGRATION} migrációt.` : sizeErr.message);
  const objects = (sized ?? []) as Array<{ name: string; size: number }>;
  const names = objects.map((o) => o.name);
  for (let i = 0; i < names.length; i += 100) {
    const { error } = await admin.storage.from(BUCKET).remove(names.slice(i, i + 100));
    if (error) throw new Error(`A fájlok törlése nem sikerült: ${error.message}`);
  }

  // Modul-sorok, majd maga a munka (a mappatagságok, verziók, zárak cascade-del mennek).
  for (const c of plan.cleanups) await c();
  const { error: delErr } = await admin.from("usage_history").delete().eq("id", row.id);
  if (delErr) throw new Error(delErr.message);

  const bytes = objects.reduce((s, o) => s + Number(o.size || 0), 0);
  await admin.from("work_purge_log").insert({
    history_id: row.id, owner_id: row.user_id, deleted_by: actorId, feature: row.feature_used,
    title: activityTitle(row.feature_used, row.input_data, row.created_at).slice(0, 200), reason,
    files_deleted: names.length, files_kept: inUse.size, bytes_freed: bytes,
  });
  return { filesDeleted: names.length, filesKept: inUse.size, bytesFreed: bytes };
}

/** Végleges törlés felhasználói kérésre — elemenként jogosultság-ellenőrzéssel; csak lomtárban lévő munka. */
export async function purgeWorks(actorId: string, ids: string[]): Promise<PurgeSummary> {
  const admin = createAdminClient();
  const rows = await loadRows(admin, ids);
  const sum: PurgeSummary = { results: [], filesDeleted: 0, filesKept: 0, bytesFreed: 0 };
  for (const id of ids) {
    const row = rows.get(id);
    try {
      if (!row) throw new Error("A munka nem található.");
      if (!(await canManageWork(actorId, row))) throw new Error("Ehhez a munkához nincs jogosultságod.");
      if (!row.hidden_at) throw new Error("Véglegesen csak a lomtárban lévő munka törölhető.");
      const r = await purgeOne(admin, row, actorId, "manual");
      sum.filesDeleted += r.filesDeleted; sum.filesKept += r.filesKept; sum.bytesFreed += r.bytesFreed;
      sum.results.push({ id, ok: true });
    } catch (e) {
      sum.results.push({ id, ok: false, error: (e as Error).message });
    }
  }
  return sum;
}

/**
 * A LEJÁRT lomtár-elemek automatikus végleges törlése (napi ütemezett futás).
 * @param olderThanMs a lomtárba helyezés óta eltelt idő (alap: TRASH_DAYS nap) — teszthez rövidíthető
 * @param onlyUserId  csak ennek a felhasználónak a munkái (teszthez)
 */
export async function purgeExpired(opts: { olderThanMs?: number; onlyUserId?: string; onlyIds?: string[]; limit?: number } = {}): Promise<PurgeSummary & { scanned: number }> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - (opts.olderThanMs ?? TRASH_DAYS * 86_400_000)).toISOString();
  let q = admin.from("usage_history").select(ROW_COLS).not("hidden_at", "is", null).lt("hidden_at", cutoff)
    .order("hidden_at", { ascending: true }).limit(opts.limit ?? 200);
  if (opts.onlyUserId) q = q.eq("user_id", opts.onlyUserId);
  if (opts.onlyIds) q = q.in("id", opts.onlyIds);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as WorkRow[];
  const sum: PurgeSummary & { scanned: number } = { results: [], filesDeleted: 0, filesKept: 0, bytesFreed: 0, scanned: rows.length };
  for (const row of rows) {
    try {
      const r = await purgeOne(admin, row, null, "auto");
      sum.filesDeleted += r.filesDeleted; sum.filesKept += r.filesKept; sum.bytesFreed += r.bytesFreed;
      sum.results.push({ id: row.id, ok: true });
    } catch (e) {
      sum.results.push({ id: row.id, ok: false, error: (e as Error).message });
    }
  }
  return sum;
}
