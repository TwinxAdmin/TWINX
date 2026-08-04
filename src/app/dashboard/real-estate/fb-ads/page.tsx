// dashboard/real-estate/fb-ads — Facebook hirdetésszöveg-generátor.
// Egy landing page link alapján 3 stílusú, azonnal felhasználható B2C FB-hirdetésszöveg.
import ModuleIntro from "@/components/ModuleIntro";
import FbAdsGenerator from "@/components/FbAdsGenerator";

export default function FbAdsPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <ModuleIntro
        eyebrow="Ingatlan · Marketing"
        title="Facebook hirdetésszöveg"
        subtitle="Illeszd be egy ingatlanhirdetés linkjét, és kapsz 3 kész, B2C Facebook hirdetésszöveget: egy rövid és pörgőset, egy érzelmi/sztori-alapút és egy adatvezérelt, felsorolásosat — hookkal, emojikkal és CTA-val, azonnal posztolható formában."
        icon="flyer"
        chips={["Link alapján", "3 stílus", "Másolható"]}
      />
      <FbAdsGenerator />
    </main>
  );
}
