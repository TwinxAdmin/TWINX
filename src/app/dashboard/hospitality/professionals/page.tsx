// dashboard/hospitality/professionals — Szakember-kereső (vendéglátás).
// Perplexity élő webes kutatással keres séfet, felszolgálót, HACCP-tanácsadót stb.
// a partner gazdag szűrői szerint, forrásmegjelöléssel és elérhetőséggel.
"use client";

import ModuleIntro from "@/components/ModuleIntro";
import ProfessionalFinder from "@/components/ProfessionalFinder";

export default function HospitalityProfessionalsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <ModuleIntro
        eyebrow="Vendéglátás · Szolgáltatók"
        title="Szakember-kereső"
        subtitle="HACCP-tanácsadó, vendéglátós könyvelő, konyhagép-szerviz, takarító- és mosodai szolgáltató vagy marketinges — olyan cégek és szolgáltatók, akiknek nyilvános elérhetőségük van az interneten. A Twinx élő webes kutatással összeszedi a környékbeli szolgáltatókat, forrásmegjelöléssel és elérhetőséggel, a végén letölthető PDF-ben, kész megkereső üzenettel. Egyéni pozíciókat (séf, szakács, pincér…) a külön Toborzás fülön kezelünk."
        icon="pro"
        chips={["Online elérhető szolgáltatók", "Gazdag szűrés", "Kész megkereső üzenet"]}
      />
      <ProfessionalFinder industry="hospitality" />
    </main>
  );
}
