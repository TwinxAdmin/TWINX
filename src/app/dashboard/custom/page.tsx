// dashboard/custom — Privát B2B modulok (wireframe)
// Szigorú szerepkör- és company_access-gátolt elérés (6. fázisban élesítjük az útvonalvédelmet).

export default function CustomModulesPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Egyedi B2B modulok</h1>
      <div className="border border-dashed border-gray-300 p-4 text-sm text-gray-500">
        Csak jóváhagyott user_id-k (company_access) számára látható. Útvonalvédelem: 6. fázis.
      </div>
    </main>
  );
}
