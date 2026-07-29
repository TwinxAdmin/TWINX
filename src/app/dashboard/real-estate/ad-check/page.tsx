// dashboard/real-estate/ad-check — Hirdetés-ellenőrző.
// Egy meglévő, interneten fent lévő hirdetés SZÖVEGÉT elemzi link alapján,
// és javított változatot ad. A fotókat nem vizsgáljuk.
import ModuleIntro from "@/components/ModuleIntro";
import AdChecker from "@/components/AdChecker";

export default function AdCheckPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <ModuleIntro
        eyebrow="Ingatlan · Marketing"
        title="Hirdetés-ellenőrző"
        subtitle="Illeszd be egy meglévő hirdetésed linkjét, és megmutatjuk, min lehet javítani: mi hiányzik belőle, hol gyenge a szöveg, mit érdemes kiemelni — és kapsz egy újraírt, profibb hirdetésszöveget is."
        icon="flyer"
        chips={["Link alapján", "Pontszám", "Újraírt szöveg"]}
      />
      <AdChecker />
    </main>
  );
}
