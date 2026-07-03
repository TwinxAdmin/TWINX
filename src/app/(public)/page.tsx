// twinx.hu — Landing page (wireframe)
// Hero, modulok, B2B ajánlatkérő űrlap.
import B2BForm from "@/components/B2BForm";

export default function LandingPage() {
  return (
    <main className="min-h-screen p-8 font-sans">
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <h1 className="text-2xl font-semibold">Twinx AI Portal</h1>
          <p className="mt-2 text-sm text-gray-500">
            AI Ügynökség Portál — wireframe. A prémium arculat a 7. fázisban kerül rá.
          </p>
        </header>

        <nav className="flex gap-4 text-sm underline">
          <a href="/pricing">Csomagok</a>
          <a href="/login">Belépés</a>
          <a href="/register">Regisztráció</a>
        </nav>

        <section className="border border-gray-200 p-4">
          <h2 className="font-medium">B2B ajánlatkérés — egyedi modulok</h2>
          <p className="mb-3 text-sm text-gray-500">
            Egyedi, privát AI-modulra van szükségetek? Írjátok meg, és keresünk.
          </p>
          <B2BForm />
        </section>
      </div>
    </main>
  );
}
