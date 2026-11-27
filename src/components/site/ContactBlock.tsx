// Kapcsolatblokk (D33, D37 — terv 11 / 5. szakasz), a főoldalon, a referencia-landingen és a kezdőlapon azonos.
// 8. lépés (D73): BOOKING_MODE = "callback" esetén a foglaló űrlap helyén a CallbackPanel (e-mail + Másolás) áll.
// 6. lépés (B arculat, terv 29 / 4.): korall „selyem" sáv (globals.css: .b-contact-silk); jobb oldalon a meglévő kétlépéses időpontfoglalás (BookingForm,
// világos változat). Belépett felhasználónál név és e-mail előre kitöltve. A foglalás logikája változatlan.
import BookingForm from "@/components/site/BookingForm";
import CallbackPanel from "@/components/site/CallbackPanel";
import { BOOKING_MODE } from "@/lib/booking-mode";
import SilkRibbons from "@/components/site/b/SilkRibbons";
import { SITE_EMAIL } from "@/lib/site";
import type { BookingSource } from "@/lib/bookings";

export default function ContactBlock({ source, prefill, bookingOpen = true, inset = false }: {
  source: BookingSource; prefill?: { name?: string; email?: string };
  /** Az online foglalás élesítéséig (BOOKINGS_PUBLIC; kapu: adatkezelési tájékoztató + Resend-hitelesítés)
   *  a doboz e-mailes kapcsolatfelvételt mutat, ugyanakkora méretben. */
  bookingOpen?: boolean;
  /** Beágyazva (a kezdőlapon): a szülő keret adja a szélességet és a térközt. */
  inset?: boolean;
}) {
  return (
    <section id="kapcsolat" className={inset ? "w-full scroll-mt-24 pb-6" : "mx-auto w-full max-w-[1100px] scroll-mt-24 px-4 pb-20 sm:px-8"}>
      <div className="b-contact-silk relative grid grid-cols-1 gap-8 overflow-hidden rounded-[28px] p-6 text-white [&>*]:min-w-0 sm:p-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:items-center lg:p-12">
        {/* Hangulat: krémfehér selyemszalagok a sáv alján, a szöveg és az űrlap mögött (csak díszítés). */}
        <SilkRibbons tone="accent" heightClass="h-[220px] sm:h-[280px]" />
        <div className="relative">
          <p className="text-[13px] uppercase tracking-[1.6px] text-white">Ingyenes felmérés</p>
          <h2 className="font-display mt-3 text-[30px] font-bold leading-tight tracking-[-0.6px] sm:text-[38px]">Foglalj ingyenes felmérést.</h2>
          {BOOKING_MODE === "callback" ? (
            // D73: ideiglenes visszahívás-kérés (telefonszámot Márk kérésére nem teszünk ki)
            <p className="mt-3 max-w-md text-[17px] leading-relaxed text-white">
              Válaszd ki, melyik három hétköznap hívhatunk. A kollégáink felhívnak, és megbeszéljük, mikor beszélgessünk
              személyesen vagy online, hogy bővebben bemutassuk, mit tud egy egyedi modul a cégednek. Ha tetszik, utána jön
              a részletes felmérés. Ingyenes, és nem kötelez semmire.
            </p>
          ) : (
            <>
              <p className="mt-3 max-w-md text-[17px] leading-relaxed text-white">
                Válassz időpontot, add meg az adataidat, és végigbeszéljük, hol tudunk időt spórolni neked.
                A felmérés ingyenes, és nem kötelez semmire.
              </p>
              <p className="mt-6 text-sm text-white">
                Inkább írnál? <a href={`mailto:${SITE_EMAIL}`} className="font-semibold underline underline-offset-2">{SITE_EMAIL}</a>
              </p>
            </>
          )}
          {/* Átvezetés a Kapcsolat oldalra (telefon, chat, üzenet) — „selymes", áttetsző gomb (Márk kérése 2026-11-24). */}
          <a href="/kapcsolat" className="b-silk-btn mt-4">Minden elérhetőség →</a>
        </div>

        {/* Fix méretű, kétlépéses foglaló doboz (terv 15) — élesítésig e-mailes tartalék, azonos mérettel. */}
        {BOOKING_MODE === "callback" ? <CallbackPanel prefill={prefill} /> : bookingOpen ? <div className="relative"><BookingForm source={source} prefill={prefill} tone="light" /></div> : (
          <div className="relative flex h-[560px] flex-col rounded-3xl border border-b-line bg-b-card p-6 text-b-ink sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-lg font-semibold">Időpontfoglalás</h3>
              <span className="rounded-full bg-b-surface px-2.5 py-1 text-xs font-semibold text-b-ink-2">Hamarosan</span>
            </div>
            <p className="mt-3 text-sm text-b-ink-2">
              Az online időpontfoglalás hamarosan indul. Addig írj nekünk e-mailt: írd meg a neved, a céged és a telefonszámod,
              és visszahívunk egy időpont-egyeztetésre.
            </p>
            <div className="mt-auto">
              <a href={`mailto:${SITE_EMAIL}?subject=${encodeURIComponent("Ingyenes felmérés")}`} className="b-btn w-full sm:w-auto">
                Írok e-mailt
              </a>
              <p className="mt-3 text-sm text-b-ink-2">{SITE_EMAIL}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
