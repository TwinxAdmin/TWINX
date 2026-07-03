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
    // Egységes üzenet — ne áruljuk el, melyik mező hibás.
    return NextResponse.json(
      { error: "Hibás e-mail cím vagy jelszó." },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true });
}
