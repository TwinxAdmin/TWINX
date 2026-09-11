// Videókészítés-jelenet a főoldali modul-forgóba — kódból rajzolt folyamat,
// a végén VALÓDI, TWINX-szel készült videóval a telefonon.
//
// MIÉRT jelenet: a partnernek azt kell látnia, hogy MENNYI bemenetből (pár fotó
// + három adat + egy zene) és MILYEN GYORSAN lesz kész egy hirdetési videó; az
// eredmény viszont ne rajz legyen, hanem az, amit a rendszer tényleg kiad.
// Három felvonás, ugyanazzal a motorral, mint a ValuationDemo:
//   1) fotók pottyannak a feltöltő-mezőbe, három mező gépelve kitöltődik, a
//      9:16 méret kap pipát,
//   2) egy zene kiválasztódik (a hullámforma lüktetni kezd), a gomb benyomódik,
//      rövid folyamatjelző fut,
//   3) az űrlap hátrébb húzódik, a helyére beúszik egy ÁLLÓ TELEFON, benne a
//      TWINX-szel VALÓBAN elkészült hirdetési videó megy (3× gyorsítva, némán),
//      alul futó lejátszó-csík; végül „MP4 kész".
// A háttérben halvány, sodródó videós motívumok (filmkocka, play, hullámforma).
//
// MÉDIA: public/showcase/video-demo.mp4 — a Visegrádi utcai videó, 36 s → 12 s,
// 540×960, hang nélkül. A video-demo-1..4.jpg bélyegképek ugyanebből a videóból
// vannak kivágva, hogy a „feltöltött" fotók és a kész videó ugyanazok legyenek.
// Ha egyszer újra kell vágni: ffmpeg -i forrás.mp4 -an -vf "setpts=PTS/3,
// scale=540:960,fps=30" -crf 26 -movflags +faststart video-demo.mp4
//
// Az egész egy időzítő (t ms) függvénye; az adatok a videóval egyeznek.
"use client";

import { useEffect, useRef, useState } from "react";

/** A telefon TERVEZÉSI mérete (px, 9:16) — a színpad magasságához skálázzuk. */
const PHONE_W = 180;
const PHONE_H = 320;

const VIDEO_SRC = "/showcase/video-demo.mp4";
const VIDEO_POSTER = "/showcase/video-demo-poster.jpg";
/** A gyorsított videó hossza (ms) — a forgatókönyv erre épül. */
const VIDEO_MS = 12000;

// ---- Forgatókönyv -----------------------------------------------------------
const PHOTOS: Array<{ src: string; label: string }> = [
  { src: "/showcase/video-demo-1.jpg", label: "Nappali" },
  { src: "/showcase/video-demo-2.jpg", label: "3 hálószoba" },
  { src: "/showcase/video-demo-3.jpg", label: "Fürdőszoba + mosdó" },
  { src: "/showcase/video-demo-4.jpg", label: "Tágas konyha" },
];
const PHOTO_AT = 300;
const PHOTO_STEP = 300;
const PHOTOS_END = PHOTO_AT + (PHOTOS.length - 1) * PHOTO_STEP + 500;

type Field = { label: string; value: string; startMs: number };
const CHAR_MS = 38;
const GAP_MS = 160;
const RAW: Array<[string, string]> = [
  ["Cím", "Budapest XIII., Visegrádi utca"],
  ["Ár", "79,9 M Ft"],
  ["Méret / szobák", "70 m² · 3 szoba"],
];
const FIELDS: Field[] = (() => {
  let t = PHOTOS_END;
  return RAW.map(([label, value]) => {
    const f = { label, value, startMs: t };
    t += value.length * CHAR_MS + GAP_MS;
    return f;
  });
})();
const TYPED_END = FIELDS[FIELDS.length - 1].startMs + FIELDS[FIELDS.length - 1].value.length * CHAR_MS;
const ASPECT_AT = TYPED_END + 250;
const MUSIC_AT = ASPECT_AT + 550;
const PRESS_AT = MUSIC_AT + 800;
const STEPS: Array<{ label: string; at: number }> = [
  { label: "Nyitókártya a címmel és az árral…", at: PRESS_AT + 300 },
  { label: "Feliratok a fotókra…", at: PRESS_AT + 900 },
  { label: "Átmenetek, zene, zárókártya…", at: PRESS_AT + 1500 },
];
const PHONE_AT = PRESS_AT + 2100;
/** A telefonon ekkor indul a valódi videó. */
const PLAY_AT = PHONE_AT + 500;
const PLAY_MS = VIDEO_MS;
const DONE_AT = PLAY_AT + PLAY_MS;
/** A dia teljes hossza — a forgó ennyit vár a váltással. */
export const VIDEO_DEMO_MS = DONE_AT + 1800;

const MUSIC = ["Nyugodt", "Modern", "Energikus"];
const MUSIC_PICK = 1;

function typed(value: string, startMs: number, t: number): string {
  if (t < startMs) return "";
  return value.slice(0, Math.min(value.length, Math.floor((t - startMs) / CHAR_MS)));
}

export default function VideoDemo({ active, credits }: { active: boolean; credits: number }) {
  const [t, setT] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scale, setScale] = useState(1);

  // A telefon a színpad magasságának 90%-ára skálázódik.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale((e.contentRect.height * 0.9) / PHONE_H));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Óra: csak amíg a dia aktív; inaktívvá válva nullázódik.
  useEffect(() => {
    if (!active) { setT(0); return; }
    const start = performance.now();
    let raf = 0;
    const tick = () => { setT(performance.now() - start); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  const photosIn = PHOTOS.filter((_, i) => t >= PHOTO_AT + i * PHOTO_STEP).length;
  const activeField = FIELDS.findIndex((f) => t >= f.startMs && typed(f.value, f.startMs, t).length < f.value.length);
  const aspectOn = t >= ASPECT_AT;
  const musicOn = t >= MUSIC_AT;
  const ready = musicOn;
  const pressed = t >= PRESS_AT && t < PRESS_AT + 280;
  const step = [...STEPS].reverse().find((s) => t >= s.at && t < PHONE_AT);
  const phoneIn = t >= PHONE_AT;
  const playing = active && t >= PLAY_AT;
  const play = Math.min(Math.max(t - PLAY_AT, 0), PLAY_MS);
  const done = t >= DONE_AT;

  // A valódi videó a forgatókönyv PLAY_AT pontján indul, inaktív diánál
  // visszaáll az elejére (így a következő körben újra a nyitókártyával kezd).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.currentTime = 0;
      v.play().catch(() => { /* autoplay tiltva → a poszter marad */ });
    } else {
      v.pause();
      v.currentTime = 0;
    }
  }, [playing]);

  return (
    <div ref={stageRef} className="relative h-full w-full overflow-hidden"
      style={{ background: "radial-gradient(70% 70% at 50% 45%, rgba(239,122,90,0.16), transparent 70%)" }}>

      <Motifs />

      {/* ===== 1–2) ŰRLAP — fotók + adatok + zene, üvegkártyán ===== */}
      <div
        className="absolute left-1/2 top-1/2 w-[82%] max-w-[560px] rounded-2xl p-3 sm:p-4"
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.16)",
          backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
          color: "var(--twx-on-dark)",
          transform: phoneIn ? "translate(-50%, -50%) scale(0.86)" : "translate(-50%, -50%)",
          opacity: phoneIn ? 0 : 1,
          transition: "transform .8s cubic-bezier(.22,1,.36,1), opacity .5s",
        }}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <div className="text-[9px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--twx-coral)" }}>
            Videó · fotók és adatok
          </div>
          <div className="text-[9px] tabular-nums" style={{ color: "var(--twx-on-dark-muted)" }}>
            {photosIn}/{PHOTOS.length} fotó
          </div>
        </div>

        <div className="grid grid-cols-[5fr_6fr] gap-3">
          {/* Fotók — egymás után pottyannak a mezőbe */}
          <div className="grid grid-cols-2 content-start gap-1.5 rounded-lg p-1.5"
            style={{ border: "1px dashed rgba(255,255,255,0.28)", background: "rgba(255,255,255,0.04)" }}>
            {PHOTOS.map((p, i) => {
              const on = i < photosIn;
              return (
                <div key={p.src} className="aspect-[4/3] overflow-hidden rounded-md"
                  style={{
                    boxShadow: "0 6px 16px rgba(0,0,0,0.4)",
                    opacity: on ? 1 : 0,
                    transform: on ? "translateY(0) rotate(0deg) scale(1)" : "translateY(-18px) rotate(-6deg) scale(0.8)",
                    transition: "opacity .3s, transform .5s cubic-bezier(.22,1,.36,1)",
                  }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} alt="" draggable={false} className="h-full w-full object-cover" />
                </div>
              );
            })}
          </div>

          {/* Adatok + méret */}
          <div className="flex flex-col gap-1.5">
            {FIELDS.map((f, i) => {
              const v = typed(f.value, f.startMs, t);
              const focus = i === activeField;
              return (
                <div key={f.label}>
                  <div className="mb-0.5 text-[8px] font-medium sm:text-[9px]" style={{ color: "var(--twx-on-dark-muted)" }}>{f.label}</div>
                  <div className="flex h-6 items-center rounded-md px-2 text-[10px] font-medium sm:h-7 sm:text-[11px]"
                    style={{
                      background: "rgba(255,255,255,0.94)", color: "var(--twx-ink)",
                      border: `1px solid ${focus ? "var(--twx-coral)" : "rgba(255,255,255,0.35)"}`,
                      boxShadow: focus ? "0 0 0 3px rgba(239,122,90,0.28)" : "none",
                      transition: "box-shadow .2s, border-color .2s",
                    }}>
                    <span className="truncate">{v}</span>
                    {focus && <span className="twx-caret ml-px inline-block h-3.5 w-px shrink-0" style={{ background: "var(--twx-ink)" }} />}
                  </div>
                </div>
              );
            })}
            <div className="mt-0.5 flex gap-1.5">
              {(["9:16", "1:1"] as const).map((a) => {
                const sel = a === "9:16" && aspectOn;
                return (
                  <div key={a} className="flex flex-1 items-center justify-center gap-1 rounded-md py-1 text-[9px] font-semibold"
                    style={{
                      background: sel ? "var(--twx-coral)" : "rgba(255,255,255,0.08)",
                      color: sel ? "#1c1005" : "var(--twx-on-dark-muted)",
                      border: `1px solid ${sel ? "var(--twx-coral)" : "rgba(255,255,255,0.16)"}`,
                      transition: "background .3s, color .3s",
                    }}>
                    <span className="inline-block rounded-[2px] border border-current" style={{ width: a === "9:16" ? 5 : 8, height: 8 }} />
                    {a}{sel && " ✓"}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Zene */}
        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          {MUSIC.map((m, i) => {
            const sel = i === MUSIC_PICK && musicOn;
            return (
              <div key={m} className="flex items-center gap-1.5 rounded-md px-2 py-1.5"
                style={{
                  background: sel ? "rgba(239,122,90,0.18)" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${sel ? "var(--twx-coral)" : "rgba(255,255,255,0.14)"}`,
                  boxShadow: sel ? "0 0 0 3px rgba(239,122,90,0.22)" : "none",
                  transition: "background .3s, border-color .3s, box-shadow .3s",
                }}>
                <Waveform live={sel} />
                <span className="truncate text-[9px] font-medium" style={{ color: sel ? "var(--twx-on-dark)" : "var(--twx-on-dark-muted)" }}>{m}</span>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          tabIndex={-1}
          className="mt-2.5 w-full rounded-lg py-2 text-[10px] font-semibold sm:text-xs"
          style={{
            background: ready ? "var(--twx-coral)" : "rgba(255,255,255,0.10)",
            color: ready ? "#1c1005" : "var(--twx-on-dark-muted)",
            transform: pressed ? "scale(0.97)" : "scale(1)",
            boxShadow: pressed ? "inset 0 2px 8px rgba(0,0,0,0.3)" : ready ? "0 10px 26px rgba(239,122,90,0.4)" : "none",
            transition: "transform .12s, background .3s, box-shadow .3s, color .3s",
          }}
        >
          Videó készítése · {credits} kredit
        </button>
        <div className="mt-1.5 h-4 text-center text-[9px]" style={{ color: "var(--twx-on-dark-muted)" }}>
          {step && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {step.label}
            </span>
          )}
        </div>
      </div>

      {/* ===== 3) ÁLLÓ TELEFON — a kész videó „lejátszása" ===== */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: PHONE_W, height: PHONE_H,
          transformOrigin: "center",
          transform: phoneIn
            ? `translate(-50%, -50%) scale(${scale})`
            : `translate(-50%, -36%) scale(${scale * 0.9})`,
          opacity: phoneIn ? 1 : 0,
          transition: "transform .9s cubic-bezier(.22,1,.36,1) .15s, opacity .5s .15s",
        }}
      >
        {/* Keret */}
        <div className="relative h-full w-full overflow-hidden rounded-[22px]"
          style={{ background: "#0c0b0a", boxShadow: "0 30px 80px rgba(0,0,0,0.65), 0 0 0 3px #26221e, 0 0 0 4px rgba(255,255,255,0.12)" }}>
          <div className="absolute left-1/2 top-1.5 z-20 h-[6px] w-12 -translate-x-1/2 rounded-full" style={{ background: "#26221e" }} />

          {/* Kijelző */}
          <div className="absolute inset-[6px] overflow-hidden rounded-[16px]" style={{ background: "var(--twx-dark)" }}>
            {/* A TWINX-szel készült videó — némán, 3× gyorsítva; a poszter az első képkocka */}
            <video
              ref={videoRef}
              src={VIDEO_SRC}
              poster={VIDEO_POSTER}
              muted
              playsInline
              preload="auto"
              disablePictureInPicture
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Finom sötétítés alul, hogy a lejátszó-csík olvasható legyen */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12" style={{ background: "linear-gradient(to top, rgba(12,11,10,0.7), transparent)" }} />

            {/* Lejátszó-csík + zene-jelző */}
            <div className="absolute inset-x-2 bottom-2 z-20">
              <div className="mb-1 flex items-center justify-between text-[6.5px] tabular-nums" style={{ color: "rgba(255,255,255,0.85)" }}>
                <span className="inline-flex items-center gap-1"><Waveform live={play > 0 && !done} small /> {MUSIC[MUSIC_PICK]}</span>
                <span>0:{String(Math.floor(play / 1000)).padStart(2, "0")} / 0:{String(Math.floor(PLAY_MS / 1000)).padStart(2, "0")}</span>
              </div>
              <div className="h-[3px] overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.25)" }}>
                <div className="h-full rounded-full" style={{ width: `${(play / PLAY_MS) * 100}%`, background: "var(--twx-coral)" }} />
              </div>
            </div>
          </div>
        </div>

        {/* „MP4 kész" */}
        <div className="absolute -right-2 top-6 flex items-center gap-1 rounded-full px-2 py-0.5 text-[7px] font-semibold"
          style={{ background: "rgba(22,163,74,0.9)", color: "#fff", opacity: done ? 1 : 0, transform: done ? "scale(1)" : "scale(0.8)", transition: "opacity .3s, transform .3s" }}>
          ✓ MP4 kész
        </div>
      </div>
    </div>
  );
}

/** Kis hullámforma — kiválasztva / lejátszás alatt lüktet. */
function Waveform({ live, small }: { live: boolean; small?: boolean }) {
  const bars = [0.4, 0.8, 0.55, 1, 0.65, 0.85, 0.45];
  const h = small ? 7 : 11;
  return (
    <span className="inline-flex shrink-0 items-end gap-[1.5px]" style={{ height: h, color: live ? "var(--twx-coral)" : "currentColor" }} aria-hidden>
      {bars.map((b, i) => (
        <span key={i} className={`inline-block w-[2px] rounded-full ${live ? "twx-wave" : ""}`}
          style={{ height: h * b, background: "currentColor", animationDelay: `${i * 0.11}s`, opacity: live ? 1 : 0.55 }} />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Háttér-motívumok: filmkocka, play, hullámforma, hangjegy, csapó — halványan,
// lassan sodródva (twx-orb / twx-orb-2).
// ---------------------------------------------------------------------------
function Motifs() {
  const stroke = "rgba(239,122,90,0.55)";
  const common = { fill: "none", stroke, strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden style={{ opacity: 0.22 }}>
      {/* Filmkocka — bal felső */}
      <svg className="twx-orb absolute left-[5%] top-[10%] h-12 w-16 sm:h-16 sm:w-20" viewBox="0 0 32 24" {...common}>
        <rect x="2" y="2" width="28" height="20" rx="2" /><path d="M2 7h28M2 17h28" strokeOpacity="0.6" />
        <path d="M6 4.5h2M12 4.5h2M18 4.5h2M24 4.5h2M6 19.5h2M12 19.5h2M18 19.5h2M24 19.5h2" strokeWidth="1.8" />
      </svg>
      {/* Play — jobb felső */}
      <svg className="twx-orb-2 absolute right-[6%] top-[14%] h-10 w-10 sm:h-14 sm:w-14" viewBox="0 0 24 24" {...common}>
        <circle cx="12" cy="12" r="10" /><path d="m10 8 6 4-6 4z" />
      </svg>
      {/* Hullámforma — bal alsó */}
      <svg className="twx-orb-2 absolute bottom-[12%] left-[7%] h-12 w-20 sm:h-16 sm:w-28" viewBox="0 0 40 24" {...common}>
        <path d="M2 12h3M7 8v8M11 5v14M15 9v6M19 3v18M23 8v8M27 6v12M31 10v4M35 7v10M38 12h0.5" strokeWidth="1.8" />
      </svg>
      {/* Hangjegy — jobb alsó */}
      <svg className="twx-orb absolute bottom-[14%] right-[8%] h-10 w-10 sm:h-14 sm:w-14" viewBox="0 0 24 24" {...common}>
        <path d="M9 18V5l11-2v12" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="15" r="3" />
      </svg>
      {/* Csapó — középen fent, egészen halványan */}
      <svg className="twx-orb absolute left-1/2 top-[4%] h-8 w-12 -translate-x-1/2 sm:h-10 sm:w-16" viewBox="0 0 36 24" {...common} strokeOpacity="0.5">
        <rect x="2" y="9" width="32" height="13" /><path d="M2 9 5 3h29l-3 6M9 3l-3 6M17 3l-3 6M25 3l-3 6" />
      </svg>
    </div>
  );
}
