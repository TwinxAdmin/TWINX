// /3d/<token> — megosztott bejárás (4. lépés, F4b). NYILVÁNOS: belépés nélkül nyílik, a token kitalálhatatlan (lib/floorplan3d/shares.ts).
// A jóváhagyott terv + a lakás berendezése (ugyanaz, mint a stúdióban), szemmagasságból bejárható. Lejárt / visszavont / ismeretlen
// linknél érthető üzenet. A keresők nem indexelik.
import type { Metadata } from "next";
import Wordmark from "@/components/Wordmark";
import WalkthroughViewer from "@/components/floorplan3d/WalkthroughViewer";
import { publicShare } from "@/lib/floorplan3d/shares";
import { floorplan3dConfig } from "@/lib/floorplan3d/config";
import { loadStyleSheet } from "@/lib/floorplan3d/stylesheet";
import { apartmentFurniture } from "@/lib/floorplan3d/furniture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "3D bejárás — TWINX",
  description: "Méretarányos 3D-bejárás a lakás alaprajzából.",
  robots: { index: false, follow: false },
};

const MESSAGES = {
  expired: { title: "Ez a link lejárt", text: "A bejárás már nem érhető el ezen a linken. Kérj új linket attól, aki küldte." },
  revoked: { title: "Ez a link már nem él", text: "A link küldője visszavonta a megosztást. Kérj új linket attól, aki küldte." },
  missing: { title: "Nincs ilyen bejárás", text: "Ellenőrizd, hogy a teljes linket másoltad-e be." },
} as const;

export default async function SharedWalkthroughPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await publicShare(token, true);

  if (share.state !== "ok") {
    const m = MESSAGES[share.state];
    return (
      <main className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--twx-cream)" }}>
        <div className="twx-card w-full max-w-[420px] p-8 text-center">
          <Wordmark className="mb-6 block font-display text-2xl font-bold tracking-tight" />
          <h1 className="font-display text-xl font-semibold">{m.title}</h1>
          <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>{m.text}</p>
        </div>
      </main>
    );
  }

  const cfg = floorplan3dConfig();
  const style = await loadStyleSheet("japandi");
  return (
    <WalkthroughViewer
      plan={share.plan}
      opts={{ interiorWall: cfg.interiorWallThickness, exteriorWall: cfg.exteriorWallThickness }}
      style={"sheet" in style ? style.sheet : null}
      furniture={apartmentFurniture(share.plan, share.furnishing)}
      title={share.title}
    />
  );
}
