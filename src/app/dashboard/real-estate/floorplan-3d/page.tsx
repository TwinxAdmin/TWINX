// dashboard/real-estate/floorplan-3d — „Alaprajzból bejárható 3D lakás" (PROTOTÍPUS, csak admin).
// 1. lépés: feltöltés → digitalizálás → javítás → méret-ellenőrzés. A 3D-építés a 2. lépésben jön.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { floorplan3dConfig } from "@/lib/floorplan3d/config";
import Floorplan3dStudio from "@/components/floorplan3d/Floorplan3dStudio";

export const runtime = "nodejs";

export default async function Floorplan3dPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const cfg = floorplan3dConfig();
  return (
    <Floorplan3dStudio
      tolerancePct={cfg.areaTolerancePct}
      maxUploadMb={Math.round(cfg.maxUploadBytes / 1024 / 1024)}
      creditsCreate={cfg.creditsCreate}
      creditsGeometryFix={cfg.creditsGeometryFix}
      sceneOptions={{ interiorWall: cfg.interiorWallThickness, exteriorWall: cfg.exteriorWallThickness }}
      openingCornerMin={cfg.openingCornerMin}
    />
  );
}
