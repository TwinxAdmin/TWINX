// GET /auth/confirm — az e-mail-megerősítő levél linkje ide érkezik.
//
// A Supabase levélsablonjában a link így néz ki:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup
// Az itt kapott egyszer használatos tokent munkamenetre váltjuk (verifyOtp),
// tehát a partner a megerősítés után rögtön belépve érkezik a kezdőlapra.
//
// Ugyanez az útvonal szolgálja ki a jelszó-visszaállítást (type=recovery) és
// az e-mail-cím módosítás megerősítését (type=email_change) is.
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ALLOWED: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Csak SAJÁT oldalra irányítunk tovább (nyílt átirányítás elleni védelem).
  const raw = searchParams.get("next") ?? "/dashboard";
  const next = /^\/(?!\/)/.test(raw) ? raw : "/dashboard";

  if (tokenHash && type && ALLOWED.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      // A jelszó-visszaállításnál külön oldalra kell menni, nem a kezdőlapra.
      const target = type === "recovery" ? "/dashboard/settings" : next;
      return NextResponse.redirect(`${origin}${target}`);
    }
  }

  // Lejárt vagy már felhasznált link → a belépőn kap érthető magyarázatot.
  return NextResponse.redirect(`${origin}/login?megerosites=hiba`);
}
