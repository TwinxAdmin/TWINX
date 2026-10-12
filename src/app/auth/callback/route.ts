// GET /auth/callback — OAuth (Google) visszairányítás.
// A Supabase a bejelentkezés után ide küld egy `code`-ot, amit munkamenetre
// váltunk (PKCE), majd a dashboardra irányítunk.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LANDING_SIGNUP_SOURCE } from "@/lib/onboarding";
import { applyLandingSignupBonus } from "@/lib/landing-bonus";
import { TERMS_VERSION } from "@/lib/legal";
import { recordTermsAcceptance } from "@/lib/terms";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Csak SAJÁT oldalra irányítunk vissza (nyílt átirányítás elleni védelem):
  // egy „/”-rel kezdődő, de nem „//”-val induló útvonal fogadható el.
  const raw = searchParams.get("next") ?? "/dashboard";
  const next = /^\/(?!\/)/.test(raw) ? raw : "/dashboard";
  // Landing-forrás: CSAK az ismert értéket fogadjuk el (10 kezdőkredithez).
  const isLanding = searchParams.get("src") === LANDING_SIGNUP_SOURCE;
  // Google-regisztráció a kötelező ÁSZF-jelölőnégyzet után: a változat a visszatérési címben jön.
  const acceptedTerms = searchParams.get("terms") === TERMS_VERSION;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Landingről indult Google-regisztráció? Írjuk fel a forrást + a 10 kreditet.
      // (Idempotens: ha már jelölt a profil, nem ad duplán.)
      if (isLanding) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) await applyLandingSignupBonus(user.id, user.email ?? null);
        } catch {
          // A bónusz elmaradása ne akadályozza a belépést — csendben tovább.
        }
      }
      if (acceptedTerms) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) await recordTermsAcceptance(user.id);
        } catch {
          // ha nem sikerül, belépés után az elfogadó ablak pótolja
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
