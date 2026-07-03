// POST /api/auth/register — regisztráció Supabase Auth-tal.
// Sorrend: bejövő adat -> szigorú szerveroldali validáció -> Supabase signUp.
// A profiles rekordot a DB trigger (handle_new_user) hozza létre, 0 kredittel.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateAuthInput } from "@/lib/validation";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const { email, password } = (body ?? {}) as Record<string, string>;

  const { valid, errors } = validateAuthInput({ email, password });
  if (!valid) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Ha van session -> azonnal belépett (e-mail megerősítés kikapcsolva Supabase-ben).
  // Ha nincs session -> e-mail megerősítés szükséges.
  return NextResponse.json({
    needsConfirmation: !data.session,
    userId: data.user?.id ?? null,
  });
}
