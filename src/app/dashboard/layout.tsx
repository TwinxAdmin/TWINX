// dashboard/layout.tsx — Központi navigáció + kredit egyenlegek (wireframe)
// A védett route-ok middleware/auth ellenőrzése a 2. fázisban.

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen font-sans">
      <header className="flex items-center justify-between border-b border-gray-200 p-4">
        <a href="/dashboard" className="font-semibold">
          Twinx Portál
        </a>
        <nav className="flex gap-4 text-sm underline">
          <a href="/dashboard/real-estate/valuation">Értékbecslő</a>
          <a href="/dashboard/real-estate/visualization">Látványtervező</a>
          <a href="/dashboard/custom">Egyedi modulok</a>
        </nav>
        <div className="text-sm text-gray-500">Kredit: — (placeholder)</div>
      </header>
      <div className="p-6">{children}</div>
    </div>
  );
}
