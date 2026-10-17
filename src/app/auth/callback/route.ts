// GET /auth/callback — OAuth (Google) visszairányítás.
// A Supabase a bejelentkezés után ide küld egy `code`-ot, amit munkamenetre
// váltunk (PKCE), majd a dashboardra irányítunk.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LANDING_SIGNUP_SOURCE } from "@/lib/onboarding";
import { applyLandingSignupBonus } from "@/lib/landing-bonus";
import { TERMS_VERSION } from "@/lib/legal";
import { recordTermsAcceptance } from "@/lib/terms";
import { sendRegistrationEvent } from "@/lib/meta-capi";
import { newMetaEventId, registrationContentName } from "@/lib/meta-pixel";

/** Ennyi időn belül létrejött fiók számít ÚJ regisztrációnak (a Google-belépés ugyanezen az úton jön). */
const NEW_ACCOUNT_WINDOW_MS = 10 * 60 * 1000;

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
  // Marketing-süti hozzájárulás (a Google-gomb küldi): csak ekkor mehet a szerveroldali Meta-esemény.
  const marketingConsent = searchParams.get("mc") === "1";

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
      // Meta-mérés új Google-regisztrációnál: a böngészős Pixel csak a nyilvános oldalakon fut, ezért az új fiókot a nyilvános
      // sikerképernyőre visszük (a landingről is), eseményazonosítóval; a szerver hozzájárulással ugyanezzel küldi el (Conversions API).
      let target = next;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const created = user?.created_at ? Date.parse(user.created_at) : NaN;
        if (user && Date.now() - created < NEW_ACCOUNT_WINDOW_MS) {
          const eventId = newMetaEventId();
          const src = isLanding ? LANDING_SIGNUP_SOURCE : null;
          if (marketingConsent) {
            await sendRegistrationEvent(request, {
              eventId, contentName: registrationContentName(src), email: user.email ?? null, userId: user.id,
              sourceUrl: `${origin}${isLanding ? "/ingatlan" : "/register"}`, // a Google-oldal a hivatkozó, nem a mi oldalunk
            });
          }
          if (next.startsWith("/register?siker=1")) target = `${next}&meid=${eventId}`;
          else if (next === "/dashboard") target = `/register?siker=1&meid=${eventId}${src ? `&src=${src}` : ""}`;
        }
      } catch {
        // a mérés hibája ne akadályozza a belépést
      }
      return NextResponse.redirect(`${origin}${target}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
