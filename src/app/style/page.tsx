// /style — TWINX stílus-referencia (design system egy helyen).
// Ez a designhoz szolgáló belső referencia: paletta, tipográfia, gombok, mezők, kártyák, badge-ek.
import Wordmark from "@/components/Wordmark";

type Tok = { name: string; varName: string; hex: string; onDark?: boolean };

const PALETTE: Tok[] = [
  { name: "Sötét (fejléc, hero)", varName: "--twx-dark", hex: "#12100e", onDark: true },
  { name: "Sötét 2 (mély)", varName: "--twx-dark-2", hex: "#0c0b0a", onDark: true },
  { name: "Krém (oldal háttér)", varName: "--twx-cream", hex: "#f7f3ec" },
  { name: "Krém kártya", varName: "--twx-cream-card", hex: "#fdfbf6" },
  { name: "Tinta (szöveg)", varName: "--twx-ink", hex: "#1c1815", onDark: true },
  { name: "Tinta halvány", varName: "--twx-ink-muted", hex: "#6e655c", onDark: true },
  { name: "Vonal / keret", varName: "--twx-line", hex: "#e8e1d6" },
  { name: "Korall (akcent)", varName: "--twx-coral", hex: "#ef7a5a", onDark: true },
  { name: "Korall lágy", varName: "--twx-coral-soft", hex: "#f9c9b6" },
  { name: "Világos (sötéten)", varName: "--twx-on-dark", hex: "#f4efe7" },
  { name: "Világos halvány", varName: "--twx-on-dark-muted", hex: "#a79f94", onDark: true },
];

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        {hint && <p className="mt-1 text-sm" style={{ color: "var(--twx-ink-muted)" }}>{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export default function StyleGuidePage() {
  return (
    <main className="twx-page font-sans">
      <div className="mx-auto max-w-4xl space-y-12 px-6 py-12">
        <header className="space-y-2">
          <Wordmark className="font-display text-3xl font-semibold" style={{ color: "var(--twx-ink)" }} />
          <h1 className="font-display text-4xl font-semibold">Stílus-referencia</h1>
          <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            A TWINX design rendszere egy helyen. Erre építs: a CSS-változók és a{" "}
            <code>twx-*</code> osztályok a <code>globals.css</code>-ben vannak.
          </p>
        </header>

        {/* Paletta */}
        <Section title="Színek" hint="CSS-változóként hivatkozz rájuk, pl. style={{ color: 'var(--twx-coral)' }}.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PALETTE.map((t) => (
              <div key={t.varName} className="twx-card overflow-hidden">
                <div className="h-16 w-full" style={{ background: t.hex }} />
                <div className="p-3">
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{t.varName}</p>
                  <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{t.hex}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Tipográfia */}
        <Section title="Tipográfia" hint="Címek: Clash Display (font-display). Törzs: Inter. Logó: Wordmark komponens.">
          <div className="twx-card space-y-3 p-6">
            <p className="font-display text-5xl font-semibold">Főcím — Clash Display</p>
            <p className="font-display text-3xl font-medium">Alcím / szekció</p>
            <p className="font-display text-xl font-medium">Kisebb címsor</p>
            <p className="text-base">
              Törzsszöveg Inter betűvel. A hosszabb bekezdésekhez ez a méret és sortáv ajánlott a jó
              olvashatóság érdekében.
            </p>
            <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
              Halvány segédszöveg (ink-muted) — leírások, feliratok.
            </p>
            <div className="pt-2">
              <Wordmark className="font-display text-4xl font-semibold" style={{ color: "var(--twx-ink)" }} />
            </div>
          </div>
        </Section>

        {/* Gombok */}
        <Section title="Gombok" hint="Elsődleges: .twx-btn (korall). Másodlagos: .twx-btn-outline.">
          <div className="twx-card flex flex-wrap items-center gap-3 p-6">
            <button className="twx-btn">Elsődleges</button>
            <button className="twx-btn-outline">Másodlagos</button>
            <button className="twx-btn" disabled>Letiltott</button>
            <span
              className="rounded-full px-4 py-2 text-sm font-medium"
              style={{ background: "var(--twx-coral)", color: "#1c1005" }}
            >
              Korall pill (inline)
            </span>
          </div>
        </Section>

        {/* Mezők */}
        <Section title="Mezők" hint="Minden input/textarea/select: .twx-input (korall fókusz-keret).">
          <div className="twx-card grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm">Szöveg mező</label>
              <input className="twx-input mt-1" placeholder="pl. Budapest" />
            </div>
            <div>
              <label className="block text-sm">Legördülő</label>
              <select className="twx-input mt-1">
                <option>Első opció</option>
                <option>Második opció</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm">Több soros</label>
              <textarea className="twx-input mt-1" rows={2} placeholder="Hosszabb szöveg…" />
            </div>
          </div>
        </Section>

        {/* Kártyák + felületek */}
        <Section title="Kártyák és felületek" hint=".twx-card a világos kártya; a sötét sáv a fejléc/hero hangulata.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="twx-card p-6">
              <p className="font-display text-lg font-medium">Világos kártya</p>
              <p className="mt-1 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                .twx-card — krém-kártya, meleg keret, 16px sugár.
              </p>
            </div>
            <div className="rounded-2xl p-6" style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
              <p className="font-display text-lg font-medium">Sötét felület</p>
              <p className="mt-1 text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>
                Fejléc / hero hangulat, korall akcenttel.
              </p>
            </div>
          </div>
        </Section>

        {/* Badge-ek + státuszszínek */}
        <Section title="Címkék és státuszok" hint="Pill: .twx-badge / .twx-badge-muted. Státuszszínek: zöld / borostyán / piros.">
          <div className="twx-card flex flex-wrap items-center gap-3 p-6">
            <span className="twx-badge">Kiemelt</span>
            <span className="twx-badge-muted twx-badge">Hamarosan</span>
            <span className="text-sm text-green-700">Sikeres</span>
            <span className="text-sm text-amber-600">Függőben</span>
            <span className="text-sm text-red-600">Hiba</span>
          </div>
        </Section>

        <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          Tipp: új elem építésekor előbb nézd meg, van-e rá <code>twx-*</code> osztály vagy változó —
          így minden konzisztens marad. Új közös elemet a <code>globals.css</code>-be tegyél.
        </p>
      </div>
    </main>
  );
}
