// POST /api/legal/accept — az aktuális ÁSZF-változat elfogadása belépés után (TermsGate: régi fiókok, Google-belépés, új változat).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordTermsAcceptance } from "@/lib/terms";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const err = await recordTermsAcceptance(user.id);
  if (err) return NextResponse.json({ error: err }, { status: 500 });
  return NextResponse.json({ ok: true });
}
