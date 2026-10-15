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
};

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
export async function loadProject(userId: string, id: string): Promise<{ project: ProjectRow; sourceUrl: string | null } | { error: string; status: number }> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("floorplan_projects")
    .select("id, title, source_kind, style, source_mime, source_path, plan, digitize_stats, hand_accepted, status, updated_at")
    .eq("id", id).eq("user_id", userId).is("hidden_at", null).maybeSingle();
  if (error) return { error: missing(error.message) ? FLOORPLAN_MIGRATION_MSG : error.message, status: 500 };
  if (!data) return { error: "Az alaprajz nem található.", status: 404 };
  let sourceUrl: string | null = null;
  if (data.source_path) {
    const s = await admin.storage.from(BUCKET).createSignedUrl(data.source_path as string, 3600);
    sourceUrl = s.data?.signedUrl ?? null;
  }
  const { source_path: _omit, ...project } = data as ProjectRow & { source_path: string | null };
  void _omit;
  return { project, sourceUrl };
}

/** Javított terv mentése (csak a saját, még nem jóváhagyott tervé). */
export async function saveProject(userId: string, id: string, patch: { plan: FloorPlan; handAccepted: boolean }): Promise<string | null> {
  const { data, error } = await createAdminClient().from("floorplan_projects")
    .update({ plan: patch.plan, hand_accepted: patch.handAccepted, updated_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", userId).eq("status", "draft").is("hidden_at", null).select("id");
  if (error) return missing(error.message) ? FLOORPLAN_MIGRATION_MSG : error.message;
  return data && data.length ? null : "Ez az alaprajz már nem szerkeszthető (jóváhagyott vagy nem található).";
}
