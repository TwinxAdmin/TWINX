// POST /api/auth/resend-confirmation — új megerősítő levél kérése.
//
// Miért kell: a megerősítő levél elveszhet, spambe kerülhet, vagy lejárhat a
// link. Enélkül a partner „bennragad” a fiókjában — belépni nem tud, és
// magától nem tud új levelet kérni.
//
// Adatvédelem: MINDIG ugyanazt a választ adjuk, akkor is, ha nincs ilyen fiók
// — így a végpont nem használható arra, hogy valaki e-mail címeket derítsen ki.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendConfirmationEmail } from "@/lib/auth-confirmation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const email = String((body as Record<string, string>)?.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Add meg az e-mail címed." }, { status: 422 });
  }

  const supabase = await createClient();
  const result = await sendConfirmationEmail(supabase, email);
  if (result === "rate_limited") {
    return NextResponse.json({ error: "Kérlek, várj egy kicsit, és próbáld újra." }, { status: 429 });
  }

  return NextResponse.json({ ok: true });
}
