// dashboard/real-estate/visualization — Ingatlan Látványtervező (wireframe)
// 5. fázis: drag-and-drop képfeltöltés + stílus opciók → Image reference / Image-to-Image
// logika → kész kép + letöltés → 1 kredit → usage_history (LIMIT 50).

export default function VisualizationPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Ingatlan Látványtervező</h1>
      <div className="border border-dashed border-gray-300 p-4 text-sm text-gray-500">
        Drag-and-drop feltöltő + stílusválasztó placeholder (5. fázis).
      </div>
      <div className="border border-dashed border-gray-300 p-4 text-sm text-gray-500">
        Előzmények (top 50) placeholder.
      </div>
    </main>
  );
}
