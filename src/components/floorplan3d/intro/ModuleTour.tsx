// ModuleTour — a 3D lakás modul oktató bemutatója (első belépéskor + „Hogyan működik?" gombbal). Látványterv: design/3d-bemutato-latvanyterv.html.
// 5 jelenet, végtelenítve: 1. feltöltés · 2. digitalizálás · 3. javítás (falhúzás, nyílászáró-kártya) — saját rajzolású animáció;
// 4. valódi 3D babaház (IntroDollhouse) · 5. valódi 3D bejárás + elfogadás + link (IntroWalkthrough) — a modul saját motorján, a mintalakáson.
// A két 3D-jelenet már az elején betölt (a háttérben vár), hogy a váltáskor azonnal induljon.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SceneOptions } from "@/lib/floorplan3d/scene";
import type { StyleSheet } from "@/lib/floorplan3d/stylesheet";
import IntroDollhouse from "@/components/floorplan3d/intro/IntroDollhouse";
import IntroWalkthrough from "@/components/floorplan3d/intro/IntroWalkthrough";

const STEPS = [
  { t: "Töltsd fel az alaprajzot", d: "JPG, PNG vagy PDF — akár egy hirdetési lapról." },
  { t: "Digitalizáljuk", d: "Felismerjük a helyiségeket, falakat, ajtókat, ablakokat, és ellenőrizzük a m²-eket." },
  { t: "Te ellenőrzöd és javítod", d: "Fal arrébb: megfogod és húzod. Ajtó, ablak: egy kattintás a nyílászáró-kártyán." },
  { t: "Méretpontos 3D modell épül", d: "Forgatod, ráközelítesz, a falra kattintasz — és az ablak a szemed előtt nő bele a falba." },
  { t: "Bejárás, elfogadás, link", d: "Szemmagasságból, berendezve: az ajtók kinyílnak előtted. Jóváhagyod — és küldöd a linket a vevőnek." },
];
const DURS = [5200, 5200, 6400]; // az 1–3. jelenet hossza (ms); a 4–5. a saját idővonala szerint lép tovább

// 3. jelenet: a kurzor útja a kártya-koordinátákban (px), vagy egy elem (data-k) közepe
type Key = { t: number; p: [number, number] | string; click?: boolean };
const CUR3: Key[] = [{ t: 250, p: [231, 116] }, { t: 700, p: [231, 116], click: true }, { t: 2200, p: [242, 116] }, { t: 2900, p: [131, 49] },
  { t: 3150, p: [131, 49], click: true }, { t: 3900, p: "glass" }, { t: 4300, p: "glass", click: true }, { t: 5200, p: [330, 250] }];
const smooth = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

export default function ModuleTour({ opts, style, credits, linkDays, creditsExtend, onStart }: {
  opts: SceneOptions; style: StyleSheet | null; credits: number; linkDays: number; creditsExtend: number; onStart: () => void;
}) {
  const [cur, setCur] = useState(0);
  const [run, setRun] = useState(0); // minden váltásnál új → a CSS-animációk elölről indulnak
  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement | null>(null);
  const startRef = useRef(0);
  const go = useCallback((i: number) => { setCur((i + STEPS.length) % STEPS.length); setRun((r) => r + 1); startRef.current = performance.now(); }, []);

  // 1–3. jelenet: időzítő; a lépés-sáv; a 3. jelenet kurzora és időzített elemei
  useEffect(() => {
    if (!startRef.current) startRef.current = performance.now();
    barRef.current = rootRef.current?.querySelector<HTMLElement>(`[data-step="${cur}"] [data-bar]`) ?? null;
    if (barRef.current) barRef.current.style.width = "0%";
    if (cur > 2) return;
    const timer = window.setTimeout(() => go(cur + 1), DURS[cur]);
    let raf = 0;
    const tick = () => {
      const t = performance.now() - startRef.current;
      if (barRef.current) barRef.current.style.width = `${Math.min(100, (t / DURS[cur]) * 100)}%`;
      const card = rootRef.current?.querySelector<HTMLElement>("[data-s3]");
      if (cur === 2 && card) {
        card.querySelectorAll<HTMLElement | SVGElement>("[data-at]").forEach((e) => {
          const a = +(e.dataset.at ?? 0), off = e.dataset.off ? +e.dataset.off : Infinity;
          e.style.opacity = t >= a && t < off ? "1" : "0";
        });
        card.querySelectorAll<HTMLElement>("[data-sel]").forEach((e) => e.classList.toggle("on", t >= +(e.dataset.sel ?? 0)));
        card.querySelectorAll<HTMLElement>("[data-unsel]").forEach((e) => e.classList.toggle("on", t < +(e.dataset.unsel ?? 0)));
        const c = card.querySelector<HTMLElement>("[data-cur]"), ring = card.querySelector<HTMLElement>("[data-ring]");
        if (c && ring) {
          const pt = (k: Key): [number, number] => {
            if (Array.isArray(k.p)) return k.p;
            const el = card.querySelector<HTMLElement>(`[data-k="${k.p}"]`);
            if (!el) return [0, 0];
            const r = el.getBoundingClientRect(), cr = card.getBoundingClientRect();
            return [r.left + r.width / 2 - cr.left, r.top + r.height / 2 - cr.top];
          };
          const vis = t >= CUR3[0].t - 150 && t <= CUR3[CUR3.length - 1].t + 500;
          c.style.opacity = vis ? "1" : "0";
          let a = CUR3[0], b = CUR3[0];
          for (const k of CUR3) { if (k.t <= t) a = k; else { b = k; break; } b = k; }
          const pa = pt(a), pb = pt(b), k = b.t > a.t ? smooth((t - a.t) / (b.t - a.t)) : 1;
          c.style.left = `${pa[0] + (pb[0] - pa[0]) * k}px`; c.style.top = `${pa[1] + (pb[1] - pa[1]) * k}px`;
          ring.style.animation = CUR3.some((q) => q.click && t >= q.t && t < q.t + 400) ? "twt-ring .4s ease-out" : "none";
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { window.clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [cur, run, go]);

  const progress = useCallback((f: number) => { if (barRef.current) barRef.current.style.width = `${Math.min(100, f * 100)}%`; }, []);
  const next4 = useCallback(() => { window.setTimeout(() => go(4), 500); }, [go]);
  const next5 = useCallback(() => go(0), [go]);

  return (
    <div className="twt" ref={rootRef}>
      <style>{CSS}</style>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true"><defs>

    <pattern id="twt-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#4b4560"/><line x1="0" y1="0" x2="0" y2="6" stroke="#6c6585" strokeWidth="2"/></pattern>
    <pattern id="twt-tiles" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#EEF3F5"/><path d="M10 0H0V10" fill="none" stroke="#D6E1E6" strokeWidth="1"/></pattern>
    <pattern id="twt-parq" width="14" height="6" patternUnits="userSpaceOnUse"><rect width="14" height="6" fill="#F6EDDD"/><path d="M0 6H14M7 0V6" stroke="#EADBC2" strokeWidth=".8"/></pattern>
    {/* nyílászáró-ikonok a kártyához */}
    <symbol id="twt-icDoor" viewBox="0 0 20 20"><rect x="5" y="2.5" width="10" height="15" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6"/><circle cx="12.5" cy="10" r="1.2" fill="currentColor"/></symbol>
    <symbol id="twt-icGlass" viewBox="0 0 20 20"><rect x="5" y="2.5" width="10" height="15" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6"/><rect x="7.5" y="5" width="5" height="10" fill="currentColor" opacity=".45"/></symbol>
    <symbol id="twt-icWin" viewBox="0 0 20 20"><rect x="2.5" y="5" width="15" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M10 5v10M2.5 10h15" stroke="currentColor" strokeWidth="1.3"/></symbol>
    <symbol id="twt-icPass" viewBox="0 0 20 20"><path d="M4 17.5V8a6 6 0 0 1 12 0v9.5" fill="none" stroke="currentColor" strokeWidth="1.6"/></symbol>
    {/* A minta-lakás (10,60 × 7,00 m): nappali · hálószoba · szoba · fürdő · előszoba · konyha · erkély. 1 px = 2,94 cm. */}
    <symbol id="twt-plan" viewBox="0 0 400 304">
      <rect width="400" height="304" fill="#FBF8F3"/>
      <rect x="20" y="46" width="360" height="122" fill="url(#twt-parq)"/><rect x="20" y="168" width="108" height="116" fill="url(#twt-parq)"/>
      <rect x="128" y="168" width="68" height="116" fill="url(#twt-tiles)"/><rect x="196" y="168" width="102" height="116" fill="url(#twt-tiles)"/><rect x="298" y="168" width="82" height="116" fill="url(#twt-tiles)"/>
      <rect x="60" y="12" width="155" height="34" fill="url(#twt-tiles)"/>
      <path d="M60 46V12H215V46" fill="none" stroke="#8a8399" strokeWidth="2.4"/>
      <g stroke="#3B3530" strokeWidth="5" strokeLinecap="square">
        <path d="M232 46V168"/><path d="M20 168H380"/><path d="M128 168V284"/><path d="M196 168V284"/><path d="M298 168V284"/>
      </g>
      <path d="M20 46H380V284H20Z" fill="none" stroke="url(#twt-hatch)" strokeWidth="10"/>
      <g stroke="#FBF8F3">
        <path d="M170 46H212M262 46H340M20 82V132M380 82V132M20 200V250M50 284H100M380 200V250M318 284H362" strokeWidth="12"/>
        <path d="M100 46H150" strokeWidth="12"/><path d="M238 284H268" strokeWidth="12"/>
        <path d="M200 168H224M262 168H288M60 168H88" strokeWidth="7"/><path d="M196 236V262M298 190V216" strokeWidth="7"/>
      </g>
      <g stroke="#3a6a9a" strokeWidth="1.3" fill="none">
        <path d="M170 43H212M170 46H212M170 49H212"/><path d="M262 43H340M262 46H340M262 49H340"/><path d="M17 82V132M20 82V132M23 82V132"/><path d="M377 82V132M380 82V132M383 82V132"/>
        <path d="M17 200V250M20 200V250M23 200V250"/><path d="M50 281H100M50 284H100M50 287H100"/><path d="M377 200V250M380 200V250M383 200V250"/><path d="M318 281H362M318 284H362M318 287H362"/>
      </g>
      <g stroke="#3B3530" strokeWidth="1.6" fill="none">
        <path d="M100 46V20M150 46V20"/><path d="M100 20A26 26 0 0 1 125 46M150 20A26 26 0 0 0 125 46" strokeDasharray="3 3"/>
        <path d="M238 284V256"/><path d="M238 256A28 28 0 0 1 266 284" strokeDasharray="3 3"/>
        <path d="M200 168V144"/><path d="M200 144A24 24 0 0 1 224 168" strokeDasharray="3 3"/>
        <path d="M288 168V194"/><path d="M288 194A26 26 0 0 1 262 168" strokeDasharray="3 3"/>
        <path d="M88 168V142"/><path d="M88 142A28 28 0 0 0 60 168" strokeDasharray="3 3"/>
        <path d="M196 262H172"/><path d="M172 262A26 26 0 0 1 196 236" strokeDasharray="3 3"/>
        <path d="M298 216H322"/><path d="M322 216A26 26 0 0 0 298 190" strokeDasharray="3 3"/>
      </g>
      <path d="M253 300v-12m-5 5l5-5 5 5" stroke="#3a6a9a" strokeWidth="1.6" fill="none"/>
      <g stroke="#8F857B" strokeWidth="1.2" fill="none">
        <rect x="34" y="128" width="96" height="30" rx="4"/><path d="M34 136H130"/><rect x="58" y="104" width="48" height="14" rx="2"/>
        <rect x="160" y="80" width="44" height="30" rx="2"/><circle cx="170" cy="74" r="5"/><circle cx="194" cy="74" r="5"/><circle cx="170" cy="116" r="5"/><circle cx="194" cy="116" r="5"/>
        <rect x="292" y="60" width="74" height="64" rx="3"/><rect x="298" y="64" width="28" height="12" rx="3"/><rect x="332" y="64" width="28" height="12" rx="3"/><path d="M292 88H366"/>
        <rect x="254" y="52" width="26" height="70"/><path d="M254 52L280 122M280 52L254 122"/>
        <rect x="28" y="176" width="44" height="68" rx="3"/><rect x="32" y="180" width="36" height="12" rx="3"/><rect x="88" y="252" width="34" height="26"/>
        <rect x="134" y="174" width="30" height="74" rx="10"/><ellipse cx="149" cy="200" rx="9" ry="16"/><ellipse cx="180" cy="186" rx="9" ry="11"/><rect x="170" y="172" width="20" height="8"/><rect x="150" y="266" width="32" height="14" rx="3"/><circle cx="166" cy="273" r="4"/>
        <rect x="302" y="172" width="74" height="16"/><rect x="360" y="188" width="16" height="66"/><circle cx="318" cy="180" r="4"/><circle cx="330" cy="180" r="4"/><rect x="344" y="174" width="12" height="11" rx="2"/>
        <rect x="270" y="244" width="24" height="34"/>
      </g>
      <g stroke="#9C8F80" strokeWidth="1" fill="#6E655C" fontSize="9" fontWeight="700">
        <path d="M20 296H380M20 292V300M380 292V300"/><text x="200" y="303" textAnchor="middle" stroke="none">10,60</text>
        <path d="M8 46V284M4 46H12M4 284H12"/><text x="6" y="168" textAnchor="middle" stroke="none" transform="rotate(-90 6 168)">7,00</text>
      </g>
    </symbol>
    <symbol id="twt-planLabels" viewBox="0 0 400 304">
      <g fontWeight="800" fill="#8d2b1e" textAnchor="middle" fontSize="10">
        <text x="126" y="64">NAPPALI</text><text x="126" y="74" fontSize="8" fontWeight="600">laminált · 22,4 m²</text>
        <text x="320" y="142">HÁLÓSZOBA</text><text x="320" y="152" fontSize="8" fontWeight="600">laminált · 15,6 m²</text>
        <text x="96" y="214" textAnchor="end">SZOBA</text><text x="96" y="224" fontSize="8" fontWeight="600" textAnchor="end">10,8 m²</text>
        <text x="162" y="224">FÜRDŐ</text><text x="162" y="234" fontSize="8" fontWeight="600">6,8 m²</text>
        <text x="247" y="214">ELŐSZOBA</text><text x="247" y="224" fontSize="8" fontWeight="600">10,2 m²</text>
        <text x="330" y="230">KONYHA</text><text x="330" y="240" fontSize="8" fontWeight="600">8,2 m²</text>
        <text x="185" y="32">ERKÉLY</text><text x="185" y="41" fontSize="8" fontWeight="600">4,8 m²</text>
      </g>
    </symbol>
      </defs></svg>
      <div className="twt-intro">
        <div className="twt-glow" />
        <div className="twt-txt">
          <span className="twt-eyebrow">Új · 3D lakás</span>
          <h1 className="twt-h font-display">Alaprajzból bejárható,<br />méretpontos 3D lakás</h1>
          <p className="twt-lead">Feltöltöd az alaprajzot — a többit a TWINX végzi. A vevő a hirdetésből egy linkkel, belépés nélkül, telefonon is bejárhatja a lakást.</p>
          <div className="twt-steps">
            {STEPS.map((s, i) => (
              <button type="button" key={s.t} data-step={i} onClick={() => go(i)} className={`twt-st${i === cur ? " on" : ""}${i < cur ? " done" : ""}`}>
                <span className="twt-n">{i + 1}</span>
                <span style={{ flex: 1 }}><b>{s.t}</b><small>{s.d}</small><span className="twt-bar"><i data-bar /></span></span>
              </button>
            ))}
          </div>
          <div className="twt-cta">
            <button type="button" className="twt-go" onClick={onStart}>Kezdjük <span aria-hidden>→</span></button>
            <span className="twt-price"><b className="font-display">{credits} kredit</b> / 3D lakás</span>
            <button type="button" className="twt-ghost" onClick={() => go(0)}>↻ Újra</button>
            <span className="twt-trust">Kb. 3 perc · a krediteket csak a jóváhagyott tervnél vonjuk le · a link {linkDays} napig él (+{linkDays} nap: {creditsExtend} kredit)</span>
          </div>
        </div>
        <div className="twt-vis">
          {cur === 0 && (
            <div className="twt-scene twt-s1 on">
              <div className="twt-card twt-up">
                <p className="twt-display" style={{fontWeight:"800",fontSize:"15px",marginBottom:"10px"}}>Alaprajz feltöltése</p>
                <div className="twt-drop">
                  <div className="twt-paper"><svg viewBox="0 0 400 304" width="240" height="182"><use href="#twt-plan"/><use href="#twt-planLabels"/></svg></div>
                </div>
                <div className="twt-prog"><i></i></div>
                <p style={{fontSize:"12px",color:"var(--muted)",marginTop:"8px"}}>JPG, PNG vagy PDF — akár hirdetési lapról is</p>
              </div>
            </div>
          )}
          {cur === 1 && (
            <div className="twt-scene twt-s2 on">
              <div className="twt-card twt-planc" style={{position:"relative"}}>
                <svg viewBox="0 0 400 304" width="368" height="280">
                  <use href="#twt-plan"/>
                  <path className="twt-trace" d="M20 46H232V168H20Z M232 46H380V168H232Z M20 168H128V284H20Z M128 168H196V284H128Z M196 168H298V284H196Z M298 168H380V284H298Z M60 12H215V46H60Z"/>
                  <g className="twt-rl" style={{animationDelay:"1.2s"}}><rect x="84" y="56" width="84" height="22" rx="6" fill="#fff" opacity=".92"/><text x="126" y="66" fontSize="9.5" fontWeight="800" textAnchor="middle" fill="#2B2520">Nappali</text><text x="126" y="75" fontSize="8" fontWeight="700" textAnchor="middle" fill="#2f7a4f">22,4 m² ✓</text></g>
                  <g className="twt-rl" style={{animationDelay:"1.6s"}}><rect x="278" y="134" width="84" height="22" rx="6" fill="#fff" opacity=".92"/><text x="320" y="144" fontSize="9.5" fontWeight="800" textAnchor="middle" fill="#2B2520">Hálószoba</text><text x="320" y="153" fontSize="8" fontWeight="700" textAnchor="middle" fill="#2f7a4f">15,6 m² ✓</text></g>
                  <g className="twt-rl" style={{animationDelay:"2.0s"}}><rect x="40" y="206" width="70" height="22" rx="6" fill="#fff" opacity=".92"/><text x="75" y="216" fontSize="9.5" fontWeight="800" textAnchor="middle" fill="#2B2520">Szoba</text><text x="75" y="225" fontSize="8" fontWeight="700" textAnchor="middle" fill="#2f7a4f">10,8 m² ✓</text></g>
                  <g className="twt-rl" style={{animationDelay:"2.3s"}}><rect x="130" y="216" width="64" height="22" rx="6" fill="#fff" opacity=".92"/><text x="162" y="226" fontSize="9.5" fontWeight="800" textAnchor="middle" fill="#2B2520">Fürdő</text><text x="162" y="235" fontSize="8" fontWeight="700" textAnchor="middle" fill="#2f7a4f">6,8 m² ✓</text></g>
                  <g className="twt-rl" style={{animationDelay:"2.6s"}}><rect x="211" y="206" width="72" height="22" rx="6" fill="#fff" opacity=".92"/><text x="247" y="216" fontSize="9.5" fontWeight="800" textAnchor="middle" fill="#2B2520">Előszoba</text><text x="247" y="225" fontSize="8" fontWeight="700" textAnchor="middle" fill="#2f7a4f">10,2 m² ✓</text></g>
                  <g className="twt-rl" style={{animationDelay:"2.9s"}}><rect x="303" y="222" width="70" height="22" rx="6" fill="#fff" opacity=".92"/><text x="338" y="232" fontSize="9.5" fontWeight="800" textAnchor="middle" fill="#2B2520">Konyha</text><text x="338" y="241" fontSize="8" fontWeight="700" textAnchor="middle" fill="#2f7a4f">8,2 m² ✓</text></g>
                  <g className="twt-rl" style={{animationDelay:"3.2s"}}><rect x="150" y="18" width="70" height="22" rx="6" fill="#fff" opacity=".92"/><text x="185" y="28" fontSize="9.5" fontWeight="800" textAnchor="middle" fill="#2B2520">Erkély</text><text x="185" y="37" fontSize="8" fontWeight="700" textAnchor="middle" fill="#2f7a4f">4,8 m² ✓</text></g>
                </svg>
                <div className="twt-okpill" style={{position:"absolute",right:"26px",top:"24px",background:"rgba(47,158,95,.16)",color:"#2f7a4f",fontSize:"12px",fontWeight:"800",padding:"6px 12px",borderRadius:"99px"}}>7/7 helyiség rendben</div>
              </div>
            </div>
          )}
          {cur === 2 && (
            <div className="twt-scene twt-s3 on">
              <div className="twt-card twt-planc" style={{position:"relative"}} data-s3>
                <svg viewBox="0 0 400 304" width="368" height="280">
                  <use href="#twt-plan"/><use href="#twt-planLabels"/>
                  <path d="M232 51V165" stroke="#F6EDDD" strokeWidth="7"/>
                  <g className="twt-mv"><line x1="232" y1="48" x2="232" y2="166" stroke="#EF7A5A" strokeWidth="6"/><circle cx="232" cy="107" r="6" fill="#fff" stroke="#EF7A5A" strokeWidth="3"/></g>
                  <g className="twt-sel" data-at="2900" data-off="4300"><rect x="96" y="14" width="58" height="38" rx="6" fill="none" stroke="#EF7A5A" strokeWidth="2" strokeDasharray="4 3"/></g>
                  <g data-at="4300"><path d="M100 46H150" stroke="#2F7F86" strokeWidth="2.4"/><path d="M100 46V20M150 46V20" stroke="#2F7F86" strokeWidth="2"/><rect x="104" y="44" width="42" height="4" fill="#BFD9E8"/></g>
                </svg>
                <span className="twt-tag" data-at="900" data-off="2500" style={{left:"238px",top:"96px"}}>+35 cm · Háló 14,4 m²</span>
                <div className="twt-ocard" data-at="3250" style={{left:"148px",top:"50px"}}>
                  <div className="twt-oh"><b>Erkélyajtó</b><span>150 cm · Nappali ↔ Erkély</span></div>
                  <div className="twt-tls">
                    <span className="twt-tl on" data-unsel="4300"><svg><use href="#twt-icDoor"/></svg>Ajtó</span>
                    <span className="twt-tl" data-k="glass" data-sel="4300"><svg><use href="#twt-icGlass"/></svg>Üvegajtó</span>
                    <span className="twt-tl"><svg><use href="#twt-icWin"/></svg>Ablak</span>
                    <span className="twt-tl"><svg><use href="#twt-icPass"/></svg>Átjáró</span>
                  </div>
                  <div className="twt-row"><span>Szélesség</span><b>150 cm</b></div>
                  <div className="twt-sl"><i style={{width:"62%"}}></i></div>
                  <div className="twt-row"><span>Szárny</span><span className="twt-caps"><b>1</b><b className="on">2</b></span></div>
                </div>
                <span className="twt-tag" data-at="4700" style={{left:"150px",top:"230px",background:"rgba(47,158,95,.92)"}}>✓ Üvegajtó, becsukva — a 3D azonnal követi</span>
                <span className="twt-cur" data-cur><svg width="18" height="22" viewBox="0 0 18 22"><path d="M2 1l14 10-6 1 4 7-3 1.5-4-7-5 4z" fill="#fff" stroke="#12100e" strokeWidth="1.4" strokeLinejoin="round"/></svg><i data-ring></i></span>
              </div>
            </div>
          )}
          {/* a 3D-jelenetek végig a helyükön (előre betöltve), csak az aktív látszik és fut */}
          <div className="twt-3dbox" style={{ opacity: cur === 3 ? 1 : 0, pointerEvents: "none" }}>
            <IntroDollhouse opts={opts} style={style} playing={cur === 3} onProgress={cur === 3 ? progress : undefined} onEnd={next4} />
          </div>
          <div className="twt-3dbox twt-walk" style={{ opacity: cur === 4 ? 1 : 0, pointerEvents: "none" }}>
            <IntroWalkthrough opts={opts} style={style} credits={credits} playing={cur === 4} loop={false} onProgress={cur === 4 ? progress : undefined} onEnd={next5} />
          </div>
          <div className="twt-dots">
            {STEPS.map((s, i) => <button type="button" key={s.t} aria-label={s.t} className={i === cur ? "on" : ""} onClick={() => go(i)} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

const CSS = `.twt{--coral:#EF7A5A;--muted:#6E655C;--card:#FDFBF6;--ink:#1C1815;--green:#2f7a4f}
.twt-intro{position:relative;border-radius:28px;overflow:hidden;background:linear-gradient(160deg,#1B1714 0%,#12100e 55%,#1d1612 100%);color:#F4EFE7;min-height:560px;display:grid;grid-template-columns:1.05fr 1fr}
.twt-glow{position:absolute;inset:0;background:radial-gradient(50% 60% at 75% 40%,rgba(239,122,90,.20),transparent 70%);pointer-events:none}
.twt-txt{position:relative;padding:40px 36px 30px;display:flex;flex-direction:column}
.twt-eyebrow{font-size:12px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:#F08A68}
.twt-h{font-size:36px;font-weight:800;line-height:1.08;margin-top:10px;letter-spacing:-.02em}
.twt-lead{font-size:15px;line-height:1.6;color:#CFC6BB;margin-top:12px;max-width:470px}
.twt-steps{margin-top:22px;display:flex;flex-direction:column;gap:6px}
.twt-st{display:flex;gap:12px;align-items:flex-start;padding:10px 12px;border-radius:16px;transition:background .4s,opacity .4s;opacity:.45;cursor:pointer;text-align:left}
.twt-st.on{opacity:1;background:rgba(255,255,255,.06)}
.twt-st .twt-n{width:28px;height:28px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;background:rgba(255,255,255,.08)}
.twt-st.on .twt-n{background:var(--coral);color:#1c1005}
.twt-st.done .twt-n{background:rgba(47,158,95,.25);color:#9FE0BC}
.twt-st b{display:block;font-size:14.5px}
.twt-st small{display:block;font-size:12.5px;color:#BDB3A7;margin-top:2px;line-height:1.45}
.twt-bar{display:block;height:3px;border-radius:99px;background:rgba(255,255,255,.08);margin-top:7px;overflow:hidden;visibility:hidden}
.twt-st.on .twt-bar{visibility:visible}
.twt-bar i{display:block;height:100%;width:0;background:var(--coral)}
.twt-cta{margin-top:auto;padding-top:22px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.twt-go{height:52px;padding:0 28px;border-radius:99px;background:linear-gradient(160deg,#F49274,#E9693F);color:#fff;font-weight:800;font-size:16px;box-shadow:0 12px 30px rgba(233,105,63,.4);display:flex;align-items:center;gap:10px}
.twt-go:hover{filter:brightness(1.05)}
.twt-ghost{height:40px;padding:0 16px;border-radius:99px;color:#CFC6BB;font-size:13px;font-weight:600;border:1px solid rgba(255,255,255,.14)}
.twt-trust{font-size:12px;color:#9C9287;width:100%}
.twt-price{height:40px;display:inline-flex;align-items:center;gap:6px;padding:0 14px;border-radius:99px;font-size:13px;color:#F3D9A4;background:linear-gradient(135deg,rgba(212,170,92,.18),rgba(212,170,92,.06));box-shadow:inset 0 0 0 1px rgba(212,170,92,.35)}
.twt-price b{font-size:15px;color:#FFE7B8}
.twt-vis{position:relative;min-height:440px}
.twt-scene{position:absolute;inset:30px;display:flex;align-items:center;justify-content:center;animation:twt-in .6s ease both}
.twt-3dbox{position:absolute;left:24px;right:24px;top:50%;height:min(440px,calc(100% - 48px));transform:translateY(-50%);transition:opacity .6s}
.twt-3dbox.twt-walk{left:36px;right:36px;height:min(380px,calc(100% - 72px))}
@keyframes twt-in{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
.twt-card{background:var(--card);color:var(--ink);border-radius:22px;box-shadow:0 30px 70px rgba(0,0,0,.45)}
.twt-tag{position:absolute;font-size:11.5px;font-weight:700;padding:6px 10px;border-radius:99px;background:rgba(18,16,14,.85);color:#fff;white-space:nowrap;z-index:3}
.twt [data-at]{opacity:0;transition:opacity .35s}
.twt-cur{position:absolute;z-index:6;pointer-events:none;opacity:0;transition:opacity .25s;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))}
.twt-cur i{position:absolute;left:-9px;top:-9px;width:22px;height:22px;border-radius:50%;border:2px solid var(--coral);opacity:0}
@keyframes twt-ring{0%{opacity:1;transform:scale(.4)}100%{opacity:0;transform:scale(1.6)}}
.twt-ocard{position:absolute;width:214px;padding:12px;border-radius:18px;background:rgba(26,22,19,.9);backdrop-filter:blur(10px);box-shadow:0 18px 44px rgba(0,0,0,.45),inset 0 0 0 1px rgba(255,255,255,.12);color:#F4EFE7;z-index:4;text-align:left}
.twt-oh b{display:block;font-size:13.5px}
.twt-oh span{display:block;font-size:10.5px;color:#BDB3A7;margin-top:1px}
.twt-tls{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:9px}
.twt-tl{height:44px;border-radius:10px;background:rgba(255,255,255,.07);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:9.5px;font-weight:700;color:#D8CFC3;transition:background .3s,color .3s}
.twt-tl svg{width:18px;height:18px}
.twt-tl.on{background:linear-gradient(160deg,#F49274,#E9693F);color:#fff}
.twt-row{display:flex;justify-content:space-between;align-items:center;font-size:10.5px;color:#BDB3A7;margin-top:9px}
.twt-row b{color:#F4EFE7;font-size:11px}
.twt-sl{height:4px;border-radius:99px;background:rgba(255,255,255,.12);margin-top:6px;position:relative}
.twt-sl i{display:block;height:100%;border-radius:99px;background:var(--coral);position:relative}
.twt-sl i::after{content:"";position:absolute;right:-6px;top:-5px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.4)}
.twt-caps{display:flex;gap:4px}
.twt-caps b{min-width:30px;height:22px;padding:0 7px;border-radius:99px;background:rgba(255,255,255,.08);display:inline-flex;align-items:center;justify-content:center;font-size:10px;color:#D8CFC3;transition:background .3s}
.twt-caps b.on{background:var(--coral);color:#fff}
.twt-up{width:360px;max-width:100%;padding:18px}
.twt-drop{height:250px;border:2px dashed #D8CCBF;border-radius:16px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;background:#FBF8F3}
.twt-paper{width:240px;height:182px;overflow:hidden;background:#fff;border-radius:6px;box-shadow:0 10px 24px rgba(0,0,0,.18);transform:translateY(-220px) rotate(-8deg);animation:twt-drop 1.1s .3s cubic-bezier(.2,.8,.2,1.1) forwards}
@keyframes twt-drop{to{transform:none}}
.twt-prog{height:8px;border-radius:99px;background:#F1EAE1;margin-top:12px;overflow:hidden}
.twt-prog i{display:block;height:100%;width:0;background:var(--coral);animation:twt-grow 2.4s 1.4s ease forwards}
@keyframes twt-grow{to{width:100%}}
.twt-planc{width:400px;max-width:100%;padding:16px}
.twt-planc svg{max-width:100%;height:auto}
.twt-trace{stroke:var(--coral);stroke-width:3;fill:none;stroke-dasharray:1400;stroke-dashoffset:1400;animation:twt-trace 2.6s .3s ease forwards}
@keyframes twt-trace{to{stroke-dashoffset:0}}
.twt-rl{opacity:0;transform:translateY(4px);animation:twt-pop .4s forwards}
@keyframes twt-pop{to{opacity:1;transform:none}}
.twt-okpill{opacity:0;animation:twt-pop .4s 3.6s forwards}
.twt-mv{animation:twt-pull 1.5s .7s ease-in-out forwards}
@keyframes twt-pull{0%{transform:none}60%{transform:translateX(16px)}100%{transform:translateX(12px)}}
.twt-dots{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);display:flex;gap:7px;z-index:5}
.twt-dots button{width:8px;height:8px;border-radius:99px;background:rgba(255,255,255,.25);transition:width .3s,background .3s}
.twt-dots button.on{width:24px;background:var(--coral)}
@media (max-width:900px){.twt-intro{grid-template-columns:1fr}.twt-vis{min-height:420px}.twt-h{font-size:30px}}`;
