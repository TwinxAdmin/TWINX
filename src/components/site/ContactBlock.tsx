// Kapcsolatblokk (D33, D37 — terv 11 / 5. szakasz), a főoldalon és a referencia-landingen azonos.
//
// A jobb oldalon a kétlépéses időpontfoglalás (BookingForm); belépett felhasználónál név és e-mail előre kitöltve.
import BookingForm from "@/components/site/BookingForm";
import { SITE_EMAIL } from "@/lib/site";
import type { BookingSource } from "@/lib/bookings";

export default function ContactBlock({ source, prefill, bookingOpen = true }: {
  source: BookingSource; prefill?: { name?: string; email?: string };
  /** Az online foglalás élesítéséig (BOOKINGS_PUBLIC; kapu: adatkezelési tájékoztató + Resend-hitelesítés)
   *  a doboz e-mailes kapcsolatfelvételt mutat, ugyanakkora méretben. */
  bookingOpen?: boolean;
}) {
  return (
    <section id="kapcsolat" className="scroll-mt-20" style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-center sm:py-24">
        <div>
          <p className="font-display text-xs font-semibold uppercase" style={{ color: "var(--twx-coral)", letterSpacing: "0.22em" }}>
            Ingyenes felmérés
          </p>
          <h2 className="font-display mt-3 text-3xl font-semibold leading-tight sm:text-4xl">Beszéljük át, hol megy el sok időd.</h2>
          <p className="mt-4 max-w-md text-base" style={{ color: "var(--twx-on-dark-muted)" }}>
            A felmérés ingyenes, és nem kötelez semmire. Ha már van konkrét ötleted, azzal is jöhetsz;
            ha nincs, együtt megkeressük, mit érdemes egyszerűsíteni.
          </p>
          <p className="mt-6 text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>
            Inkább írnál? <a href={`mailto:${SITE_EMAIL}`} className="underline underline-offset-2 hover:text-white">{SITE_EMAIL}</a>
          </p>
        </div>

        {/* Fix méretű, kétlépéses foglaló doboz (terv 15) — élesítésig e-mailes tartalék, azonos mérettel. */}
        {bookingOpen ? <BookingForm source={source} prefill={prefill} /> : (
          <div className="flex h-[560px] flex-col rounded-3xl p-6 sm:p-8" style={{ background: "#1b1815", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-lg font-semibold">Időpontfoglalás</h3>
              <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: "rgba(255,255,255,0.1)", color: "#CFC6BB" }}>Hamarosan</span>
            </div>
            <p className="mt-3 text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>
              Az online időpontfoglalás hamarosan indul. Addig írj nekünk e-mailt: írd meg a neved, a céged és a telefonszámod,
              és visszahívunk egy időpont-egyeztetésre.
            </p>
            <div className="mt-auto">
              <a href={`mailto:${SITE_EMAIL}?subject=${encodeURIComponent("Ingyenes felmérés")}`}
                className="inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold sm:w-auto"
                style={{ background: "var(--twx-coral)", color: "#1c1005" }}>
                Írok e-mailt
              </a>
              <p className="mt-3 text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>{SITE_EMAIL}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
