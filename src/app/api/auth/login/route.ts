// POST /api/auth/login — belépés Supabase Auth-tal.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendConfirmationEmail } from "@/lib/auth-confirmation";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const { email, password } = (body ?? {}) as Record<string, string>;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Add meg az e-mail címet és a jelszót." },
      { status: 422 }
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // A meg nem erősített e-mail cím KÜLÖN eset: itt nem a jelszóval van baj,
    // és a partner magától nem jönne rá, mit kell tennie.
    // Friss levelet is küldünk: a régi link addigra lejárhatott, így a korábban regisztrálók is be tudnak jutni.
    // (Ez a hiba csak helyes jelszónál jön, tehát idegen nem tud vele levelet küldetni vagy címet kideríteni.)
    if (/not confirmed|email.*confirm/i.test(error.message)) {
      const result = await sendConfirmationEmail(supabase, email.trim());
      return NextResponse.json(
        {
          error: "Ehhez a fiókhoz még nincs megerősítve az e-mail cím.",
          needsConfirmation: true,
          confirmationSent: result === "sent",
        },
        { status: 403 }
      );
    }
    // Egyébként egységes üzenet — ne áruljuk el, melyik mező hibás.
    return NextResponse.json(
      { error: "Hibás e-mail cím vagy jelszó." },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true });
}
