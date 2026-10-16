// dashboard/real-estate/floorplan-3d/bemutato — IDEIGLENES előnézet (csak admin): a bemutató valódi 3D bejárás-jelenete
// (IntroWalkthrough) a mintalakáson, abban a méretben, ahogy a bemutatóban és nagyban is megjelenik. A bemutató beépítése után törölhető.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { floorplan3dConfig } from "@/lib/floorplan3d/config";
import { loadStyleSheet } from "@/lib/floorplan3d/stylesheet";
import IntroWalkthrough from "@/components/floorplan3d/intro/IntroWalkthrough";

export const runtime = "nodejs";

export default async function IntroPreviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const cfg = floorplan3dConfig();
  const style = await loadStyleSheet("japandi");
  const opts = { interiorWall: cfg.interiorWallThickness, exteriorWall: cfg.exteriorWallThickness };
  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8">
      <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#A8411F]">Előnézet · csak admin</p>
      <h1 className="font-[Manrope] text-[26px] font-extrabold">Bemutató — valódi 3D bejárás (5. jelenet)</h1>
      <p className="mt-1 text-[13px] text-[#6E655C]">A mintalakás a modul saját 3D-motorján, előre megírt kameraúttal; végtelenítve ismétlődik.</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[440px_1fr]">
        <div>
          <p className="mb-2 text-[12px] font-semibold text-[#6E655C]">A bemutatóban (kb. 440 × 360)</p>
          <div className="h-[360px] w-[440px] max-w-full"><IntroWalkthrough opts={opts} style={"sheet" in style ? style.sheet : null} credits={cfg.creditsCreate} /></div>
        </div>
        <div>
          <p className="mb-2 text-[12px] font-semibold text-[#6E655C]">Nagyban (főoldal, széles képernyő)</p>
          <div className="aspect-video w-full"><IntroWalkthrough opts={opts} style={"sheet" in style ? style.sheet : null} credits={cfg.creditsCreate} /></div>
        </div>
      </div>
    </main>
  );
}
