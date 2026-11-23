// Kapcsolatblokk (D33, D37 — terv 11 / 5. szakasz), a főoldalon és a referencia-landingen azonos.
//
// A jobb oldalon a kétlépéses időpontfoglalás (BookingForm); belépett felhasználónál név és e-mail előre kitöltve.
import BookingForm from "@/components/site/BookingForm";
import { SITE_EMAIL } from "@/lib/site";
import type { BookingSource } from "@/lib/bookings";

export default function ContactBlock({ source, prefill }: { source: BookingSource; prefill?: { name?: string; email?: string } }) {
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

        {/* Fix méretű, kétlépéses foglaló doboz (terv 15). */}
        <BookingForm source={source} prefill={prefill} />
      </div>
    </section>
  );
}
