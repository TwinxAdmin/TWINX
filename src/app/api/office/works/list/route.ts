// GET /api/office/works/list?range=month|30d|all[&userId=…]
//   • userId nélkül: a SAJÁT munkáim (privát + irodai), és melyik közös mappában vannak — max 50.
//   • userId-vel: egy kolléga IRODAI munkái (cím, modul, dátum, kredit) — CSAK létrehozó / vezető.
//     A fájl linkjét a vezető nem kapja meg: a tartalmat csak megosztott munkánál (közös mappa) látja.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMembership, getMembershipIn } from "@/lib/office-server";
import { memberWorks, myWorks, parseRange } from "@/lib/office-overview";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const me = await getMembership(user.id);
  if (!me) return NextResponse.json({ error: "Nem vagy tagja irodának." }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const range = parseRange(params.get("range"));
  const target = params.get("userId");

  if (!target || target === user.id) {
    return NextResponse.json({ works: await myWorks(me.office_id, user.id, range) });
  }

  if (!(me.role === "owner" || me.can_allocate)) {
    return NextResponse.json({ error: "Kollégák munkáit a létrehozó és a vezető látja." }, { status: 403 });
  }
  const t = await getMembershipIn(target, me.office_id);
  if (!t) return NextResponse.json({ error: "Ez a felhasználó nem tagja az irodának." }, { status: 404 });

  return NextResponse.json({ works: await memberWorks(me.office_id, target, range) });
}
