// POST /api/auth/register — regisztráció Supabase Auth-tal.
// Sorrend: bejövő adat -> szigorú szerveroldali validáció -> Supabase signUp.
// A profiles rekordot a DB trigger (handle_new_user) hozza létre, 0 kredittel.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateRegisterInput } from "@/lib/validation";
import { LANDING_SIGNUP_SOURCE } from "@/lib/onboarding";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const { name, company, email, password, passwordConfirm, source } = (body ?? {}) as Record<string, string>;

  const { valid, errors } = validateRegisterInput({ name, email, password, passwordConfirm });
  if (!valid) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  // Forrás-jelölés: CSAK az ismert landing-értéket fogadjuk el, minden mást eldobunk.
  // A DB-trigger (handle_new_user) ebből ad 10 kezdőkreditet a keret erejéig.
  const signupSource = source === LANDING_SIGNUP_SOURCE ? LANDING_SIGNUP_SOURCE : null;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // A cég nem kötelező; a profiles rekordba a DB trigger írja át (handle_new_user).
    // A signup_source csak akkor kerül be, ha érvényes landing-forrás.
    options: {
      data: {
        full_name: name.trim(),
        company: (company ?? "").trim(),
        ...(signupSource ? { signup_source: signupSource } : {}),
      },
    },
  });

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
