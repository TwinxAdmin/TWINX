// NewHome — személyre szabott kezdőlap az ÚJ felületen (3e; terv 11 / 4. szakasz, D36; szövegek: terv 22).
//   1) Moduljaim — fix méretű kártyák, csak amihez a felhasználónak hozzáférése van
//   2) Legutóbbi munkáim — a meglévő bélyegképes sáv (RecentActivity); üresen is látszik
//   3) Irodai fiók parancsikon
//   4) Kapcsolatblokk (foglalás) — belépve név és e-mail előre kitöltve
// Üres állapot: „Még nincs modulod…" + foglalás; Besorolatlan felhasználó (nincs cége, nincs hozzáférése): terv 22 szöveg.
import ModuleIcon from "@/components/ModuleIcon";
import RecentActivity, { type ActivityItem } from "@/components/RecentActivity";
import ContactBlock from "@/components/site/ContactBlock";
import type { SiteModule } from "@/lib/site";

const UNASSIGNED_TEXT =
  "A fiókod létrejött, de még egyik céghez sincs hozzárendelve. Ha meghívót kaptál, a levélben kattints a Belépés gombra. Ha velünk dolgozol, írj: office@twinx.hu.";

export default function NewHome({ name, email, modules, unassigned, works }: {
  name: string; email: string; modules: SiteModule[]; unassigned: boolean; works: ActivityItem[];
}) {
  const first = name.trim().split(/\s+/).pop() || "";
  return (
    <main className="space-y-10">
      <header>
        <p className="font-display text-xs font-semibold uppercase" style={{ color: "#b4553a", letterSpacing: "0.2em" }}>Kezdőlap</p>
        <h1 className="font-display mt-2 text-3xl font-semibold">{first ? `Szia, ${first}!` : "Szia!"}</h1>
      </header>

      {/* 1) Moduljaim */}
      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Moduljaim</h2>
        {modules.length === 0 ? (
          <div className="twx-card flex min-h-[150px] flex-col items-start justify-center gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-sm" style={{ color: "var(--twx-ink-muted)" }}>
              {unassigned ? UNASSIGNED_TEXT : "Még nincs modulod. Foglalj ingyenes felmérést, és építünk egyet neked."}
            </p>
            <a href="#kapcsolat" className="twx-btn flex-none">Ingyenes felmérés</a>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((m) => (
              <a key={m.href} href={m.href} className="twx-card flex h-[88px] items-center gap-4 px-5 transition hover:shadow-md">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl" style={{ background: "var(--twx-dark)", color: "var(--twx-coral)" }}>
                  <ModuleIcon name={m.icon} size={20} />
                </span>
                <span className="min-w-0 truncate font-display text-[15px] font-semibold">{m.label}</span>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* 2) Legutóbbi munkáim */}
      <section>
        {works.length === 0 ? (
          <>
            <h2 className="mb-3 font-display text-xl font-semibold">Legutóbbi munkáim</h2>
            <div className="twx-card flex min-h-[96px] items-center px-6 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
              Az elkészült munkáid itt jelennek meg.
            </div>
          </>
        ) : (
          <RecentActivity items={works} topFeature={null} />
        )}
      </section>

      {/* 3) Irodai fiók parancsikon */}
      <section>
        <a href="/dashboard/iroda" className="twx-card flex min-h-[96px] items-center gap-4 px-6 transition hover:shadow-md">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl" style={{ background: "#efe7da", color: "#b4553a" }}>
            <ModuleIcon name="office" size={20} />
          </span>
          <span>
            <span className="block font-display text-[15px] font-semibold">Irodai fiók</span>
            <span className="block text-sm" style={{ color: "var(--twx-ink-muted)" }}>Közös tér, ha együtt dolgoztok: közös mappák, üzenetek, megosztott munkák.</span>
          </span>
        </a>
      </section>

      {/* 4) Kapcsolatblokk — a dashboard keretén belül lekerekítve */}
      <div className="overflow-hidden rounded-3xl">
        <ContactBlock source="kezdolap" prefill={{ name, email }} />
      </div>
    </main>
  );
}
