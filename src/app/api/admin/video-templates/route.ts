// /api/admin/video-templates — VIDEÓSABLONOK KI-BE KAPCSOLÁSA (CSAK admin).
//   GET  → minden sablon-család + „Elérhető mindenkinek" állapot + ki / mikor kapcsolta utoljára + napló
//   POST { templateId, enabled } → azonnal érvényes, naplózva (video_template_availability_log)
// A Videólabor „Sablonok elérhetősége" kártyája használja.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffRole } from "@/lib/staff";
import { ENGINE_TEMPLATES, engineFamilies } from "@/lib/video-engine/templates/index";
import { readAvailability, setTemplateEnabled, AVAILABILITY_MIGRATION } from "@/lib/video-template-availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const supabase = await createClient();
  const staff = await getStaffRole(supabase);
  return staff && staff.role === "admin" ? staff : null;
}

async function payload() {
  const admin = createAdminClient();
  const { migrated, rows } = await readAvailability();
  const { data: logRows } = migrated
    ? await admin.from("video_template_availability_log").select("template_id, enabled, changed_by, changed_at")
        .order("changed_at", { ascending: false }).limit(30)
    : { data: [] as Array<{ template_id: string; enabled: boolean; changed_by: string | null; changed_at: string }> };
  // Nevek a naplóhoz (profilnév, tartalék: e-mail).
  const ids = [...new Set([...rows.map((r) => r.updated_by), ...(logRows ?? []).map((l) => l.changed_by)].filter(Boolean) as string[])];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", ids);
    for (const p of profs ?? []) if (p.full_name) names.set(p.id as string, String(p.full_name));
    for (const id of ids.filter((x) => !names.has(x))) {
      const { data } = await admin.auth.admin.getUserById(id);
      if (data?.user?.email) names.set(id, data.user.email);
    }
  }
  const byId = new Map(rows.map((r) => [r.template_id, r]));
  const familyName = new Map(engineFamilies().map((f) => [f.templateId, f]));
  return {
    migrated,
    migration: AVAILABILITY_MIGRATION,
    templates: ENGINE_TEMPLATES.map((t) => {
      const r = byId.get(t.id);
      const f = familyName.get(t.id);
      return {
        templateId: t.id,
        name: f?.name ?? t.name,
        tagline: f?.tagline ?? "",
        colors: (f?.colors ?? []).map((c) => c.colorName),
        // Migráció előtt minden elérhető (tartalék); utána: sor nélkül rejtett.
        enabled: migrated ? Boolean(r?.enabled) : true,
        updatedAt: r?.updated_at ?? null,
        updatedBy: r?.updated_by ? names.get(r.updated_by) ?? null : null,
      };
    }),
    log: (logRows ?? []).map((l) => ({
      templateId: l.template_id,
      name: familyName.get(l.template_id)?.name ?? l.template_id,
      enabled: l.enabled,
      at: l.changed_at,
      by: l.changed_by ? names.get(l.changed_by) ?? null : null,
    })),
  };
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  return NextResponse.json(await payload());
}

export async function POST(request: Request) {
  const staff = await requireAdmin();
  if (!staff) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  let body: { templateId?: unknown; enabled?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }
  const templateId = String(body.templateId ?? "");
  if (!ENGINE_TEMPLATES.some((t) => t.id === templateId)) return NextResponse.json({ error: "Ismeretlen sablon." }, { status: 422 });
  if (typeof body.enabled !== "boolean") return NextResponse.json({ error: "Hiányzik az állapot." }, { status: 422 });
  const r = await setTemplateEnabled(templateId, body.enabled, staff.userId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json(await payload());
}
