// Futó sáv (B arculat, terv 29 / 4.2): lassú (~30 mp/kör), végtelen vízszintes mozgás „feladat · iparág" kapszulákkal.
// Ötletek, nem kész termékek — a felirat ezt mondja. Fix magasságú sáv (nincs layout shift); a lista kétszer szerepel,
// hogy a −50%-os eltolás varrat nélkül ismétlődjön (a második példány képernyőolvasónak rejtett).
// Csökkentett mozgásnál (prefers-reduced-motion) áll — globals.css: .b-marquee.
import { IDEA_CHIPS } from "@/lib/site-copy";

export default function IdeaMarquee() {
  const chip = "flex h-[46px] items-center whitespace-nowrap rounded-full border border-b-line bg-b-card px-[22px] text-[15px] font-medium text-b-ink";
  return (
    <section aria-label="Ötletek bármilyen iparágra" className="pt-6">
      {/* Két kiemelő címke egymás mellett, középre szimmetrikusan (Márk kérése 2026-11-24; sötét + korall).
          Az „Egyedi, cégre szabott modulok" a hero tetejéről került ide; a „Néhány ötlet:" rész kikerült. */}
      <div className="flex flex-wrap items-center justify-center gap-3 px-4">
        <span className="b-highlight">Egyedi, cégre szabott modulok</span>
        <span className="b-highlight">Bármilyen iparágra építünk</span>
      </div>
      <div className="relative h-[78px] overflow-hidden py-4">
        <div className="b-marquee">
          {IDEA_CHIPS.map((c) => <span key={c} className={chip}>{c}</span>)}
          {IDEA_CHIPS.map((c) => <span key={`${c}-2`} className={chip} aria-hidden>{c}</span>)}
        </div>
      </div>
    </section>
  );
}
