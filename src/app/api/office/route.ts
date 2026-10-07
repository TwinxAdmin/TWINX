// GET  /api/office — a saját irodám (ha tagja vagyok valamelyiknek), különben null.
//        Az egyenleget, a csatlakozási kódot és a létszámot CSAK a létrehozó kapja meg.
// POST /api/office — iroda megnyitása a JÓVÁHAGYOTT igénylés alapján. body: { name }
//        A megnyitó lesz a létrehozó (owner) és az első tag; a rendszer csatlakozási kódot generál.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateJoinCode, validateOfficeName } from "@/lib/office";
import { loadMyOffice } from "@/lib/office-server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  return NextResponse.json({ office: await loadMyOffice(user.id) });
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

  // 1) Már tag valahol? (egy felhasználó = egy iroda)
  const { data: member } = await admin
    .from("office_members").select("office_id").eq("user_id", user.id).maybeSingle();
  if (member) return NextResponse.json({ error: "Már tagja vagy egy irodai fióknak." }, { status: 409 });

  // 2) Van JÓVÁHAGYOTT igénylése, amiből még nem nyitott irodát?
  const { data: req } = await admin
    .from("office_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "approved")
    .order("decided_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!req) return NextResponse.json({ error: "Irodát csak jóváhagyott igénylés után lehet nyitni." }, { status: 403 });

  const { data: used } = await admin
    .from("offices").select("id").eq("request_id", req.id).maybeSingle();
  if (used) return NextResponse.json({ error: "Ebből az igénylésből már nyitottál irodát." }, { status: 409 });

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
    const dup = /duplicate key|office_members_user_id_key/i.test(memberError.message);
    return NextResponse.json(
      { error: dup ? "Már tagja vagy egy irodai fióknak." : memberError.message },
      { status: dup ? 409 : 500 }
    );
  }

  return NextResponse.json({ ok: true, office: await loadMyOffice(user.id) });
}
