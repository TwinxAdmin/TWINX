// Futó sáv (B arculat, terv 29 / 4.2): lassú (~30 mp/kör), végtelen vízszintes mozgás „feladat · iparág" kapszulákkal.
// Ötletek, nem kész termékek — a felirat ezt mondja. Fix magasságú sáv (nincs layout shift); a lista kétszer szerepel,
// hogy a −50%-os eltolás varrat nélkül ismétlődjön (a második példány képernyőolvasónak rejtett).
// Csökkentett mozgásnál (prefers-reduced-motion) áll — globals.css: .b-marquee.
import { IDEA_CHIPS } from "@/lib/site-copy";

// UGRÁS JAVÍTÁSA (2026-11-25): a lista két példánya között eddig `gap` volt → a −50%-os eltolás fél réssel (6 px)
// „elcsúszott", ezért a kör végén ugrott. Most minden kapszula SAJÁT jobb margót kap (nincs gap), így a két fél
// pontosan egyforma széles, a hurok varrat nélküli. A széleken lágy elhalványulás (mask).
// tone="dark": üveges kapszulák a sötét, videós hero aljára (Márk kérése: igazodjon a feljebb került videóhoz).
export default function IdeaMarquee({ tone = "light" }: { tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  const chip = `mr-3 flex h-[46px] flex-none items-center whitespace-nowrap rounded-full px-[22px] text-[15px] font-medium ${
    dark ? "border border-white/15 bg-white/[0.07] text-b-on-dark backdrop-blur-sm" : "border border-b-line bg-b-card text-b-ink"}`;
  const badge = dark ? "b-highlight [background:rgba(255,255,255,0.08)] backdrop-blur-sm" : "b-highlight";
  return (
    <section aria-label="Ötletek bármilyen iparágra" className="pt-6">
      {/* Két kiemelő címke egymás mellett, középre szimmetrikusan (sötét + korall; sötét háttéren üveges). */}
      <div className="flex flex-wrap items-center justify-center gap-3 px-4">
        <span className={badge}>Egyedi, cégre szabott modulok</span>
        <span className={badge}>Bármilyen iparágra építünk</span>
      </div>
      <div className="relative h-[78px] overflow-hidden py-4 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
        <div className="b-marquee">
          {IDEA_CHIPS.map((c) => <span key={c} className={chip}>{c}</span>)}
          {IDEA_CHIPS.map((c) => <span key={`${c}-2`} className={chip} aria-hidden>{c}</span>)}
        </div>
      </div>
    </section>
  );
}
