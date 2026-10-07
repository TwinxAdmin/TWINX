// PATCH /api/admin/offices — irodai egyenleg közvetlen jóváírása (CSAK admin).
// body: { officeId, amount, note? }  — pl. ajándék / korrekció / személyesen rendezett befizetés.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_TOPUP = 5000;

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "Csak admin végezheti." }, { status: 403 });

  let body: { officeId?: string; amount?: unknown; note?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const officeId = String(body.officeId ?? "");
  const amount = Number(body.amount);
  if (!officeId) return NextResponse.json({ error: "Hiányzó iroda." }, { status: 400 });
  if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_TOPUP) {
    return NextResponse.json({ error: `1 és ${MAX_TOPUP} közötti egész számot adj meg.` }, { status: 422 });
  }
  const note = String(body.note ?? "").trim().slice(0, 200);

  const admin = createAdminClient();
  const { error } = await admin.rpc("office_add", {
    p_office: officeId, p_amount: amount, p_actor: user.id, p_kind: "adjust",
    p_note: `Admin jóváírás (${user.email ?? "admin"})${note ? ` — ${note}` : ""}`,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: office } = await admin.from("offices").select("id, balance").eq("id", officeId).single();
  return NextResponse.json({ ok: true, balance: office?.balance ?? null });
}
