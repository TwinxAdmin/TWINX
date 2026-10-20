// dashboard/real-estate/floorplan-3d — „Alaprajzból bejárható 3D lakás" (Prémium 3D).
// ADMIN: a teljes modul (fejlesztés, teszt). MÁS (és az admin „így látja a partner" nézetben): az állapot szerint
//   Rejtett → vissza a Portál Központba; Hamarosan / (Elérhető — még nincs bekötve) → „Hamarosan érkezik" sáv + bemutató.
// A 3D API-k szerveroldalon is csak adminnak futnak (generálás, kredit) — lásd lib/premium3d.ts.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { floorplan3dConfig } from "@/lib/floorplan3d/config";
import { loadStyleSheet } from "@/lib/floorplan3d/stylesheet";
import Floorplan3dStudio from "@/components/floorplan3d/Floorplan3dStudio";
import Premium3dComingSoon from "@/components/floorplan3d/Premium3dComingSoon";
import { resolveViewContext } from "@/lib/view-as";
import { isOnWaitlist, premium3dStatus } from "@/lib/premium3d";

export const runtime = "nodejs";

export default async function Floorplan3dPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const view = await resolveViewContext(me?.role as string | undefined);

  const cfg = floorplan3dConfig();
  // a teszt időszakban csak a japandi (a stíluslap a referenciaképek mellől: references/japandi/stiluslap.json)
  const style = await loadStyleSheet("japandi");
  if (view.role !== "admin") {
    const { status } = await premium3dStatus();
    if (status === "hidden") redirect("/dashboard");
    return (
      <Premium3dComingSoon
        opts={{ interiorWall: cfg.interiorWallThickness, exteriorWall: cfg.exteriorWallThickness }}
        style={"sheet" in style ? style.sheet : null}
        subscribed={await isOnWaitlist(user.id)}
      />
    );
  }
  return (
    <Floorplan3dStudio
      tolerancePct={cfg.areaTolerancePct}
      maxUploadMb={Math.round(cfg.maxUploadBytes / 1024 / 1024)}
      creditsCreate={cfg.creditsCreate}
      creditsGeometryFix={cfg.creditsGeometryFix}
      sceneOptions={{ interiorWall: cfg.interiorWallThickness, exteriorWall: cfg.exteriorWallThickness }}
      openingCornerMin={cfg.openingCornerMin}
      styleSheet={"sheet" in style ? style.sheet : null}
      styleError={"error" in style ? style.error : null}
      linkDays={cfg.linkDays}
      creditsExtend={cfg.creditsExtend}
      autoTour={me?.role !== "admin"}
    />
  );
}
