// dashboard/hospitality/suppliers — Beszállító-kereső (önálló modul).
// Perplexity élő webes kutatással keres alapanyag-termelőket, nagykereskedőket és
// piacokat a partner környékén, forrásmegjelöléssel és elérhetőséggel.
// A kredit a találatszám szerint skálázódik; a korábbi keresések ingyen visszanézhetők.
"use client";

import { useEffect, useState } from "react";
import ModuleIntro from "@/components/ModuleIntro";
import Skeleton from "@/components/motion/Skeleton";
import SupplierFinder from "@/components/hospitality/SupplierFinder";

export default function SuppliersPage() {
  const [ingredientNames, setIngredientNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // A saját alapanyagok neveit felkínáljuk a keresőmezőben (gyorsabb indulás).
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/hospitality/ingredients");
        const data = await res.json();
        if (res.ok) setIngredientNames((data.ingredients ?? []).map((i: { name: string }) => i.name));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <ModuleIntro
        eyebrow="Vendéglátás · Beszerzés"
        title="Beszállító-kereső"
        subtitle="Add meg, mit keresel és hol — a Twinx élő webes kutatással összeszedi a beszállítókat elérhetőséggel és forrással, a végén letölthető PDF-fel és kész megkereső üzenettel. Kereshetsz belföldön (környékbeli termelők, nagykerek, piacok) vagy külföldön az EU-ban (import, a célország nyelvén, magyar+angol megkereséssel)."
        icon="supplier"
        chips={["Belföld és EU-import", "Elérhetőségekkel", "Kész megkereső üzenet"]}
      />

      {loading ? (
        <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}</div>
      ) : (
        <SupplierFinder ingredientNames={ingredientNames} />
      )}
    </main>
  );
}
