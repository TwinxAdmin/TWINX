// PATCH /api/admin/credit-requests — kredit-kérés elbírálása (CSAK admin).
// body: { id, action: "approve" | "reject", amount?, note? }
//
// Jóváhagyáskor a jóváírás és a kérés lezárása EGY logikai lépés: előbb a kérést
// zárjuk le feltételesen (csak ha még 'pending'), és csak azután írunk jóvá — így
// két admin egyszerre kattintva sem adhat kétszer kreditet.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_AMOUNT = 1000;

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") {
    return NextResponse.json({ error: "Csak admin végezheti." }, { status: 403 });
  }

  let body: { id?: string; action?: string; amount?: number; note?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const id = String(body.id ?? "");
  const action = body.action === "approve" ? "approve" : body.action === "reject" ? "reject" : null;
  if (!id || !action) return NextResponse.json({ error: "Hiányzó azonosító vagy művelet." }, { status: 400 });

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("credit_requests")
    .select("id, user_id, user_email, amount, status")
    .eq("id", id)
    .single();
  if (!req) return NextResponse.json({ error: "Nem található." }, { status: 404 });
  if (req.status !== "pending") {
    return NextResponse.json({ error: "Ezt a kérést már elbírálták." }, { status: 409 });
  }

  const note = String(body.note ?? "").trim().slice(0, 300) || null;

  // --- ELUTASÍTÁS ---
  if (action === "reject") {
    const { data: closed } = await admin
      .from("credit_requests")
      .update({
        status: "rejected", decided_by: user.id, decided_by_email: user.email ?? null,
        decided_at: new Date().toISOString(), decision_note: note,
      })
      .eq("id", id).eq("status", "pending").select("id");
    if (!closed?.length) return NextResponse.json({ error: "Ezt a kérést már elbírálták." }, { status: 409 });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // --- JÓVÁHAGYÁS --- (az admin felülírhatja a kért mennyiséget)
  const override = Number.isInteger(body.amount) && (body.amount ?? 0) > 0 ? Number(body.amount) : null;
  if (override !== null && override > MAX_AMOUNT) {
    return NextResponse.json({ error: `A jóváírt mennyiség legfeljebb ${MAX_AMOUNT} lehet.` }, { status: 422 });
  }

  // A lezárás + jóváírás + naplózás EGYETLEN adatbázis-tranzakcióban fut. Így nem
  // fordulhat elő sem dupla jóváírás (két admin egyszerre), sem elveszett kredit
  // (lezárt kérés jóváírás nélkül).
  const { data: granted, error: applyErr } = await admin.rpc("credit_request_approve", {
    p_id: id,
    p_admin: user.id,
    p_admin_email: user.email ?? null,
    p_amount: override,
    p_note: note,
  });

  if (applyErr) {
    console.error("[admin-credit-requests] Jóváhagyás sikertelen:", id, applyErr.message);
    return NextResponse.json(
      { error: "A jóváhagyás nem sikerült. Futtatd le a credit-requests.sql migrációt." },
      { status: 500 }
    );
  }
  if (!granted || Number(granted) <= 0) {
    return NextResponse.json({ error: "Ezt a kérést már elbírálták." }, { status: 409 });
  }

  return NextResponse.json({ ok: true, status: "approved", granted: Number(granted) });
}
