// A Prémium 3D modul saját bemutatója (ModuleTour, preview mód) nyilvános oldalra ágyazva.
// A 3D-motor csak itt, kliensen töltődik be (dinamikus import) — ugyanúgy, mint a Premium3dComingSoon nézetben.
"use client";

import dynamic from "next/dynamic";
import type { SceneOptions } from "@/lib/floorplan3d/scene";
import type { StyleSheet } from "@/lib/floorplan3d/stylesheet";

const ModuleTour = dynamic(() => import("@/components/floorplan3d/intro/ModuleTour"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[560px] items-center justify-center rounded-[28px] text-sm" style={{ background: "#14110f", color: "#BDB3A7" }}>
      A bemutató betöltése…
    </div>
  ),
});

export default function PremiumTourEmbed({ opts, style }: { opts: SceneOptions; style: StyleSheet | null }) {
  return <ModuleTour opts={opts} style={style} preview />;
}
