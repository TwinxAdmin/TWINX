// POST /api/auth/login — belépés Supabase Auth-tal.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    if (/not confirmed|email.*confirm/i.test(error.message)) {
      return NextResponse.json(
        {
          error: "Ehhez a fiókhoz még nincs megerősítve az e-mail cím. Nyisd meg a tőlünk kapott levelet, és kattints a megerősítő linkre.",
          needsConfirmation: true,
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
