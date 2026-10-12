// GET /api/admin/module-analysis — admin „Modul elemzés" fül adatai (ME1, CSAK admin). Felhasználó-szintű adat nincs.
//   szűrők: ?range=7d|30d|90d|all &source=all|direct|landing &mode=all|private|office|team &staff=0|1
//   • alap:             TOP 3 modul (futtatás szerint) + Modulok egészsége
//   • ?module=<href>:   egy modul mély elemzése (visszatérés, mikor, kapcsolódások, minőség)
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseFilters } from "@/lib/module-usage";
import { moduleAnalysisDeep, moduleAnalysisOverview } from "@/lib/module-analysis";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "Csak admin láthatja." }, { status: 403 });

  const p = new URL(request.url).searchParams;
  const filters = parseFilters(p);
  try {
    const href = p.get("module");
    if (href) {
      const data = await moduleAnalysisDeep(href.slice(0, 200), filters);
      return data ? NextResponse.json(data) : NextResponse.json({ error: "Ismeretlen modul." }, { status: 404 });
    }
    return NextResponse.json(await moduleAnalysisOverview(filters));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Nem sikerült összesíteni." }, { status: 500 });
  }
}
