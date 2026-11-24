// Referencia-kártyák (B arculat): az ingatlanos modulok, működő példaként (terv 11 / 3.6, terv 29 / 4.5).
// Kép: a meglévő modul valódi eredménye; ha nincs, jelölt helyőrző („Képernyőkép hamarosan"). A Látványterv képén
// „Koncepcióterv" jelölés. Fix magasságú képhely — betöltéskor nem ugrik.
import Image from "next/image";
import Reveal from "@/components/motion/Reveal";
import { REFERENCE_CARDS } from "@/lib/site-copy";

export default function ReferenceCards({ compact = false }: { compact?: boolean }) {
  const imgH = compact ? "h-[100px]" : "h-[140px]";
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-[18px]">
      {REFERENCE_CARDS.map((r, i) => (
        <Reveal key={r.title} delay={i * 0.06} className="h-full">
          <div className={`h-full overflow-hidden border border-b-line bg-b-card ${compact ? "rounded-[18px]" : "rounded-[20px]"}`}>
            <div className={`relative ${imgH} overflow-hidden bg-gradient-to-br from-[#f3d9c8] to-[#e8b79c]`}>
              {r.image ? (
                <>
                  <Image src={r.image} alt={`${r.title} — példa-eredmény`} fill sizes="(max-width: 768px) 100vw, 360px" className="object-cover" />
                  {r.concept && (
                    <span className="absolute left-2.5 top-2.5 rounded-full bg-b-dark/85 px-2.5 py-1 text-[11px] font-semibold text-b-on-dark">
                      Koncepcióterv
                    </span>
                  )}
                </>
              ) : (
                <span className="absolute bottom-2.5 left-3 text-xs text-b-ink-2">Képernyőkép hamarosan</span>
              )}
            </div>
            <div className={compact ? "p-4" : "p-5"}>
              <p className={`font-semibold ${compact ? "" : "mb-1.5 text-[19px]"}`}>{r.title}</p>
              {!compact && <p className="text-sm leading-relaxed text-b-ink-2">{r.text}</p>}
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}
