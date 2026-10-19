// Videósablonok elérhetősége (Admin → Videólabor „Elérhető mindenkinek" pipa) — CSAK szerveroldal.
// Tábla: video_template_availability (20261020093000_video-template-availability.sql).
//   • enabled = true → mindenki látja és választhatja; false vagy NINCS SOR → rejtett (új sablon alapból rejtett).
//   • Az admin (valódi szerepkör, nem „így látja a partner" előnézetben) a rejtettet is látja és tesztelheti.
//   • A rejtés a futó rendereket nem érinti — csak az új indítást tiltja (a kreditlevonás ELŐTT).
// Tartalék: amíg a migráció nem futott le, minden sablon elérhető (a felület nem törik el).
import { createAdminClient } from "@/lib/supabase/admin";
import { ENGINE_TEMPLATES, engineFamilyOf } from "@/lib/video-engine/templates/index";

export const AVAILABILITY_MIGRATION = "20261020093000_video-template-availability.sql";
export const TEMPLATE_UNAVAILABLE_MESSAGE = "Ez a sablon jelenleg nem elérhető, válassz másikat.";

export type AvailabilityRow = { template_id: string; enabled: boolean; updated_at: string | null; updated_by: string | null };

/** A tábla sorai; migrated=false, ha a tábla még nem létezik. */
export async function readAvailability(): Promise<{ migrated: boolean; rows: AvailabilityRow[] }> {
  const { data, error } = await createAdminClient()
    .from("video_template_availability")
    .select("template_id, enabled, updated_at, updated_by");
  if (error) return { migrated: false, rows: [] };
  return { migrated: true, rows: (data ?? []) as AvailabilityRow[] };
}

/** A rejtett sablon-családok azonosítói (migráció előtt: üres — semmi sem rejtett). */
export async function hiddenTemplateIds(): Promise<{ migrated: boolean; hidden: string[] }> {
  const { migrated, rows } = await readAvailability();
  if (!migrated) return { migrated, hidden: [] };
  const on = new Set(rows.filter((r) => r.enabled).map((r) => r.template_id));
  return { migrated, hidden: ENGINE_TEMPLATES.map((t) => t.id).filter((id) => !on.has(id)) };
}

/** Indítható-e a sablon (vagy színváltozata) ezzel a megjelenítési szerepkörrel? Az admin mindig indíthatja. */
export async function isTemplateStartable(engineTemplateId: string, viewRole: string): Promise<boolean> {
  if (viewRole === "admin") return true;
  const { hidden } = await hiddenTemplateIds();
  return !hidden.includes(engineFamilyOf(engineTemplateId));
}

/** Ki- / bekapcsolás + napló. */
export async function setTemplateEnabled(templateId: string, enabled: boolean, userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("video_template_availability")
    .upsert({ template_id: templateId, enabled, updated_at: now, updated_by: userId }, { onConflict: "template_id" });
  if (error) {
    return { ok: false, error: /video_template_availability/.test(error.message) || error.code === "42P01" || error.code === "PGRST205"
      ? `Futtasd le a ${AVAILABILITY_MIGRATION} migrációt a Supabase SQL Editorban.`
      : error.message };
  }
  await admin.from("video_template_availability_log").insert({ template_id: templateId, enabled, changed_by: userId, changed_at: now });
  return { ok: true };
}
