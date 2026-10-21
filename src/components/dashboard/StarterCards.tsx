// „Ezzel kezdd" — 3 kiemelt modul VALÓDI eredménnyel (design/portal-vegleges.html, A rész).
// Csak annak látszik, aki még nem készített 3 munkát; utána a „Folytasd, ahol abbahagytad" sáv veszi át.
//   Képjavító   → mozgó előtte–utána (a csúszka magától jár)
//   Hirdetéskép → kész minta a saját motorunkkal
//   Értékbecslés → minta-riport („MINTA" jelöléssel)
import Link from "next/link";
import Image from "next/image";
import { STARTERS, type StarterItem } from "@/lib/onboarding";
import { ReportMock } from "@/components/dashboard/inspiration/slides";

const TAG = "absolute top-2.5 rounded-md px-2 py-1 text-[10px] font-bold tracking-[0.12em] text-white";

function Visual({ id }: { id: StarterItem["id"] }) {
  if (id === "enhance") {
    return (
      <>
        <Image src="/showcase/enhance-before.jpg" alt="" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />
        <Image src="/showcase/enhance-after.jpg" alt="" fill sizes="(max-width: 640px) 100vw, 33vw" className="twx-starter-after object-cover" />
        <span aria-hidden className="twx-starter-bar" />
        <span className={`${TAG} left-2.5`} style={{ background: "rgba(20,18,16,.72)" }}>ELŐTTE</span>
        <span className={`${TAG} right-2.5`} style={{ background: "#c4553a" }}>UTÁNA</span>
      </>
    );
  }
  if (id === "flyer") {
    return (
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#efe8de" }}>
        <div className="relative h-[90%] aspect-square overflow-hidden rounded-md shadow-[0_8px_22px_rgba(0,0,0,.25)]">
          <Image src="/flyer-samples/openhouse-1x1.png" alt="" fill sizes="200px" className="object-cover" />
        </div>
      </div>
    );
  }
  return <ReportMock />;
}

export default function StarterCards() {
  return (
    <section>
      <h2 className="mb-3 font-display text-[19px] font-semibold">Ezzel kezdd — a legtöbben ezt próbálják ki elsőként</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {STARTERS.map((s, i) => (
          <div key={s.id} className="flex flex-col overflow-hidden rounded-[18px] bg-white"
            style={{ boxShadow: "0 0 0 1px var(--twx-line), 0 10px 26px rgba(28,24,21,.06)" }}>
            <div className="relative h-[170px] overflow-hidden sm:h-[184px]" style={{ background: "#ddd" }} aria-hidden>
              <Visual id={s.id} />
            </div>
            <div className="flex flex-1 flex-col gap-1.5 px-4 pb-[17px] pt-[15px]">
              <h3 className="text-[16.5px] font-semibold">{s.title}</h3>
              <p className="text-[13.5px] leading-normal" style={{ color: "#4b443d" }}>{s.desc}</p>
              <div className="flex gap-1.5">
                <span className="rounded-full px-2 py-[3px] text-[11px] font-semibold" style={{ background: "#fde4d9", color: "#9a3a22" }}>{s.credits} kredit</span>
                <span className="rounded-full px-2 py-[3px] text-[11px] font-semibold" style={{ background: "#f3ece3", color: "#6a5f55" }}>{s.duration}</span>
              </div>
              <div className="mt-auto pt-2.5">
                {/* Az első kártya a fő ajánlat (korall), a többi másodlagos gomb. */}
                <Link href={s.href}
                  className="inline-flex h-[46px] w-full items-center justify-center rounded-full px-5 text-[14.5px] font-bold transition-opacity hover:opacity-90"
                  style={i === 0
                    ? { background: "#c4553a", color: "#fff", boxShadow: "0 12px 28px rgba(196,85,58,.3)" }
                    : { background: "#fff", color: "var(--twx-ink)", boxShadow: "inset 0 0 0 1px #d9cfc4" }}>
                  {s.cta} →
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
