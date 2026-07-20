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
        eyebrow="Vendéglátás · Csapat"
        title="Szakember-kereső"
        subtitle="Séf, szakács, felszolgáló, cukrász, HACCP-tanácsadó, könyvelő vagy szerviz — add meg pontosan, kit keresel és milyen feltételekkel, a Twinx élő webes kutatással összeszedi a környékbeli szakembereket, forrásmegjelöléssel és elérhetőséggel. A végén letölthető PDF, benne kész megkereső üzenettel."
        icon="pro"
        chips={["Séftől a szervizig", "Gazdag szűrés", "Kész megkereső üzenet"]}
      />
      <ProfessionalFinder industry="hospitality" />
    </main>
  );
}
