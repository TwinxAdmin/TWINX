// Session frissítése minden kérésnél + a /dashboard útvonalak védelme.
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/env";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Ha hiányzik a Supabase konfiguráció (pl. env nincs beállítva), NE dőljön el az
  // egész oldal — engedjük tovább a kérést (a védett oldalakat a szerver úgyis kezeli).
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // FONTOS: a getUser() frissíti a tokent; ne tegyünk közé egyéb logikát.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Admin „így látja Y felhasználó" előnézet (3f): előnézetben NINCS beküldés — minden nem-GET API-hívás tiltott,
  // kivéve az admin API-kat (pl. a nézet visszaváltása) és a belépés/kilépés útvonalait. A cookie-t csak admin
  // állíthatja be (/api/admin/view-as); ha valaki kézzel hamisítja, csak a saját beküldéseit tiltja le.
  const p = request.nextUrl.pathname;
  if (request.cookies.get("twx_view_as_user")?.value && request.method !== "GET" && p.startsWith("/api/")
      && !p.startsWith("/api/admin/") && !p.startsWith("/api/auth/")) {
    return NextResponse.json({ error: "Előnézetben a beküldés le van tiltva. Válts vissza admin nézetre." }, { status: 403 });
  }

  // Védett útvonalak: /dashboard csak bejelentkezve érhető el.
  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
