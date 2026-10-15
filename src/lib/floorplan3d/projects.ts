// Alaprajz-projektek mentése (CSAK szerveroldal) — 20261015123000_floorplan-projects.sql.
// Írás service role-lal (az RLS csak olvasást enged a tulajdonosnak); minden művelet a user_id-re szűr.
// Ha a migráció még nem futott le, a hívó egy érthető üzenetet kap, és a felület mentés nélkül is működik.
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FloorPlan } from "@/lib/floorplan3d/plan";

const BUCKET = "floorplans";
export const FLOORPLAN_MIGRATION_MSG = "A mentéshez futtasd le a 20261015123000_floorplan-projects.sql migrációt.";

const missing = (msg: string | undefined) => !!msg && /floorplan_projects|bucket/i.test(msg);
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

export type ProjectRow = {
  id: string; title: string; source_kind: "digital" | "hand"; style: string; source_mime: string | null;
  plan: FloorPlan; digitize_stats: Record<string, unknown> | null; hand_accepted: boolean; status: string; updated_at: string;
  approved_at: string | null; rebuild_rooms?: string[] | null; revision?: number; furnishing?: Record<string, unknown> | null;
};

export const REVISIONS_MIGRATION_MSG = "Az utólagos javításhoz futtasd le a 20261015233808_floorplan-revisions.sql migrációt.";
const revisionColumnsMissing = (msg: string | undefined) => !!msg && /approved_plan|rebuild_rooms|revision/i.test(msg);

/** Új projekt: az eredeti feltöltése + a digitalizált terv. */
export async function createProject(params: {
  userId: string; file: { bytes: Buffer; mime: string; name: string }; sourceKind: "digital" | "hand"; plan: FloorPlan; stats: unknown;
}): Promise<{ id: string } | { error: string }> {
  const admin = createAdminClient();
  const path = `${params.userId}/${randomUUID()}.${EXT[params.file.mime] ?? "bin"}`;
  const up = await admin.storage.from(BUCKET).upload(path, params.file.bytes, { contentType: params.file.mime, upsert: false });
  if (up.error) return { error: missing(up.error.message) || /not found/i.test(up.error.message) ? FLOORPLAN_MIGRATION_MSG : up.error.message };
  const title = params.file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 80) || "Alaprajz";
  const { data, error } = await admin.from("floorplan_projects").insert({
    user_id: params.userId, title, source_kind: params.sourceKind, source_path: path, source_mime: params.file.mime,
    plan: params.plan, digitize_stats: params.stats,
  }).select("id").single();
  if (error) return { error: missing(error.message) ? FLOORPLAN_MIGRATION_MSG : error.message };
  return { id: data.id as string };
}

/** Egy projekt betöltése (csak a sajátja) + aláírt link az eredetihez (1 óra). */
export async function loadProject(userId: string, id: string): Promise<{ project: ProjectRow; sourceUrl: string | null; images: Record<string, Record<string, string>> } | { error: string; status: number }> {
  const admin = createAdminClient();
  const base = "id, title, source_kind, style, source_mime, source_path, plan, digitize_stats, hand_accepted, status, updated_at, approved_at";
  const q = (cols: string) => admin.from("floorplan_projects").select(cols).eq("id", id).eq("user_id", userId).is("hidden_at", null).maybeSingle();
  // az utólagos javítás oszlopai (20261015233808_floorplan-revisions.sql) — ha még nincsenek, nélkülük töltünk be
  let { data, error } = await q(`${base}, rebuild_rooms, revision, furnishing`);
  if (error && /furnishing/.test(error.message)) ({ data, error } = await q(`${base}, rebuild_rooms, revision`));
  if (error && revisionColumnsMissing(error.message)) ({ data, error } = await q(base));
  if (error) return { error: missing(error.message) ? FLOORPLAN_MIGRATION_MSG : error.message, status: 500 };
  if (!data) return { error: "Az alaprajz nem található.", status: 404 };
  const row = data as unknown as ProjectRow & { source_path: string | null };
  let sourceUrl: string | null = null;
  if (row.source_path) {
    const s = await admin.storage.from(BUCKET).createSignedUrl(row.source_path, 3600);
    sourceUrl = s.data?.signedUrl ?? null;
  }
  const { source_path: _omit, ...project } = row;
  void _omit;
  const images = await signFurnishingImages((project as ProjectRow).furnishing as Record<string, Record<string, unknown>> | null);
  return { project, sourceUrl, images };
}

/** Javított terv mentése (csak a saját, még nem jóváhagyott tervé). */
export async function saveProject(userId: string, id: string, patch: { plan: FloorPlan; handAccepted: boolean }): Promise<string | null> {
  const { data, error } = await createAdminClient().from("floorplan_projects")
    .update({ plan: patch.plan, hand_accepted: patch.handAccepted, updated_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", userId).eq("status", "draft").is("hidden_at", null).select("id");
  if (error) return missing(error.message) ? FLOORPLAN_MIGRATION_MSG : error.message;
  return data && data.length ? null : "Ez az alaprajz már nem szerkeszthető (jóváhagyott vagy nem található).";
}

/** Jóváhagyás előtti állapot: a terv, a kézi-rajz nyilatkozat, a státusz és az előző jóváhagyott változat (a szerver újraellenőrzi). */
export async function projectForApproval(userId: string, id: string): Promise<{
  plan: FloorPlan; handAccepted: boolean; sourceKind: string; status: string;
  wasApproved: boolean; approvedPlan: FloorPlan | null; revision: number; revisionsReady: boolean;
} | { error: string; status: number }> {
  const admin = createAdminClient();
  const base = "plan, hand_accepted, source_kind, status, approved_at";
  const q = (cols: string) => admin.from("floorplan_projects").select(cols).eq("id", id).eq("user_id", userId).is("hidden_at", null).maybeSingle();
  let revisionsReady = true;
  let { data, error } = await q(`${base}, approved_plan, revision`);
  if (error && revisionColumnsMissing(error.message)) { revisionsReady = false; ({ data, error } = await q(base)); }
  if (error) return { error: missing(error.message) ? FLOORPLAN_MIGRATION_MSG : error.message, status: 500 };
  if (!data) return { error: "Az alaprajz nem található.", status: 404 };
  const d = data as unknown as Record<string, unknown>;
  return {
    plan: d.plan as FloorPlan, handAccepted: !!d.hand_accepted, sourceKind: d.source_kind as string, status: d.status as string,
    wasApproved: !!d.approved_at, approvedPlan: (d.approved_plan as FloorPlan | null) ?? null, revision: (d.revision as number | undefined) ?? 0, revisionsReady,
  };
}

/**
 * Lezárás: draft → approved (csak ha még draft — kétszeri kattintásnál sem von kétszer). Elmenti a jóváhagyott terv
 * pillanatképét és az újraépítendő helyiségeket. Igaz, ha most zártuk le.
 */
export async function markApproved(userId: string, id: string, snap: { plan: FloorPlan; rebuildRooms: string[]; revision: number } | null): Promise<boolean> {
  const now = new Date().toISOString();
  const { data } = await createAdminClient().from("floorplan_projects")
    .update({
      status: "approved", approved_at: now, updated_at: now,
      ...(snap ? { approved_plan: snap.plan, rebuild_rooms: snap.rebuildRooms, revision: snap.revision } : {}),
    })
    .eq("id", id).eq("user_id", userId).eq("status", "draft").select("id");
  return !!data?.length;
}

/** Utólagos javítás: a jóváhagyott (vagy kész) terv visszakerül szerkeszthetőre. A korábbi jóváhagyás nyoma (approved_at) megmarad. */
export async function reopenProject(userId: string, id: string): Promise<string | null> {
  const { data, error } = await createAdminClient().from("floorplan_projects")
    .update({ status: "draft", updated_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", userId).in("status", ["approved", "ready", "failed"]).not("approved_at", "is", null).is("hidden_at", null).select("id");
  if (error) return error.message;
  return data?.length ? null : "Ez az alaprajz nem nyitható vissza javításra (még nincs jóváhagyva, vagy épp készül).";
}

export const FURNISHING_MIGRATION_MSG = "A berendezés mentéséhez futtasd le a 20261016001943_floorplan-furnishing.sql migrációt.";

/** Egy helyiség berendezésének mentése (a többi helyiségé megmarad). Hiba esetén üzenet; a hívó ettől még visszaadhatja az eredményt. */
export async function saveFurnishing(userId: string, id: string, roomId: string, data: Record<string, unknown>): Promise<string | null> {
  const admin = createAdminClient();
  const { data: row, error } = await admin.from("floorplan_projects").select("furnishing").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) return /furnishing/.test(error.message) ? FURNISHING_MIGRATION_MSG : error.message;
  if (!row) return "Az alaprajz nem található.";
  // összefésülés: a helyiség meglévő adatai (pl. célkép) megmaradnak, a most küldött mezők felülírják a régieket
  const all = (row.furnishing as Record<string, Record<string, unknown>> | null) ?? {};
  const next = { ...all, [roomId]: { ...(all[roomId] ?? {}), ...data, updated_at: new Date().toISOString() } };
  const { error: e2 } = await admin.from("floorplan_projects").update({ furnishing: next }).eq("id", id).eq("user_id", userId);
  return e2 ? e2.message : null;
}

/** A projekt jóváhagyott terve + berendezése (a berendező végponthoz). */
export async function projectForFurnishing(userId: string, id: string): Promise<{ plan: FloorPlan; status: string; revision: number; furnishing: Record<string, unknown> | null } | { error: string; status: number }> {
  const admin = createAdminClient();
  const q = (cols: string) => admin.from("floorplan_projects").select(cols).eq("id", id).eq("user_id", userId).is("hidden_at", null).maybeSingle();
  let { data, error } = await q("plan, status, revision, furnishing");
  if (error && /furnishing|revision/.test(error.message)) ({ data, error } = await q("plan, status"));
  if (error) return { error: missing(error.message) ? FLOORPLAN_MIGRATION_MSG : error.message, status: 500 };
  if (!data) return { error: "Az alaprajz nem található.", status: 404 };
  const d = data as unknown as Record<string, unknown>;
  return { plan: d.plan as FloorPlan, status: d.status as string, revision: (d.revision as number | undefined) ?? 0, furnishing: (d.furnishing as Record<string, unknown> | undefined) ?? null };
}

/** Képfájl feltöltése a projekt mappájába (privát tárhely) — visszaadja az útvonalat. */
export async function uploadProjectImage(userId: string, projectId: string, name: string, bytes: Uint8Array, mime: string): Promise<{ path: string } | { error: string }> {
  const path = `${userId}/${projectId}/${name}`;
  const { error } = await createAdminClient().storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: true });
  return error ? { error: error.message } : { path };
}

/** Aláírt (1 órás) linkek a berendezés képeihez (célkép, berendezetlen fotó, kritikus-képek), helyiségenként. */
export async function signFurnishingImages(furnishing: Record<string, Record<string, unknown>> | null | undefined): Promise<Record<string, Record<string, string>>> {
  const out: Record<string, Record<string, string>> = {};
  if (!furnishing) return out;
  const admin = createAdminClient();
  for (const [roomId, f] of Object.entries(furnishing)) {
    const t = f?.target as Record<string, string> | undefined;
    for (const key of ["empty_path", "target_path"] as const) {
      if (!t?.[key]) continue;
      const s = await admin.storage.from(BUCKET).createSignedUrl(t[key], 3600);
      if (s.data?.signedUrl) (out[roomId] ??= {})[key.replace("_path", "")] = s.data.signedUrl;
    }
  }
  return out;
}

/** Egy projektfájl letöltése a privát tárhelyről (pl. a célkép a kritikusnak). */
export async function downloadProjectFile(path: string): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  const { data } = await createAdminClient().storage.from(BUCKET).download(path);
  if (!data) return null;
  return { bytes: new Uint8Array(await data.arrayBuffer()), mimeType: data.type || (path.endsWith(".png") ? "image/png" : "image/jpeg") };
}
