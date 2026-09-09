// Egyoldalas, ARCULATOS értékbecslés-lap (A4).
//
// Ez az, amit az ügyfél kézhez kap: egyetlen ár, az ingatlan adatai, rövid
// indoklás és egy kis sáv-grafikon. Nincsenek benne források, levezetés és
// technikai részletek — azok a részletes riportban maradnak.
//
// Az arculat (logó, szín, betűtípus, elérhetőségek) a partner branding
// profiljából jön; profil nélkül a TWINX alapszínekkel rajzolódik.
"use client";

import { getBrandingFont, type BrandingProfile } from "@/lib/branding";
import { shortHuf, type OnePagerData } from "@/lib/valuation-onepager";

export const ONEPAGER_W = 794;  // A4 szélesség 96 dpi-n
export const ONEPAGER_H = 1123; // A4 magasság

/** Olvasható szövegszín az adott háttéren (fehér vagy sötét). */
function contrastText(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  // ITU-R BT.601 luminancia
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#1c1815" : "#ffffff";
}

export default function OnePagerPaper({
  data, profile, photos = [],
}: {
  data: OnePagerData;
  profile: BrandingProfile | null;
  /** Az ingatlan fotói (max 2) — a lap ALJÁN, az adatok alatt jelennek meg,
   *  egymás mellett. Üres lista → a sáv kimarad, a lap tartalma kitölti a helyet. */
  photos?: string[];
}) {
  const pics = photos.filter(Boolean).slice(0, 2);
  const accent = profile && /^#[0-9a-fA-F]{6}$/.test(profile.accent_color)
    ? profile.accent_color
    : "#ef7a5a";
  const onAccent = contrastText(accent);
  const font = getBrandingFont(profile?.font ?? "inter");
  const ink = "#1c1815";
  const muted = "#6f675f";
  const line = "#e8e1d6";

  // Elérhetőségek ikonnal — a fejléc jobb oldali blokkjához.
  const icon = {
    phone: <path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .6 3.6 1 1 0 0 1-.25 1z" />,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    web: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  };
  const contactRows: { key: keyof typeof icon; text: string }[] = [
    { key: "phone", text: String(profile?.phone ?? "").trim() },
    { key: "mail", text: String(profile?.email ?? "").trim() },
    { key: "web", text: String(profile?.website ?? "").trim() },
  ].filter((r) => r.text) as { key: keyof typeof icon; text: string }[];

  // A sáv-grafikonhoz: hol áll a javasolt ár az értéksávon belül.
  const hasRange = data.rangeLow > 0 && data.rangeHigh > data.rangeLow;
  const pos = hasRange && data.priceNum
    ? Math.min(96, Math.max(4, ((data.priceNum - data.rangeLow) / (data.rangeHigh - data.rangeLow)) * 100))
    : 50;

  return (
    <>
      {font.link && <link rel="stylesheet" href={font.link} />}
      <div
        data-onepager="1"
        style={{
          width: ONEPAGER_W,
          height: ONEPAGER_H,
          background: "#ffffff",
          color: ink,
          fontFamily: font.family,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        {/* ---------- FEJLÉC: arculat + halvány városrajz ---------- */}
        <div style={{
          background: accent, color: onAccent, padding: "26px 48px",
          display: "flex", alignItems: "center", gap: 20, position: "relative", overflow: "hidden",
        }}>
          {/* Vonalas háztető-sziluett — az arculati színnel egybeolvadó, halvány díszítés. */}
          <svg viewBox="0 0 520 110" aria-hidden
            style={{ position: "absolute", right: -10, bottom: -6, width: 520, height: 110, opacity: 0.16 }}
            fill="none" stroke={onAccent} strokeWidth="1.6" strokeLinejoin="round">
            <path d="M0 105 H520" />
            <path d="M10 105 V70 H40 V52 H62 V105" /><path d="M80 105 V40 H98 V28 H118 V40 H132 V105" />
            <path d="M150 105 V60 H176 V105" /><path d="M190 105 V22 H206 V10 H222 V22 H238 V105" />
            <path d="M255 105 V66 H290 V105" /><path d="M304 105 V48 H320 V34 H346 V48 H358 V105" />
            <path d="M372 105 V74 H404 V60 H420 V105" /><path d="M436 105 V30 H452 V18 H468 V30 H486 V105" /><path d="M500 105 V80 H520" />
            <path d="M20 90h12M26 84v12M88 70h8M92 66v8M198 60h10M203 55v10M312 80h8M316 76v8M444 70h10M449 65v10" strokeWidth="1" opacity="0.8" />
          </svg>

          {/* Bal oldal: a partner logója, ha van — egyébként általános felirat. */}
          <div style={{ position: "relative" }}>
            {profile?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.logo_url} alt="" crossOrigin="anonymous"
                style={{ height: 54, width: "auto", maxWidth: 200, objectFit: "contain" }} />
            ) : (
              <div>
                <div style={{ fontSize: 11, letterSpacing: 2.6, textTransform: "uppercase", opacity: 0.85, lineHeight: 1 }}>Ingatlan</div>
                {/* Kis rés a két sor között, hogy ne érjenek össze. */}
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 0.5, lineHeight: 1.1, marginTop: 7 }}>Értékbecslés</div>
              </div>
            )}
          </div>

          {/* Jobb oldal: aki készítette — név, titulus, cég, majd az
              elérhetőségek egy rendezett, ikonos blokkban. */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16, position: "relative" }}>
            <div style={{ textAlign: "right", lineHeight: 1.4 }}>
              {profile?.display_name && (
                <div style={{ fontSize: 15, fontWeight: 700 }}>{profile.display_name}</div>
              )}
              {profile?.title && <div style={{ fontSize: 12, opacity: 0.85 }}>{profile.title}</div>}
              {profile?.company && <div style={{ fontSize: 12, opacity: 0.85 }}>{profile.company}</div>}
            </div>
            {contactRows.length > 0 && (
              <div style={{
                borderLeft: `1px solid ${onAccent}55`, paddingLeft: 16,
                display: "flex", flexDirection: "column", gap: 5, fontSize: 12, lineHeight: 1.3,
              }}>
                {contactRows.map((r) => (
                  <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={onAccent}
                      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.85, flexShrink: 0 }}>
                      {icon[r.key]}
                    </svg>
                    <span>{r.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ---------- TÖRZS ---------- */}
        <div style={{ flex: 1, padding: "30px 48px 0", display: "flex", flexDirection: "column" }}>
          {/* Cím + ár — teljes szélességben (a fotók a lap alján kapnak helyet,
              így az ár-doboz soha nem ütközik képpel). */}
          <div style={{ display: "flex", gap: 22, alignItems: "stretch" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, letterSpacing: 2.4, textTransform: "uppercase", color: muted }}>
                Piaci értékbecslés
              </div>
              <div style={{ fontSize: 27, fontWeight: 700, marginTop: 6, lineHeight: 1.15 }}>{data.title}</div>
              {data.subtitle && (
                <div style={{ fontSize: 14, color: muted, marginTop: 4 }}>{data.subtitle}</div>
              )}

              {/* ---------- AZ ÁR: egyetlen szám, kiemelve ---------- */}
              <div style={{
                marginTop: 18, borderRadius: 16, border: `2px solid ${accent}`,
                padding: "20px 26px",
                display: "flex", alignItems: "center", gap: 20, flexWrap: "nowrap",
              }}>
                <div>
                  <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: muted }}>
                    Javasolt ár
                  </div>
                  {/* Egy sorban, a „Ft” a szám mellett marad (nowrap). */}
                  <div style={{ fontSize: 36, fontWeight: 800, color: accent, lineHeight: 1.1, marginTop: 4, whiteSpace: "nowrap" }}>
                    {data.price || "—"}
                  </div>
                </div>
                {(data.range || data.pricePerM2) && (
                  // Egy-egy sorban, tördelés nélkül: a felirat és az érték nem
                  // szakadhat el egymástól (whiteSpace: nowrap).
                  <div style={{ marginLeft: "auto", textAlign: "right", fontSize: 12.5, color: muted, lineHeight: 1.7, whiteSpace: "nowrap", flexShrink: 0 }}>
                    {data.range && <div>Reális sáv: <strong style={{ color: ink }}>{data.range}</strong></div>}
                    {data.pricePerM2 && <div>Négyzetméterár: <strong style={{ color: ink }}>{data.pricePerM2}</strong></div>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ---------- KIS GRAFIKON: hol áll az ár a sávban ---------- */}
          {hasRange && (
            <div style={{ marginTop: 18 }}>
              <div style={{ position: "relative", height: 10, borderRadius: 999, background: "#f1ece4" }}>
                <div style={{
                  position: "absolute", left: "8%", right: "8%", top: 0, bottom: 0,
                  borderRadius: 999, background: `${accent}33`,
                }} />
                <div style={{
                  position: "absolute", left: `${pos}%`, top: -5, width: 20, height: 20,
                  marginLeft: -10, borderRadius: 999, background: accent,
                  border: "3px solid #ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: muted, marginTop: 8 }}>
                <span>Óvatos ár · {shortHuf(data.rangeLow)}</span>
                <span>Javasolt ár</span>
                <span>Optimista ár · {shortHuf(data.rangeHigh)}</span>
              </div>
            </div>
          )}

          {/* ---------- KÉT OSZLOP: adatok + indoklás ---------- */}
          <div style={{ display: "flex", gap: 28, marginTop: 26, flex: pics.length ? "0 0 auto" : 1 }}>
            {/* Az ingatlan adatai */}
            <div style={{ width: 300 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", color: muted }}>
                Az ingatlan adatai
              </div>
              <div style={{ marginTop: 10, border: `1px solid ${line}`, borderRadius: 12, overflow: "hidden" }}>
                {data.facts.map((f, i) => (
                  <div key={f.label} style={{
                    display: "flex", justifyContent: "space-between", gap: 12,
                    padding: "9px 14px", fontSize: 13,
                    background: i % 2 ? "#faf8f5" : "#ffffff",
                    borderTop: i ? `1px solid ${line}` : "none",
                  }}>
                    <span style={{ color: muted }}>{f.label}</span>
                    <span style={{ fontWeight: 600, textAlign: "right", maxWidth: 190 }}>{f.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Miért ennyi az ár? */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", color: muted }}>
                Miért ennyi az ár?
              </div>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                {data.reasons.map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, fontSize: 13.5, lineHeight: 1.55 }}>
                    <span style={{
                      flexShrink: 0, width: 20, height: 20, borderRadius: 999, marginTop: 1,
                      background: accent, color: onAccent, fontSize: 11, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>{i + 1}</span>
                    <span>{r}</span>
                  </div>
                ))}
                {!data.reasons.length && (
                  <div style={{ fontSize: 13, color: muted }}>
                    A becslés a környék elmúlt 12 hónapban eladó és eladott, hasonló méretű és
                    állapotú ingatlanjainak árából készült, az ingatlan egyedi jellemzőire
                    korrigálva.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ---------- FOTÓK: a lap alján, egymás mellett (max 2) ---------- */}
          {pics.length > 0 && (
            <div style={{
              flex: 1, minHeight: 0, marginTop: 22, marginBottom: 18,
              display: "flex", gap: 16,
            }}>
              {pics.map((url, i) => (
                <div key={`${url}-${i}`} style={{
                  flex: 1, minWidth: 0, borderRadius: 16, overflow: "hidden",
                  background: "#f1ece4", border: `1px solid ${line}`,
                  // Egy képnél is legfeljebb a rendelkezésre álló sáv magasságát foglalja.
                  maxHeight: 250,
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" crossOrigin="anonymous"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---------- LÁBLÉC ---------- */}
        <div style={{ padding: "0 48px 26px" }}>
          <div style={{ borderTop: `1px solid ${line}`, paddingTop: 14, display: "flex", gap: 18, alignItems: "flex-end" }}>
            <div style={{ fontSize: 10.5, color: muted, lineHeight: 1.5, flex: 1 }}>
              Tájékoztató jellegű piaci becslés, nem minősül hivatalos értékbecslésnek vagy
              hitelbiztosítéki értékelésnek. Készült: {data.dateLabel}.
              {/* A TWINX jelzés MINDIG rajta van — arculatos lapon is, visszafogottan. */}
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  display: "inline-block", padding: "2px 7px", borderRadius: 4,
                  background: "#12100e", color: "#ffffff", fontSize: 9, fontWeight: 800, letterSpacing: 1.2,
                }}>TWINX</span>
                <span>Az értékbecslés a TWINX AI Portál piaci adatelemző motorjával készült · twinx.hu</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
