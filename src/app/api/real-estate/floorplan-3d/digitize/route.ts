// POST /api/real-estate/floorplan-3d/digitize — alaprajz (kép / PDF / kézi rajz fotója) → szerkeszthető lakásleírás (JSON).
// PROTOTÍPUS: csak admin. Kredit itt NINCS (a levonás a jóváhagyott terv 3D-építésénél lesz).
// Form: file (kötelező), source = "digital" | "hand". Siker után a projekt mentődik (eredeti + terv) → projectId.
// Ha a mentés nem megy (pl. a migráció még nem futott), a terv akkor is visszajön, saveError-ral.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { digitizeFloorplan } from "@/lib/floorplan3d/digitize";
import { FLOORPLAN_UPLOAD_TYPES, floorplan3dConfig } from "@/lib/floorplan3d/config";
import { logCost } from "@/lib/costs";
import { createProject } from "@/lib/floorplan3d/projects";

export const runtime = "nodejs";
export const maxDuration = 180; // a képelemzés gondolkodó modellel 17–82 mp (mért)

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "A Prémium 3D hamarosan érkezik — a modul még fejlesztés alatt áll." }, { status: 403 });

  const cfg = floorplan3dConfig();
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Hibás kérés." }, { status: 400 });
  }
  const file = form.get("file");
  const hand = form.get("source") === "hand";
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ errors: { file: "Tölts fel egy alaprajzot." } }, { status: 422 });
  if (!FLOORPLAN_UPLOAD_TYPES.includes(file.type)) return NextResponse.json({ errors: { file: "Csak JPG, PNG, WEBP kép vagy PDF tölthető fel." } }, { status: 422 });
  if (file.size > cfg.maxUploadBytes) return NextResponse.json({ errors: { file: `A fájl legfeljebb ${Math.round(cfg.maxUploadBytes / 1024 / 1024)} MB lehet.` } }, { status: 422 });

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await digitizeFloorplan({ bytes, mime: file.type }, hand);
    await logCost({
      userId: user.id, serviceId: null, feature: "floorplan-3d", serviceName: "google-studio",
      units: 1, estimatedCostUsd: result.stats.costUsd,
    });
    const saved = await createProject({
      userId: user.id, file: { bytes, mime: file.type, name: file.name }, sourceKind: hand ? "hand" : "digital", plan: result.plan, stats: result.stats,
    });
    return NextResponse.json({ ...result, ...("id" in saved ? { projectId: saved.id } : { saveError: saved.error }) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "A digitalizálás nem sikerült." }, { status: 500 });
  }
}
