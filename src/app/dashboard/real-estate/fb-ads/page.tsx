// dashboard/real-estate/fb-ads — Facebook hirdetésszöveg-generátor.
// Egy landing page link alapján 3 stílusú, azonnal felhasználható B2C FB-hirdetésszöveg.
import ModuleIntro from "@/components/ModuleIntro";
import FbAdsGenerator from "@/components/FbAdsGenerator";

export default function FbAdsPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <ModuleIntro
        eyebrow="Ingatlan · Marketing"
        title="Hirdetésszöveg generátor"
        subtitle="Illeszd be egy ingatlanhirdetés linkjét, és kapsz kész hirdetésszövegeket. Facebook: 3 stílusú B2C poszt (rövid, sztori-alapú, felsorolásos). Google Ads: egy azonnal a Google Ads Editorba importálható CSV — Search kampány, 10 kulcsszavas sor és RSA-szövegek a karakterkorlátokkal."
        icon="flyer"
        chips={["Link alapján", "Facebook + Google Ads", "Másolható"]}
      />
      <FbAdsGenerator />
    </main>
  );
}
