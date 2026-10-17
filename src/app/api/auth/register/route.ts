// POST /api/auth/register — regisztráció Supabase Auth-tal.
// Sorrend: bejövő adat -> szigorú szerveroldali validáció -> Supabase signUp.
// A profiles rekordot a DB trigger (handle_new_user) hozza létre, 0 kredittel.
// Az ÁSZF elfogadása KÖTELEZŐ (acceptTerms: true) — sikeres regisztráció után a változat + időpont a profilra kerül.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateRegisterInput } from "@/lib/validation";
import { LANDING_SIGNUP_SOURCE } from "@/lib/onboarding";
import { recordTermsAcceptance } from "@/lib/terms";
import { cleanEventId, sendRegistrationEvent } from "@/lib/meta-capi";
import { registrationContentName } from "@/lib/meta-pixel";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const { name, company, phone, email, password, passwordConfirm, source } = (body ?? {}) as Record<string, string>;
  const acceptTerms = (body as { acceptTerms?: unknown } | null)?.acceptTerms === true;
  // Meta: a böngészős esemény azonosítója + a marketing-süti hozzájárulás (csak ekkor küldjük a szerveroldali eseményt).
  const metaEventId = cleanEventId((body as { metaEventId?: unknown } | null)?.metaEventId);
  const marketingConsent = (body as { marketingConsent?: unknown } | null)?.marketingConsent === true;

  const { valid, errors } = validateRegisterInput({ name, email, password, passwordConfirm, phone });
  if (!acceptTerms) errors.acceptTerms = "A regisztrációhoz el kell fogadnod az ÁSZF-et.";
  if (!valid || !acceptTerms) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  // Forrás-jelölés: CSAK az ismert landing-értéket fogadjuk el, minden mást eldobunk.
  // A DB-trigger (handle_new_user) ebből ad 10 kezdőkreditet a keret erejéig.
  const signupSource = source === LANDING_SIGNUP_SOURCE ? LANDING_SIGNUP_SOURCE : null;
  const phoneTrimmed = (phone ?? "").trim();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // A cég és a telefon nem kötelező; a profiles rekordba a DB trigger írja át
    // (handle_new_user). A signup_source csak érvényes landing-forrás esetén kerül be.
    options: {
      data: {
        full_name: name.trim(),
        company: (company ?? "").trim(),
        ...(phoneTrimmed ? { phone: phoneTrimmed } : {}),
        ...(signupSource ? { signup_source: signupSource } : {}),
      },
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // ÁSZF-elfogadás rögzítése (a profilt a trigger már létrehozta). Hiba esetén a belépés utáni ablak pótolja.
  if (data.user?.id) await recordTermsAcceptance(data.user.id).catch(() => null);

  // Meta Conversions API: csak valódi új fiók (a már létező e-mailre a Supabase üres „identities"-szel válaszol), hozzájárulással.
  // Token nélkül kihagyja; a hiba nem akadályozza a regisztrációt.
  if (metaEventId && marketingConsent && data.user?.id && (data.user.identities?.length ?? 1) > 0) {
    await sendRegistrationEvent(request, {
      eventId: metaEventId,
      contentName: registrationContentName(signupSource),
      email,
      userId: data.user.id,
      sourceUrl: request.headers.get("referer"),
    });
  }

  // Ha van session -> azonnal belépett (e-mail megerősítés kikapcsolva Supabase-ben).
  // Ha nincs session -> e-mail megerősítés szükséges.
  return NextResponse.json({
    needsConfirmation: !data.session,
    userId: data.user?.id ?? null,
  });
}
