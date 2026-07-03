// Perplexity (Sonar) hívás az Ingatlan Értékbecslőhöz.
// A prompt a partner bevált eszközéből származik (szó szerint). Üres mező -> "[Nincs megadva]".
import type { ValuationInput } from "@/lib/valuation";

function v(value: string): string {
  const t = String(value ?? "").trim();
  return t.length > 0 ? t : "[Nincs megadva]";
}

export function buildValuationPrompt(input: ValuationInput): string {
  return `Bújj egy tapasztalt, adatalapú ingatlanpiaci szakértő szerepébe. Száraz, tényszerű, strukturált elemzést várok tőled. A válaszodban NE utalj a szemléletedre, a stílusodra, és ne használj olyan kifejezéseket a saját elemzésedre, mint "reális", "óvatos" vagy "pesszimista" – csak a tiszta adatokat és a végeredményt add meg a kért formátumban. Ne írj felesleges körítést vagy bevezetőt.

Feladat: Készíts ingatlan-értékbecslést az alábbi paraméterekkel rendelkező ingatlanról.

Keresési és elemzési instrukciók (ezt a háttérben végezd el):
1. LOKÁCIÓ ÉS KERESÉS: Az összehasonlító ingatlanok felkutatásakor szigorúan tartsd be az alábbi földrajzi szabályokat:
   - Ha Budapest: Csak és kizárólag az adott kerületen belül keress.
   - Ha Pest megye (vagy egyéb agglomeráció/vidék): Csak az adott települést és a közvetlenül szomszédos településeket veheted figyelembe.
   - Mikrolokáció ellenőrzés: Ha meg van adva városrész és utca, a háttérben többszörösen ellenőrizd le, hogy a megadott utca valóban abba a városrészbe esik-e. Az összehasonlításhoz csak azonos megítélésű és árfekvésű városrészből hozz példákat.
2. ELEMZÉS: A háttérben vizsgálj meg pontosan tizenöt darab (15 db) releváns összehasonlító ingatlant (semmiképp se téveszd össze a darabszámot Budapest 15. kerületével!).
3. ÁRELLENŐRZÉS: Első lépésként vizsgáld meg a kapott árakat. Zárd ki az irreálisan magas vagy alacsony (outlier) hirdetéseket. Ha a megmaradt adatokból számolt átlagár jelentősen eltér a normál piaci trendektől, futtasd le újra a keresést és finomítsd a számítást a legtisztább adatok alapján.

Az értékelt ingatlan adatai:
- Település, kerület/környék: ${v(input.telepules)}
- Pontosabb helyszín/utca: ${v(input.utca)}
- Típus: ${v(input.tipus)}
- Méret (lakóterület): ${v(input.meret)}
- Telek terület: ${v(input.telek)}
- Szintek száma / Épület szintje: ${v(input.szint)}
- Szobák száma: ${v(input.szobak)}
- Fürdőszobák/mellékhelyiségek száma: ${v(input.furdok)}
- Építés éve: ${v(input.epitesEve)}
- Szerkezet: ${v(input.szerkezet)}
- Műszaki és esztétikai állapot: ${v(input.allapot)}
- Fűtésrendszer és energetika: ${v(input.futes)}
- Jogi háttér / Tulajdoni viszonyok: ${v(input.jogi)}
- Egyéb főbb jellemzők/extrák: ${v(input.egyeb)}

Kimeneti struktúra (kérlek, SZIGORÚAN ezt a formát kövesd, rövid, vázlatpontos formában):

1. RÖVID ÖSSZEFOGLALÓ: (2-3 mondat a lokáció aktuális piaci helyzetéről).
2. 5 DB HASONLÓ INGATLAN: (Az elemzett 15 darabból a legrelevánsabb 5 darab listája. Tartalmazza: méret, állapot, irányár, becsült eladási idő).
3. PIACI ÁR: (HUF)
4. ÁTLAGOS NÉGYZETMÉTERÁR: (HUF/nm)
5. GYORS ELADÁSI ÁR: (Az az ár, amin 2-3 hónapon belül biztosan likvidálható, HUF).
6. VÁRHATÓ ELADÁSI IDŐ: (Hónapban megadva, normál piaci áron).
7. SWOT-ANALÍZIS: (Csak tömör kulcsszavas felsorolás a 4 ponthoz).
8. ÖSSZEGZÉS: (1-2 mondatos tényszerű konklúzió az eladhatóságról).`;
}

export async function runValuation(input: ValuationInput): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("Hiányzó PERPLEXITY_API_KEY.");

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [{ role: "user", content: buildValuationPrompt(input) }],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Perplexity hiba (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Üres válasz a Perplexity API-tól.");
  return content as string;
}
