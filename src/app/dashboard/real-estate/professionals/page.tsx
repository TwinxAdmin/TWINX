// dashboard/real-estate/professionals — Szakember-kereső (ingatlan).
// Perplexity élő webes kutatással keres ingatlanközvetítőt, ügyvédet, energetikust,
// kivitelezőt stb. a partner gazdag szűrői szerint, forrásmegjelöléssel és elérhetőséggel.
"use client";

import ModuleIntro from "@/components/ModuleIntro";
import ProfessionalFinder from "@/components/ProfessionalFinder";

export default function RealEstateProfessionalsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <ModuleIntro
        eyebrow="Ingatlan · Szakemberek"
        title="Szakember-kereső"
        subtitle="Ingatlanközvetítő, ügyvéd, energetikai tanúsító, értékbecslő, fotós, kivitelező vagy statikus — add meg pontosan, kit keresel és milyen feltételekkel (akár kamarai jogosultsággal), a Twinx élő webes kutatással összeszedi a szakembereket, forrásmegjelöléssel és elérhetőséggel. A végén letölthető PDF, benne kész megkereső üzenettel."
        icon="pro"
        chips={["Közvetítőtől a statikusig", "Jogosultság-szűrés", "Kész megkereső üzenet"]}
      />
      <ProfessionalFinder industry="realestate" />
    </main>
  );
}
