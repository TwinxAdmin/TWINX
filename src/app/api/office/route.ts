// GET  /api/office — a KIVÁLASZTOTT irodám (ha tagja vagyok valamelyiknek) + az összes irodám listája (váltóhoz).
//        Az egyenleget, a csatlakozási kódot és a létszámot CSAK a létrehozó kapja meg.
// POST /api/office — iroda megnyitása a JÓVÁHAGYOTT igénylés alapján. body: { name }
//        A megnyitó lesz a létrehozó (owner) és az első tag; a rendszer csatlakozási kódot generál.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateJoinCode, validateOfficeName } from "@/lib/office";
import { getMembership, listMyOffices, loadMyOffice, setWorkContext } from "@/lib/office-server";
import { officeMemberPreview } from "@/lib/view-as";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const [office, offices, preview] = await Promise.all([loadMyOffice(user.id), listMyOffices(user.id), officeMemberPreview()]);
  // Kolléga-nézet előnézete: csak a létrehozónál / vezetőnél van hatása (megjelenítés, jogot nem ad / nem vesz el).
  const memberPreview = preview && !!office && (office.role === "owner" || office.canAllocate);
  return NextResponse.json({ office, offices, memberPreview });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { name?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const { name, error: nameError } = validateOfficeName(body.name);
  if (!name) return NextResponse.json({ errors: { name: nameError } }, { status: 422 });

  const admin = createAdminClient();

  // 1-2) Van JÓVÁHAGYOTT igénylése, amiből még nem nyitott irodát? (Több iroda is lehet —
  //      mindegyikhez külön jóváhagyott igénylés kell.)
  const { data: approved } = await admin
    .from("office_requests").select("id").eq("user_id", user.id).eq("status", "approved")
    .order("decided_at", { ascending: false }).limit(20);
  const ids = (approved ?? []).map((r) => r.id as string);
  if (ids.length === 0) return NextResponse.json({ error: "Irodát csak jóváhagyott igénylés után lehet nyitni." }, { status: 403 });
  const { data: usedRows } = await admin.from("offices").select("request_id").in("request_id", ids);
  const used = new Set((usedRows ?? []).map((r) => r.request_id as string));
  const free = ids.find((id) => !used.has(id));
  if (!free) return NextResponse.json({ error: "A jóváhagyott igényléseidből már mind megnyitottad az irodát. Újabbhoz új igénylés kell." }, { status: 409 });
  const req = { id: free };

  // 3) Iroda létrehozása — egyedi kóddal (ütközéskor új kódot próbálunk).
  let officeId: string | null = null;
  for (let attempt = 0; attempt < 5 && !officeId; attempt++) {
    const { data, error } = await admin
      .from("offices")
      .insert({ owner_id: user.id, request_id: req.id, name, join_code: generateJoinCode() })
      .select("id")
      .single();
    if (data) officeId = data.id as string;
    else if (error && !/join_code|duplicate key/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  if (!officeId) return NextResponse.json({ error: "Nem sikerült kódot generálni, próbáld újra." }, { status: 500 });

  // 4) A létrehozó az első tag. Ha ez nem sikerül, az üres irodát visszavonjuk,
  //    hogy ne maradjon gazdátlan iroda (az igénylés újra felhasználható).
  const { error: memberError } = await admin.from("office_members").insert({
    office_id: officeId,
    user_id: user.id,
    role: "owner",
    joined_via: "owner",
  });
  if (memberError) {
    await admin.from("offices").delete().eq("id", officeId);
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  // Az új iroda lesz a kiválasztott, irodai módban (ha a kontextus-tábla még nincs, nem baj).
  await setWorkContext(user.id, { officeId, useOffice: true });

  return NextResponse.json({ ok: true, office: await loadMyOffice(user.id) });
}

// PATCH /api/office — { action: "regenerateCode" }: új csatlakozási kód (CSAK a létrehozó).
// A régi kód azonnal érvénytelen lesz; a már csatlakozott tagokat nem érinti.
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { action?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }
  if (body.action !== "regenerateCode") return NextResponse.json({ error: "Ismeretlen művelet." }, { status: 400 });

  const admin = createAdminClient();
  const me = await getMembership(user.id);
  if (!me || me.role !== "owner") {
    return NextResponse.json({ error: "Kódot csak az irodai fiók létrehozója generálhat." }, { status: 403 });
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await admin.from("offices").update({ join_code: generateJoinCode() }).eq("id", me.office_id);
    if (!error) return NextResponse.json({ ok: true, office: await loadMyOffice(user.id) });
    if (!/join_code|duplicate key/i.test(error.message)) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ error: "Nem sikerült új kódot generálni, próbáld újra." }, { status: 500 });
}
