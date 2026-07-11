// /api/admin/prompts — prompt-verziók kezelése (CSAK admin).
//  POST { action: "save", module, segments, name? }     -> új verzió + aktiválás
//  POST { action: "activate", module, id }              -> korábbi verzió újraaktiválása
//  POST { action: "reset", module }                     -> vissza a kód-alapértelmezetthez
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  validateSegments,
  saveNewVersion,
  activateVersion,
  resetToDefault,
  getModuleDef,
  type PromptSegments,
} from "@/lib/prompts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin") {
    return NextResponse.json({ error: "Csak admin végezheti." }, { status: 403 });
  }

  let body: {
    action?: string;
    module?: string;
    id?: string;
    name?: string;
    segments?: PromptSegments;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const { action, module } = body;
  if (!module || !getModuleDef(module)) {
    return NextResponse.json({ error: "Ismeretlen modul." }, { status: 422 });
  }

  try {
    if (action === "save") {
      const segments = body.segments ?? {};
      const check = validateSegments(module, segments);
      if (!check.valid) {
        return NextResponse.json({ error: "Érvénytelen szöveg.", errors: check.errors }, { status: 422 });
      }
      const res = await saveNewVersion({
        module,
        segments,
        name: body.name?.trim() || null,
        createdBy: user.id,
      });
      return NextResponse.json({ ok: true, ...res });
    }

    if (action === "activate") {
      if (!body.id) {
        return NextResponse.json({ error: "Hiányzó verzió-azonosító." }, { status: 422 });
      }
      await activateVersion(module, body.id);
      return NextResponse.json({ ok: true });
    }

    if (action === "reset") {
      await resetToDefault(module);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Ismeretlen művelet." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
