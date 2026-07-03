// Perplexity (Sonar) hívás az Ingatlan Értékbecslőhöz.
import type { ValuationInput } from "@/lib/valuation";

export function buildValuationPrompt(input: ValuationInput): string {
  return [
    "Készíts részletes ingatlan értékbecslést a következő ingatlanról a jelenlegi magyar piaci viszonyok alapján:",
    `- Elhelyezkedés: ${input.city}`,
    `- Alapterület: ${input.squareMeters} m²`,
    `- Szobák száma: ${input.rooms}`,
    `- Állapot: ${input.condition}`,
    "",
    "A válaszban térj ki:",
    "1. Becsült piaci érték forintban (tól-ig tartomány).",
    "2. Becsült négyzetméterár (Ft/m²).",
    "3. Az árat befolyásoló főbb tényezők rövid indoklása.",
    "4. Rövid piaci kitekintés az adott környékre.",
    "",
    "Válaszolj magyarul, közérthetően, tagolt szöveggel.",
  ].join("\n");
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
      messages: [
        {
          role: "system",
          content:
            "Tapasztalt magyar ingatlanpiaci szakértő vagy. Reális, adatvezérelt értékbecslést adsz a magyar piac alapján. Ne találj ki konkrét hirdetéseket.",
        },
        { role: "user", content: buildValuationPrompt(input) },
      ],
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
