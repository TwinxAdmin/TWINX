// GET /api/admin/module-usage — admin „Modul-használat" fül adatai (MH3, CSAK admin). Pénzügy nincs benne.
//   közös szűrők: ?range=7d|30d|90d|all  &source=all|direct|landing  &mode=all|private|office|team  &staff=0|1
//   • alap:          + &reg=today|7d|30d|90d|12m|all &group=day|week|month — KPI, új regisztrálók, modul-rangsor,
//                    felhasználók TOP 5-tel, irodák és munkaterek
//   • ?user=<id>:    egy felhasználó részletei (minden modul, 30 napos görbe, idővonal max. 50, összegzés)
//   • ?office=<id>:  egy iroda / munkatér részletei (tag × modul)
//   • ?module=<href>: egy modul részletei (kik használják a legtöbbet + napi görbe)
// Az „admin és sales" alapból KIMARAD (staff=1 kapcsolja be). A megnyitás-adatok a module_views-ból jönnek
// (20261012183311_module-views.sql) — ha az még üres, a megnyitás-oszlopok 0-k, a többi működik.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { moduleUsageModule, moduleUsageOffice, moduleUsageOverview, moduleUsageUser, parseFilters, type RegGroup, type RegWindow } from "@/lib/module-usage";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "Csak admin láthatja." }, { status: 403 });

  const p = new URL(request.url).searchParams;
  const filters = parseFilters(p);

  try {
    const userId = p.get("user");
    if (userId) {
      if (!UUID.test(userId)) return NextResponse.json({ error: "Érvénytelen felhasználó." }, { status: 400 });
      const data = await moduleUsageUser(userId, filters);
      return data ? NextResponse.json(data) : NextResponse.json({ error: "A felhasználó nem található." }, { status: 404 });
    }

    const officeId = p.get("office");
    if (officeId) {
      if (!UUID.test(officeId)) return NextResponse.json({ error: "Érvénytelen iroda." }, { status: 400 });
      const data = await moduleUsageOffice(officeId, filters);
      return data ? NextResponse.json(data) : NextResponse.json({ error: "Az iroda nem található." }, { status: 404 });
    }

    const moduleHref = p.get("module");
    if (moduleHref) {
      const data = await moduleUsageModule(moduleHref.slice(0, 200), filters);
      return data ? NextResponse.json(data) : NextResponse.json({ error: "Ismeretlen modul." }, { status: 404 });
    }

    const r = p.get("reg"), g = p.get("group");
    const regWindow: RegWindow = r === "today" || r === "7d" || r === "90d" || r === "12m" || r === "all" ? r : "30d";
    const regGroup: RegGroup = g === "week" || g === "month" ? g : regWindow === "12m" || regWindow === "all" ? "month" : "day";
    return NextResponse.json(await moduleUsageOverview(filters, { window: regWindow, group: regGroup }));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Nem sikerült összesíteni." }, { status: 500 });
  }
}
