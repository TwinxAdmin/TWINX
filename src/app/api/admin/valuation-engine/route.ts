// /api/admin/valuation-engine — a comp-alapú becslő motor configjának kezelése (CSAK admin).
//  GET                                   -> { active, versions }
//  POST { action:"save", params, note }  -> új verzió + aktiválás
//  POST { action:"activate", id }        -> korábbi verzió újraaktiválása
//  POST { action:"reset" }               -> vissza a beépített alapértékre
//  POST { action:"dryrun", params, compsText, subject } -> száraz próba (nem ment)
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeValuation, type EngineConfig, type Subject, conditionKey } from "@/lib/valuation-engine";
import {
  listConfigVersions, saveNewConfigVersion, activateConfigVersion, resetConfigToDefault,
  deleteConfigVersion, renameConfigVersion, mergeConfig, parseCompsJson,
} from "@/lib/valuation-engine-server";

export const runtime = "nodejs";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 }) };
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return { error: NextResponse.json({ error: "Csak admin végezheti." }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const data = await listConfigVersions();
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  let body: { action?: string; id?: string; note?: string; params?: Partial<EngineConfig>; compsText?: string; subject?: Partial<Subject> & { condition?: string } };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  try {
    if (body.action === "save") {
      const res = await saveNewConfigVersion(body.params ?? {}, body.note);
      return NextResponse.json({ ok: true, ...res });
    }
    if (body.action === "activate") {
      if (!body.id) return NextResponse.json({ error: "Hiányzó verzió-azonosító." }, { status: 422 });
      await activateConfigVersion(body.id);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "reset") {
      const res = await resetConfigToDefault();
      return NextResponse.json({ ok: true, ...res });
    }
    if (body.action === "delete") {
      if (!body.id) return NextResponse.json({ error: "Hiányzó verzió-azonosító." }, { status: 422 });
      await deleteConfigVersion(body.id);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "rename") {
      if (!body.id) return NextResponse.json({ error: "Hiányzó verzió-azonosító." }, { status: 422 });
      await renameConfigVersion(body.id, body.note ?? "");
      return NextResponse.json({ ok: true });
    }
    if (body.action === "dryrun") {
      const cfg = mergeConfig(body.params);
      const comps = parseCompsJson(body.compsText ?? "");
      const s = body.subject ?? {};
      const subject: Subject = {
        sizeM2: Number(s.sizeM2) || 0,
        conditionKey: s.conditionKey ?? conditionKey(s.condition),
        locationPremiumPct: Number(s.locationPremiumPct) || 0,
        photoCorrectionPct: Number(s.photoCorrectionPct) || 0,
        isBudapest: s.isBudapest ?? true,
        district: String(s.district ?? ""),
        floorNum: s.floorNum ?? null,
        hasLift: s.hasLift ?? false,
        hasBalcony: s.hasBalcony ?? false,
      };
      const result = computeValuation(comps, subject, cfg);
      return NextResponse.json({ ok: true, result, compsParsed: comps.length });
    }
    return NextResponse.json({ error: "Ismeretlen művelet." }, { status: 422 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Hiba." }, { status: 500 });
  }
}
