// „Nézd meg működés közben" — a modul-forgó KERETE. Két rész, mindkettő tiszta
// CSS-animáció (nincs JS, nincs ütemezés), ezért olcsó és minden gépen sima:
//
//   <ShowcaseBackdrop />  — a szekció teljes hátterére: finom pontrács, és néhány
//                           vékony, korall „sebességcsík", ami balról jobbra
//                           húz át. Ez adja a „felgyorsul a munka" érzetet.
//                           Két szélen (xl+) a SkylineStory: vonalakból felépülő
//                           ház → elfogadás → fénycsík a cím mögött → naptár.
//   <ShowcaseFrame>       — a kártya köré: egy körbefutó fény a peremen (lassan
//                           kering, mint egy folyamatjelző), mögötte lágy
//                           derengés. (A lebegő idő-chipek kikerültek — a
//                           kártyára lógtak.)
//
// SZÁNDÉKOSAN visszafogott: a csíkok és a rács 10–20% körüli opacitással.

import type { ReactNode } from "react";
import SkylineStory from "@/components/landing/SkylineStory";

// Csíkok: magasság (%), hossz (%), időtartam (s), késleltetés (s)
const LINES: Array<[number, number, number, number]> = [
  [14, 26, 9, 0],
  [31, 18, 12, 3.5],
  [52, 34, 10, 1.2],
  [71, 22, 13, 6],
  [86, 28, 11, 2.4],
];

export function ShowcaseBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {/* Pontrács — a széleken elhalványul, hogy ne legyen „táblázat"-érzet */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(244,239,231,0.28) 1px, transparent 1.2px)",
          backgroundSize: "28px 28px",
          opacity: 0.35,
          maskImage: "radial-gradient(70% 70% at 50% 45%, #000 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(70% 70% at 50% 45%, #000 30%, transparent 100%)",
        }}
      />
      {/* Ház → jóváhagyás → fénycsík a cím mögött → naptár (bal és jobb szél) —
          csak széles képernyőn, ahol a kártya mellett van hely (xl+). */}
      <SkylineStory className="hidden xl:block" />
      {/* Sebességcsíkok */}
      {LINES.map(([top, w, dur, delay], i) => (
        <div
          key={i}
          className="twx-speedline absolute h-px"
          style={{
            top: `${top}%`,
            width: `${w}%`,
            background: "linear-gradient(90deg, transparent, rgba(239,122,90,0.55) 50%, transparent)",
            animationDuration: `${dur}s`,
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function ShowcaseFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-4xl">
      {/* Lágy derengés a kártya mögött — a fényperem „bloom"-ja */}
      <div
        className="pointer-events-none absolute -inset-6 rounded-[40px]"
        aria-hidden
        style={{ background: "radial-gradient(60% 60% at 50% 50%, rgba(239,122,90,0.22), transparent 70%)", filter: "blur(18px)" }}
      />

      {/* Körbefutó fény a peremen: egy 1,5 px-es sáv, amiben egy forgó kúpos
          színátmenet kering. A kártya a sáv belsejében ül. */}
      <div className="relative overflow-hidden rounded-[26px] p-[1.5px]">
        <div
          className="twx-spin-slow pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[160%] -translate-x-1/2 -translate-y-1/2"
          aria-hidden
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, transparent 250deg, rgba(239,122,90,0.35) 300deg, rgba(249,201,182,0.95) 330deg, rgba(239,122,90,0.35) 350deg, transparent 360deg)",
          }}
        />
        {/* Halvány, állandó perem, hogy a fény nélküli oldal se legyen „levágva" */}
        <div className="pointer-events-none absolute inset-0 rounded-[26px]" aria-hidden style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.10)" }} />
        <div className="relative rounded-[25px]" style={{ background: "var(--twx-dark-2)" }}>
          {children}
        </div>
      </div>

    </div>
  );
}
