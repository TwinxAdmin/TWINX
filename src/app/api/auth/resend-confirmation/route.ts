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
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) {
    // A gyakori eset a percenkénti küldési korlát — ezt érdemes kiírni.
    if (/rate|limit|seconds/i.test(error.message)) {
      return NextResponse.json(
        { error: "Túl sok kérés. Várj egy percet, és próbáld újra." },
        { status: 429 }
      );
    }
    console.error("[resend-confirmation]", error.message);
  }

  return NextResponse.json({ ok: true });
}
