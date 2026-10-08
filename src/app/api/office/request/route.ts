// GET  /api/office/request — az irodai fiókkal kapcsolatos állapotom:
//        tag vagyok-e már valamelyik irodában, és a legutóbbi igénylésem.
// POST /api/office/request — irodai fiók igénylése a TWINX-től.
// Sorrend: validáció → mentés (office_requests) → e-mail az adminnak (best-effort).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateOfficeRequest } from "@/lib/office";
import { sendOfficeRequestNotification } from "@/lib/email";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  // RLS: a saját tagsági sor és a saját igénylések olvashatók.
  const [{ data: member }, { data: requests }] = await Promise.all([
    supabase.from("office_members").select("office_id, role").eq("user_id", user.id).limit(1),
    supabase
      .from("office_requests")
      .select("id, office_name, team_size, phone, note, leader_view, status, decision_note, created_at, decided_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  // A legutóbbi jóváhagyott igénylésből nyitottak-e már irodát? (Ha igen, újat lehet igényelni.)
  const last = requests?.[0] ?? null;
  let requestUsed = false;
  if (last?.status === "approved") {
    const { data: used } = await createAdminClient().from("offices").select("id").eq("request_id", last.id).limit(1);
    requestUsed = !!used?.length;
  }

  return NextResponse.json({
    membership: member?.[0] ?? null,
    request: last,
    requestUsed,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const { valid, errors, value } = validateOfficeRequest(body);
  if (!valid || !value) return NextResponse.json({ errors }, { status: 422 });

  const admin = createAdminClient();

  // Több irodai fiók is igényelhető (egyszerre egy függő igénylés lehet — lásd egyedi index).

  const { data: profile } = await admin
    .from("profiles").select("full_name").eq("id", user.id).maybeSingle();

  const { data: inserted, error } = await admin
    .from("office_requests")
    .insert({
      user_id: user.id,
      user_email: user.email ?? null,
      office_name: value.officeName,
      team_size: value.teamSize,
      phone: value.phone,
      note: value.note,
    })
    .select("id, office_name, team_size, phone, note, leader_view, status, decision_note, created_at, decided_at")
    .single();

  if (error) {
    // Egyedi index: egyszerre csak egy függő igénylés lehet.
    if (/office_requests_one_pending|duplicate key/i.test(error.message)) {
      return NextResponse.json({ error: "Már van egy elbírálás alatt álló igénylésed." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await sendOfficeRequestNotification({
      requesterName: (profile?.full_name as string) || undefined,
      requesterEmail: user.email ?? "-",
      officeName: value.officeName,
      teamSize: value.teamSize,
      phone: value.phone,
      note: value.note ?? undefined,
    });
  } catch (err) {
    console.error("Irodai igénylés e-mail hiba:", (err as Error).message);
  }

  return NextResponse.json({ ok: true, request: inserted });
}
