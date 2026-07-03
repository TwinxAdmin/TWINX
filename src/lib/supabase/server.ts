// Szerveroldali (Server Component / Route Handler) Supabase kliens.
// A Next.js 15-ben a cookies() aszinkron, ezért await kell.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component-ből hívva a set nem engedélyezett;
            // a session frissítését a middleware végzi el.
          }
        },
      },
    }
  );
}
