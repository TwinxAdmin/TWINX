// POST /api/admin/leads — megkeresés lezárása/újranyitása ÉS belső jegyzet mentése
// (admin ÉS sales). A sales csak a tájékoztatás-kéréseket kezelheti.
//   { id, handled: boolean }  → leads.handled_at / handled_by / handled_email
//   { id, note: string }      → leads.note / note_updated_at / note_email
// A jegyzet BELSŐ: a megkereső soha nem látja. Lezárt megkeresés nem számít
// bele a fejléc-jelvénybe.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffRole, CONSULTATION_MARKER } from "@/lib/staff";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const staff = await getStaffRole(supabase);
  if (!staff) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });

  let body: { id?: string; handled?: boolean; note?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "Hiányzó azonosító." }, { status: 400 });

  // Kétféle művelet ugyanazon a végponton: jegyzet-mentés vagy lezárás.
  const isNote = typeof body.note === "string";
  const note = isNote ? String(body.note).slice(0, 4000) : null;
  const handled = body.handled !== false;

  const admin = createAdminClient();

  // Sales csak a tájékoztatás-kéréseket kezelheti.
  if (staff.role !== "admin") {
    const { data: row } = await admin.from("leads").select("message").eq("id", id).maybeSingle();
    if (!row || !String(row.message ?? "").includes(CONSULTATION_MARKER)) {
      return NextResponse.json({ error: "Ehhez a megkereséshez nincs jogosultság." }, { status: 403 });
    }
  }

  const patch = isNote
    ? {
        note: note && note.trim() ? note : null,
        note_updated_at: note && note.trim() ? new Date().toISOString() : null,
        note_email: note && note.trim() ? staff.email : null,
      }
    : handled
      ? { handled_at: new Date().toISOString(), handled_by: staff.userId, handled_email: staff.email }
      : { handled_at: null, handled_by: null, handled_email: null };

  const { error } = await admin.from("leads").update(patch).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, handled, noted: isNote });
}
