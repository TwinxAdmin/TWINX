// (auth)/login — Belépés (wireframe)
// Supabase Auth (e-mail/jelszó) a 2. fázisban.

export default function LoginPage() {
  return (
    <main className="min-h-screen p-8 font-sans">
      <div className="mx-auto max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Belépés</h1>
        <div className="border border-dashed border-gray-300 p-4 text-sm text-gray-500">
          Login űrlap placeholder — Supabase Auth (2. fázis).
        </div>
        <a href="/register" className="text-sm underline">
          Nincs fiókod? Regisztráció
        </a>
      </div>
    </main>
  );
}
