// twinx.hu/pricing — Csomagvásárlás (wireframe)
// Fix áras 10-es kredit csomagok modulonként. Stripe Checkout a 3. fázisban.

export default function PricingPage() {
  return (
    <main className="min-h-screen p-8 font-sans">
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold">Csomagok</h1>
        <p className="text-sm text-gray-500">
          10 generálási lehetőség / csomag. A kreditek nem járnak le. (Stripe: 3. fázis)
        </p>
        <div className="border border-dashed border-gray-300 p-4 text-sm text-gray-500">
          Csomaglista placeholder.
        </div>
      </div>
    </main>
  );
}
