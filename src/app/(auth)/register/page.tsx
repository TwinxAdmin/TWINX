// (auth)/register — Regisztráció (wireframe)
// Supabase Auth (e-mail/jelszó) a 2. fázisban. Új fiók: 0 kredit.

export default function RegisterPage() {
  return (
    <main className="min-h-screen p-8 font-sans">
      <div className="mx-auto max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Regisztráció</h1>
        <div className="border border-dashed border-gray-300 p-4 text-sm text-gray-500">
          Regisztrációs űrlap placeholder — Supabase Auth (2. fázis).
        </div>
        <a href="/login" className="text-sm underline">
          Van már fiókod? Belépés
        </a>
      </div>
    </main>
  );
}
