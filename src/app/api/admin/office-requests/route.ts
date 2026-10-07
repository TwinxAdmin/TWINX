// PATCH /api/admin/office-requests — irodai fiók igénylés elbírálása (CSAK admin).
// body: { id, action: "approve" | "reject", note? }
// Feltételes lezárás (csak ha még 'pending'), így két admin egyszerre kattintva
// sem dönthet kétszer. Az iroda TÉNYLEGES megnyitását a vezető végzi (IR3).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "Csak admin végezheti." }, { status: 403 });

  let body: { id?: string; action?: string; note?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const id = String(body.id ?? "");
  const action = body.action === "approve" || body.action === "reject" ? body.action : null;
  if (!id || !action) return NextResponse.json({ error: "Hiányzó azonosító vagy művelet." }, { status: 400 });

  const note = String(body.note ?? "").trim().slice(0, 500) || null;
  if (action === "reject" && !note) {
    return NextResponse.json({ error: "Elutasításnál írd meg röviden az okát — az igénylő ezt látja." }, { status: 422 });
  }

  const { data, error } = await createAdminClient()
    .from("office_requests")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      decision_note: note,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id, status, decided_at, decision_note")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Ezt az igénylést már elbírálták." }, { status: 409 });

  return NextResponse.json({ ok: true, item: data });
}
