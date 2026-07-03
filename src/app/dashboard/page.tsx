// dashboard/page.tsx — Portál Központ (wireframe)
// Elérhető és megvásárolható modulok listája. Kredit lekérés + előzmény panel a 2. fázisban.

export default function DashboardHome() {
  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">Portál Központ</h1>

      <section>
        <h2 className="font-medium">Elérhető modulok</h2>
        <div className="mt-2 border border-dashed border-gray-300 p-4 text-sm text-gray-500">
          Modul lista placeholder (services + user_credits lekérés — 2. fázis).
        </div>
      </section>

      <section>
        <h2 className="font-medium">Legutóbbi tevékenység (max. 50)</h2>
        <div className="mt-2 border border-dashed border-gray-300 p-4 text-sm text-gray-500">
          usage_history üres panel — LIMIT 50.
        </div>
      </section>
    </main>
  );
}
