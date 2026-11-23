// Az új nyilvános lábléc (terv 11 / 3.8): logó + egy mondat · Hogyan működik, Referenciák, Kapcsolat ·
// Adatkezelési tájékoztató („Hamarosan" — a cégalapításra vár, a foglalási űrlap éles indítása előtt kell) ·
// office@twinx.hu · © TWINX.
import Wordmark from "@/components/Wordmark";
import CookieSettingsLink from "@/components/analytics/CookieSettingsLink";
import { SITE_EMAIL, SITE_LINKS } from "@/lib/site";

export default function SiteFooter() {
  const muted = { color: "var(--twx-on-dark-muted)" };
  return (
    <footer style={{ background: "var(--twx-dark-2)", color: "var(--twx-on-dark)" }}>
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="max-w-sm">
            <Wordmark className="font-display text-3xl font-semibold" />
            <p className="mt-3 text-sm" style={muted}>A TWINX a cégedre szabott modult épít, egy ingyenes felmérés után.</p>
          </div>
          <div className="flex flex-col gap-2 text-sm" style={muted}>
            <a href={SITE_LINKS.how} className="hover:text-white">Hogyan működik</a>
            <a href={SITE_LINKS.references} className="hover:text-white">Referenciák</a>
            <a href={SITE_LINKS.contact} className="hover:text-white">Kapcsolat</a>
          </div>
          <div className="flex flex-col gap-2 text-sm" style={muted}>
            <a href={`mailto:${SITE_EMAIL}`} className="hover:text-white">{SITE_EMAIL}</a>
            <span className="inline-flex items-center gap-2" aria-disabled title="A tájékoztató hamarosan elérhető.">
              Adatkezelési tájékoztató
              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "rgba(255,255,255,0.1)", color: "#CFC6BB" }}>Hamarosan</span>
            </span>
            <a href="/aszf" className="hover:text-white">ÁSZF</a>
            <CookieSettingsLink className="text-left hover:text-white" />
          </div>
        </div>
        <p className="mt-10 border-t pt-6 text-xs" style={{ ...muted, borderColor: "rgba(255,255,255,0.08)" }}>© {new Date().getFullYear()} TWINX</p>
      </div>
    </footer>
  );
}
