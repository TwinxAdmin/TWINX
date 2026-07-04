// twinx.hu — Landing page (wireframe)
// Hero, modulok, B2B ajánlatkérő űrlap, moderált ötletláda.
import B2BForm from "@/components/B2BForm";
import IdeaForm from "@/components/IdeaForm";
import { getApprovedIdeas } from "@/lib/ideas";

export const runtime = "nodejs";

export default async function LandingPage() {
  const ideas = await getApprovedIdeas(50);

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

        <section className="border border-gray-200 p-4">
          <h2 className="font-medium">Ötletláda</h2>
          <p className="mb-3 text-sm text-gray-500">
            Van egy jó ötleted egy új funkcióhoz vagy modulhoz? Küldd be! A beküldött
            ötletek moderálás után itt jelennek meg.
          </p>
          <IdeaForm />

          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-medium">Közösségi ötletek</h3>
            {ideas.length === 0 ? (
              <p className="text-sm text-gray-500">
                Még nincs jóváhagyott ötlet — legyél te az első!
              </p>
            ) : (
              <ul className="space-y-2">
                {ideas.map((idea) => (
                  <li key={idea.id} className="border border-gray-100 p-3 text-sm">
                    <p className="whitespace-pre-wrap">{idea.content}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      — {idea.authorName || "Névtelen"} ·{" "}
                      {new Date(idea.createdAt).toLocaleDateString("hu-HU")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
