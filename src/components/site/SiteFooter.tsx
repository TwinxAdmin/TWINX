// A nyilvános lábléc (terv 11 / 3.8; 6. lépés: B arculat, terv 29): logó + egy mondat · Hogyan működik, Referenciák,
// Kapcsolat · Adatkezelési tájékoztató („Hamarosan" — a cégalapításra vár, a foglalási űrlap éles indítása előtt kell) ·
// ÁSZF · süti-beállítások · office@twinx.hu · © TWINX.
import Wordmark from "@/components/Wordmark";
import CookieSettingsLink from "@/components/analytics/CookieSettingsLink";
import { SITE_EMAIL, SITE_LINKS } from "@/lib/site";

export default function SiteFooter() {
  return (
    <footer className="border-t border-b-line bg-b-bg text-b-ink-3">
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-start justify-between gap-8 px-4 py-10 text-sm sm:px-8">
        <div className="max-w-sm">
          <Wordmark className="font-display text-2xl font-bold text-b-ink" accent="var(--color-b-accent)" />
          <p className="mt-2">TWINX · Egyedi modulok cégedre szabva.</p>
          <p className="mt-4">© {new Date().getFullYear()} TWINX</p>
        </div>
        <div className="flex flex-col gap-2">
          <a href={SITE_LINKS.how} className="hover:text-b-accent-ink">Hogyan működik</a>
          <a href={SITE_LINKS.references} className="hover:text-b-accent-ink">Referenciák</a>
          <a href={SITE_LINKS.contact} className="hover:text-b-accent-ink">Kapcsolat</a>
        </div>
        <div className="flex flex-col gap-2">
          <a href={`mailto:${SITE_EMAIL}`} className="hover:text-b-accent-ink">{SITE_EMAIL}</a>
          <span className="inline-flex items-center gap-2" aria-disabled title="A tájékoztató hamarosan elérhető.">
            Adatkezelési tájékoztató
            <span className="rounded-full bg-b-surface px-1.5 py-0.5 text-[10px] font-bold text-b-ink-2">Hamarosan</span>
          </span>
          <a href="/aszf" className="hover:text-b-accent-ink">ÁSZF</a>
          <CookieSettingsLink className="text-left hover:text-b-accent-ink" />
        </div>
      </div>
    </footer>
  );
}
