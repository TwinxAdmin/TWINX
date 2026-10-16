// Megosztható bejárás-link (4. lépés, F4b) — CSAK szerveroldal. 20261016084305_floorplan-shares.sql.
// A token kitalálhatatlan (24 véletlen bájt → 32 karakter base64url). Projektenként egyszerre egy élő (nem visszavont) link.
// A nyilvános oldal a JÓVÁHAGYOTT tervet mutatja: ha a projektet épp utólagos javításra visszanyitották (draft), a legutóbbi
// jóváhagyott pillanatképet (approved_plan) — a link alatt nem változik félkész terv. Semmit nem törlünk (visszavonás = revoked_at).
import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FloorPlan } from "@/lib/floorplan3d/plan";
import type { FurnitureItem } from "@/lib/floorplan3d/furniture";

export const SHARES_MIGRATION_MSG = "A megosztható linkhez futtasd le a 20261016084305_floorplan-shares.sql migrációt.";
const missing = (msg: string | undefined) => !!msg && /floorplan_shares|floorplan_share_viewed/i.test(msg);

const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;
const DAY = 86_400_000;

export type ShareInfo = { token: string; expiresAt: string; createdAt: string; views: number; lastViewedAt: string | null; extendCount: number; expired: boolean };

type Row = { id: string; token: string; expires_at: string; created_at: string; views: number; last_viewed_at: string | null; extend_count: number };
const toInfo = (r: Row): ShareInfo => ({
  token: r.token, expiresAt: r.expires_at, createdAt: r.created_at, views: r.views, lastViewedAt: r.last_viewed_at,
  extendCount: r.extend_count, expired: new Date(r.expires_at).getTime() <= Date.now(),
});
const COLS = "id, token, expires_at, created_at, views, last_viewed_at, extend_count";

/** A projekt saját-e, és jóvá volt-e már hagyva (link csak jóváhagyott tervhez készülhet). */
async function ownedApproved(userId: string, projectId: string): Promise<string | null> {
  const { data } = await createAdminClient().from("floorplan_projects").select("approved_at")
    .eq("id", projectId).eq("user_id", userId).is("hidden_at", null).maybeSingle();
  if (!data) return "Az alaprajz nem található.";
  return data.approved_at ? null : "Link csak jóváhagyott tervhez készülhet.";
}

/** Az élő (nem visszavont) link, ha van — lejártan is (azt meg lehet hosszabbítani). */
export async function activeShare(userId: string, projectId: string): Promise<{ share: ShareInfo | null } | { error: string }> {
  const { data, error } = await createAdminClient().from("floorplan_shares").select(COLS)
    .eq("project_id", projectId).eq("user_id", userId).is("revoked_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return { error: missing(error.message) ? SHARES_MIGRATION_MSG : error.message };
  return { share: data ? toInfo(data as Row) : null };
}

/** Új link (ha már van élő, azt adja vissza — kétszeri kattintásra sem lesz két link). */
export async function createShare(userId: string, projectId: string, days: number): Promise<{ share: ShareInfo; created: boolean } | { error: string; status: number }> {
  const bad = await ownedApproved(userId, projectId);
  if (bad) return { error: bad, status: bad.includes("nem található") ? 404 : 422 };
  const cur = await activeShare(userId, projectId);
  if ("error" in cur) return { error: cur.error, status: 500 };
  if (cur.share) return { share: cur.share, created: false };
  const { data, error } = await createAdminClient().from("floorplan_shares").insert({
    project_id: projectId, user_id: userId, token: randomBytes(24).toString("base64url"),
    expires_at: new Date(Date.now() + days * DAY).toISOString(),
  }).select(COLS).single();
  if (error) return { error: missing(error.message) ? SHARES_MIGRATION_MSG : error.message, status: 500 };
  return { share: toInfo(data as Row), created: true };
}

/** Meghosszabbítás: a lejárat (vagy ha már lejárt, a mostani pillanat) + days. A kreditet a hívó vonja le előtte. */
export async function extendShare(userId: string, projectId: string, days: number): Promise<{ share: ShareInfo } | { error: string; status: number }> {
  const cur = await activeShare(userId, projectId);
  if ("error" in cur) return { error: cur.error, status: 500 };
  if (!cur.share) return { error: "Nincs meghosszabbítható link — hozz létre újat.", status: 404 };
  const from = Math.max(Date.now(), new Date(cur.share.expiresAt).getTime());
  const { data, error } = await createAdminClient().from("floorplan_shares")
    .update({ expires_at: new Date(from + days * DAY).toISOString(), extend_count: cur.share.extendCount + 1 })
    .eq("token", cur.share.token).eq("user_id", userId).is("revoked_at", null).eq("expires_at", cur.share.expiresAt) // párhuzamos kattintásnál csak egy fut le
    .select(COLS);
  if (error) return { error: error.message, status: 500 };
  if (!data?.length) return { error: "A link közben megváltozott — frissítsd az oldalt.", status: 409 };
  return { share: toInfo(data[0] as Row) };
}

/** Visszavonás: a link azonnal megszűnik (a sor megmarad). */
export async function revokeShare(userId: string, projectId: string): Promise<string | null> {
  const { error } = await createAdminClient().from("floorplan_shares").update({ revoked_at: new Date().toISOString() })
    .eq("project_id", projectId).eq("user_id", userId).is("revoked_at", null);
  return error ? (missing(error.message) ? SHARES_MIGRATION_MSG : error.message) : null;
}

export type PublicShare =
  | { state: "ok"; title: string; plan: FloorPlan; furnishing: Record<string, { items?: FurnitureItem[] }> | null; expiresAt: string }
  | { state: "missing" | "expired" | "revoked" };

/** A nyilvános oldalnak: token → jóváhagyott terv + berendezés. countView: a megnyitás számlálása (a lap egyszer hívja). */
export async function publicShare(token: string, countView: boolean): Promise<PublicShare> {
  if (!TOKEN_RE.test(token)) return { state: "missing" };
  const admin = createAdminClient();
  const { data: s } = await admin.from("floorplan_shares").select("project_id, expires_at, revoked_at").eq("token", token).maybeSingle();
  if (!s) return { state: "missing" };
  if (s.revoked_at) return { state: "revoked" };
  if (new Date(s.expires_at).getTime() <= Date.now()) return { state: "expired" };
  const { data: p } = await admin.from("floorplan_projects").select("title, plan, status, approved_plan, furnishing, hidden_at")
    .eq("id", s.project_id).maybeSingle();
  if (!p || p.hidden_at) return { state: "missing" };
  const plan = (p.status === "draft" ? p.approved_plan : p.plan) as FloorPlan | null;
  if (!plan?.rooms?.length) return { state: "missing" };
  if (countView) await admin.rpc("floorplan_share_viewed", { p_token: token });
  return { state: "ok", title: (p.title as string) || "Lakás", plan, furnishing: (p.furnishing as Record<string, { items?: FurnitureItem[] }> | null) ?? null, expiresAt: s.expires_at as string };
}
