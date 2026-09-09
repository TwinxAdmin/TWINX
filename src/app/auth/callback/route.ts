// GET /auth/callback — OAuth (Google) visszairányítás.
// A Supabase a bejelentkezés után ide küld egy `code`-ot, amit munkamenetre
// váltunk (PKCE), majd a dashboardra irányítunk.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Csak SAJÁT oldalra irányítunk vissza (nyílt átirányítás elleni védelem):
  // egy „/”-rel kezdődő, de nem „//”-val induló útvonal fogadható el.
  const raw = searchParams.get("next") ?? "/dashboard";
  const next = /^\/(?!\/)/.test(raw) ? raw : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
