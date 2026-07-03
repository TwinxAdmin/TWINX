// dashboard/real-estate/valuation — Ingatlan Értékbecslő (wireframe)
// 4. fázis: kötelező mezők (Város/Kerület, Négyzetméter, Szobák, Állapot) →
// backend validáció → Perplexity Sonar → PDF → Supabase Storage → 1 kredit → usage_history.

export default function ValuationPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Ingatlan Értékbecslő</h1>
      <div className="border border-dashed border-gray-300 p-4 text-sm text-gray-500">
        Értékbecslő űrlap placeholder (4. fázis).
      </div>
      <div className="border border-dashed border-gray-300 p-4 text-sm text-gray-500">
        Előzmények (top 50) placeholder.
      </div>
    </main>
  );
}
