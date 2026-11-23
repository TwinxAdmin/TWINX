// Az új nyilvános oldal szerveroldali segédei (felső sáv adatai, Moduljaim). Közös adatok: lib/site.ts.
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { visibleCategories, visibleModules } from "@/lib/catalog";
import { premium3dStatus } from "@/lib/premium3d";
import { hasEstateAccess } from "@/lib/new-ui";
import type { SiteModule, SiteViewer } from "@/lib/site";

/** Az Ingatlan csomag moduljainak útvonalai (ugyanaz, mint a ModuleGate-ben). */
const ESTATE_PATHS = ["/dashboard/real-estate", "/dashboard/flyer"];

/**
 * A nyilvános oldalak felső sávjának adatai: belépve a felhasználó (Moduljaim: csak amihez hozzáférése van),
 * kijelentkezve null. (Korábban admin-előnézeti kapu volt — az oldal 2026-11-23 óta mindenkinek él.)
 */
export async function getSiteViewer(): Promise<SiteViewer> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  const isAdmin = me?.role === "admin";
  const estate = !isAdmin && (await hasEstateAccess(user.id));
  return { email: user.email ?? "", name: (me?.full_name as string | null) ?? "", isAdmin, modules: await modulesFor({ isAdmin, estate }) };
}

/** A foglalás nyitva van-e ennek a látogatónak (élesítésig csak admin; BOOKINGS_PUBLIC=1 → mindenki). */
export function bookingsOpenFor(viewer: SiteViewer): boolean {
  return process.env.BOOKINGS_PUBLIC === "1" || !!viewer?.isAdmin;
}

/**
 * A „Moduljaim" tartalma: amihez a felhasználónak hozzáférése van.
 *  - admin: minden látható modul;
 *  - Ingatlan-hozzáféréssel: az Ingatlan csomag moduljai;
 *  - különben üres (az egyedi modulok hozzáférése a 4. lépésben jön: module_access).
 */
export async function modulesFor(p: { isAdmin: boolean; estate: boolean }): Promise<SiteModule[]> {
  if (!p.isAdmin && !p.estate) return [];
  const premium3d = (await premium3dStatus()).status;
  const view = { isAdmin: p.isAdmin, premium3d };
  return visibleCategories(view).flatMap((c) => visibleModules(c, false, view))
    .filter((m) => p.isAdmin || ESTATE_PATHS.some((x) => m.href === x || m.href.startsWith(x + "/")))
    .map((m) => ({ label: m.label, href: m.href, icon: m.icon }));
}

/** Felhasználó szerinti admin-előnézet (3f): a megjelenített személy alapadatai (service role — a hívó admin). */
export async function previewSubject(userId: string): Promise<{ id: string; name: string; email: string } | null> {
  const admin = createAdminClient();
  const [{ data: u }, { data: p }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
  ]);
  if (!u?.user) return null;
  return { id: userId, name: (p?.full_name as string | null) ?? "", email: u.user.email ?? "" };
}
