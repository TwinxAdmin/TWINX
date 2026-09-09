// Munkatársi (staff) jogosultság — admin és sales.
//
// A sales az értékesítést viszi: látja a beérkező tájékoztatás-kéréseket és az
// ajándékkódra jelentkezőket, és a jelentkezéseket JÓVÁ IS HAGYHATJA (a kampány
// kerete és a naplózás a szerveren őrzött). NEM lát viszont felhasználókat,
// pénzügyet, tartalmat, és kreditet sem adhat senkinek.
import type { SupabaseClient } from "@supabase/supabase-js";

export type StaffRole = "admin" | "sales";

export function isStaffRole(role: string | null | undefined): role is StaffRole {
  return role === "admin" || role === "sales";
}

/**
 * A bejelentkezett felhasználó VALÓDI szerepköre az adatbázisból.
 * (Az admin „így látja a partner" előnézete ezt szándékosan nem befolyásolja.)
 */
export async function getStaffRole(
  supabase: SupabaseClient
): Promise<{ userId: string; email: string | null; role: StaffRole } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = me?.role as string | undefined;
  if (!isStaffRole(role)) return null;
  return { userId: user.id, email: user.email ?? null, role };
}

/** Csak a tájékoztatás-kérések (a sales ezeket látja, a B2B ajánlatkéréseket nem). */
export const CONSULTATION_MARKER = "Bővebb tájékoztatás";
