// Az új nyilvános oldal előnézeti kapuja (szerveroldal). Közös adatok: lib/site.ts.
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { visibleCategories, visibleModules } from "@/lib/catalog";
import { premium3dStatus } from "@/lib/premium3d";
import type { SiteViewer } from "@/lib/site";

/**
 * Előnézeti kapu: csak az admin láthatja az új oldalakat (D51), mindenki másnak 404.
 * Visszaadja a felső sáv adatait.
 *
 * A „Moduljaim" most a mostani katalógus látható moduljait mutatja (az Ingatlan csomag):
 * a felhasználónkénti modul-hozzáférés a 4. lépésben épül (terv 13–14), akkor ez a lista onnan jön.
 */
export async function requireSitePreview(): Promise<NonNullable<SiteViewer>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: me } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (me?.role !== "admin") notFound();

  const premium3d = (await premium3dStatus()).status;
  const view = { isAdmin: true, premium3d };
  const modules = visibleCategories(view).flatMap((c) =>
    visibleModules(c, false, view).map((m) => ({ label: m.label, href: m.href, icon: m.icon })),
  );
  return { email: user.email ?? "", name: (me?.full_name as string | null) ?? "", isAdmin: true, modules };
}
