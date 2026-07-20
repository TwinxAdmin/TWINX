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
        subtitle="A legtöbb étterem azért fizet túl az alapanyagért, mert nincs ideje beszállítót keresni. Add meg, mit keresel és hol — a Twinx élő webes kutatással összeszedi a környékbeli termelőket, nagykereskedőket és piacokat, forrásmegjelöléssel és elérhetőséggel. A végén kapsz egy letölthető PDF-et, benne egy kész megkereső üzenettel, amit csak el kell küldened."
        icon="supplier"
        chips={["Környékbeli termelők", "Elérhetőségekkel", "Kész megkereső üzenet"]}
      />

      {loading ? (
        <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}</div>
      ) : (
        <SupplierFinder ingredientNames={ingredientNames} />
      )}
    </main>
  );
}
