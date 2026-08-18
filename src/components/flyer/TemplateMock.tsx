// Kicsinyített, sematikus előnézet a sablonválasztóhoz.
// NEM szerver-render: a böngészőben rajzoljuk ki, a partner SAJÁT fotóival és
// arculati színével — így azonnal látszik, melyik sablon milyen elrendezést ad.
"use client";

import { buildTheme } from "@/lib/flyer-poster";
import { FLYER_SAMPLE_PHOTOS } from "@/lib/flyer-sample-photos";

type Props = {
  template: string;
  accent: string;
  /** [főkép, kis képek…] — ha még nincs feltöltve kép, minta-fotókkal mutatjuk. */
  images: string[];
};

/** Szövegsor-helyőrző. */
function Bar({ w, h = 6, c, o = 1, mt = 0, r = 2 }: {
  w: string; h?: number; c: string; o?: number; mt?: number; r?: number;
}) {
  return <div style={{ width: w, height: h, background: c, opacity: o, marginTop: mt, borderRadius: r }} />;
}

/** Fotó-helyőrző: a partner képe, ha van; különben halvány szürke folt. */
function Photo({ src, style }: { src?: string; style: React.CSSProperties }) {
  if (!src) return <div style={{ ...style, background: "#dcd7cf" }} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" style={{ ...style, objectFit: "cover" }} />;
}

export default function TemplateMock({ template, accent, images }: Props) {
  const t = buildTheme("luxus", accent);
  // Amíg nincs saját fotó, minta-képekkel érzékeltetjük az elrendezést.
  const pics = images.length ? images : FLYER_SAMPLE_PHOTOS;
  const hero = pics[0];
  const th = pics.slice(1, 4);
  const ink = t.bandInk;
  const frame: React.CSSProperties = {
    position: "relative", width: "100%", aspectRatio: "1 / 1", overflow: "hidden",
    borderRadius: 8, background: t.paper, border: "1px solid rgba(0,0,0,0.10)",
  };

  // --- PRÉMIUM: teljes felületű főkép, ár-pecsét, alul adatsáv ---------------
  if (template === "premium") {
    return (
      <div style={frame} aria-hidden>
        <Photo src={hero} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 45%)" }} />
        {/* cím a fotón */}
        <div style={{ position: "absolute", top: "8%", left: "7%", width: "62%" }}>
          <Bar w="34%" h={4} c={t.hair || "#fff"} />
          <Bar w="100%" h={11} c="#fff" mt={6} />
          <Bar w="72%" h={11} c="#fff" mt={4} />
          <Bar w="54%" h={5} c="#fff" o={0.85} mt={6} />
        </div>
        {/* jelvény */}
        <div style={{ position: "absolute", top: "7%", right: "7%", width: "18%", height: "6%", background: t.badgeBg, borderRadius: 3 }} />
        {/* alsó sáv */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "30%", background: t.band }} />
        {/* ár-pecsét a sáv élén */}
        <div style={{ position: "absolute", left: "7%", bottom: "22%", width: "26%", aspectRatio: "1 / 1", borderRadius: "50%", background: accent, border: "2px solid #fff" }} />
        {/* kis képek a sáv fölött, jobbra */}
        <div style={{ position: "absolute", right: "7%", bottom: "33%", width: "34%", display: "flex", gap: "6%" }}>
          {[0, 1].map((i) => (
            <Photo key={i} src={th[i]} style={{ width: "47%", aspectRatio: "1 / 1", borderRadius: 4, border: "2px solid #fff" }} />
          ))}
        </div>
        {/* adatok a sávban */}
        <div style={{ position: "absolute", left: "7%", bottom: "6%", width: "38%" }}>
          <Bar w="80%" h={5} c={ink} o={0.9} />
          <Bar w="62%" h={5} c={ink} o={0.9} mt={5} />
        </div>
        <div style={{ position: "absolute", right: "7%", bottom: "6%", width: "34%" }}>
          <Bar w="100%" h={5} c={ink} o={0.9} />
          <Bar w="76%" h={4} c={ink} o={0.6} mt={5} />
        </div>
      </div>
    );
  }

  // --- MAGAZIN: fotó felül, pipás előnyök + kollázs, alul kapcsolat-sáv ------
  if (template === "openhouse") {
    return (
      <div style={frame} aria-hidden>
        {/* fotó-sáv */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "45%", overflow: "hidden" }}>
          <Photo src={hero} style={{ width: "100%", height: "100%" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 70%)" }} />
          <div style={{ position: "absolute", left: "7%", bottom: "10%", width: "54%" }}>
            <Bar w="100%" h={10} c="#fff" />
            <Bar w="70%" h={10} c="#fff" mt={4} />
            <Bar w="58%" h={4} c="#fff" o={0.85} mt={5} />
          </div>
          <div style={{ position: "absolute", right: "7%", bottom: "10%", width: "28%", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <Bar w="60%" h={3} c="#fff" o={0.8} />
            <Bar w="100%" h={9} c="#fff" mt={4} />
            <Bar w="76%" h={4} c="#fff" o={0.85} mt={4} />
          </div>
        </div>
        {/* világos középső blokk */}
        <div style={{ position: "absolute", top: "45%", left: 0, right: 0, height: "38%", display: "flex", gap: 8, padding: "7%" }}>
          <div style={{ width: "40%" }}>
            <Bar w="100%" h={4} c="#8d867c" />
            <Bar w="92%" h={4} c="#8d867c" mt={4} />
            <Bar w="80%" h={4} c="#8d867c" mt={4} />
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8 }}>
                <div style={{ width: 9, height: 9, border: `1.5px solid ${t.band}`, borderRadius: 2 }} />
                <div style={{ height: 5, width: `${62 - i * 8}%`, background: t.band, borderRadius: 2 }} />
              </div>
            ))}
          </div>
          {/* kollázs: nagy bal + két álló jobbra */}
          <div style={{ flex: 1, display: "flex", gap: 5 }}>
            <Photo src={th[0]} style={{ width: "54%", height: "100%", borderRadius: 4 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
              <Photo src={th[1]} style={{ width: "100%", height: "50%", borderRadius: 4 }} />
              <Photo src={th[2]} style={{ width: "100%", height: "50%", borderRadius: 4 }} />
            </div>
          </div>
        </div>
        {/* kapcsolat-sáv */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "17%", background: t.band, display: "flex", alignItems: "center", gap: 8, padding: "0 7%" }}>
          <div style={{ width: "34%", height: 18, background: "#fff", borderRadius: 3 }} />
          <div style={{ width: 1, height: 14, background: ink, opacity: 0.4 }} />
          <div style={{ flex: 1 }}>
            <Bar w="60%" h={4} c={ink} o={0.7} />
            <Bar w="86%" h={4} c={ink} mt={4} />
          </div>
        </div>
      </div>
    );
  }

  // --- ADATLAP: ívelt fejléc, adattábla, feliratozott képrács ----------------
  return (
    <div style={frame} aria-hidden>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "30%", overflow: "hidden" }}>
        <Photo src={hero} style={{ width: "100%", height: "100%" }} />
      </div>
      {/* ívelt, alul fedő átmenet */}
      <svg viewBox="0 0 100 14" preserveAspectRatio="none"
        style={{ position: "absolute", left: 0, top: "18%", width: "100%", height: "13%" }}>
        <defs>
          <linearGradient id="mockCurve" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={t.band} stopOpacity="1" />
            <stop offset="45%" stopColor={t.band} stopOpacity="0.45" />
            <stop offset="100%" stopColor={t.band} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0,14 L0,7 C30,0 64,13 100,7 L100,14 Z" fill="url(#mockCurve)" />
      </svg>
      {/* sötét adat-sáv */}
      <div style={{ position: "absolute", top: "30%", left: 0, right: 0, height: "23%", background: t.band, display: "flex", gap: 8, padding: "0 7%", alignItems: "center" }}>
        <div style={{ width: "44%" }}>
          <Bar w="100%" h={8} c={ink} />
          <Bar w="72%" h={8} c={ink} mt={4} />
          <Bar w="86%" h={4} c={ink} o={0.7} mt={5} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Bar w="26%" h={3} c={ink} o={0.6} />
            <Bar w="46%" h={9} c={ink} />
          </div>
          {[0, 1].map((i) => (
            <div key={i} style={{ marginTop: 5 }}>
              <div style={{ height: 1, background: ink, opacity: 0.3 }} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <Bar w="24%" h={3} c={ink} o={0.6} />
                <Bar w="34%" h={4} c={ink} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* világos blokk: feliratozott képrács + áttekintés */}
      <div style={{ position: "absolute", top: "53%", left: 0, right: 0, height: "34%", display: "flex", gap: 8, padding: "5% 7%" }}>
        <div style={{ width: "56%", display: "flex", flexWrap: "wrap", gap: 5, alignContent: "flex-start" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: "calc(50% - 3px)" }}>
              <Photo src={th[i]} style={{ width: "100%", aspectRatio: "4 / 3", borderRadius: 3 }} />
              <Bar w="70%" h={3} c="#8d867c" mt={3} />
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <Bar w="66%" h={5} c="#2c2926" />
          <Bar w="100%" h={3} c="#8d867c" mt={6} />
          <Bar w="84%" h={3} c="#8d867c" mt={3} />
          <div style={{ height: 1, background: "#cfc9c1", margin: "7px 0" }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ width: "calc(50% - 3px)" }}>
                <div style={{ width: 9, height: 9, border: "1.5px solid #6f6960", borderRadius: 2 }} />
                <Bar w="80%" h={3} c="#2c2926" mt={3} />
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* kapcsolat-sáv */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "13%", background: t.band, display: "flex", alignItems: "center", gap: 8, padding: "0 7%" }}>
        <div style={{ width: "30%", height: 14, border: `1.5px solid ${ink}`, borderRadius: 3 }} />
        <Bar w="26%" h={4} c={ink} o={0.9} />
        <Bar w="30%" h={4} c={ink} o={0.9} />
      </div>
    </div>
  );
}
