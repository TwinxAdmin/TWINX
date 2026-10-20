// Hirdetéskép-varázsló — 2. lépés: ARCULAT.
// Fent: a mentett arculat adatai pipálható chipekként (mi kerüljön a hirdetésre),
// lent: a színvilág-kártyák (mini-hirdetéssel), jobbra (telefonon: kis kártya) a valódi, élő előnézet.
// A színvilágok a közös forrásból jönnek (src/lib/color-worlds.ts) — ugyanazok, mint a videóban,
// de ezt a felületen sehol nem írjuk ki.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { showToast } from "@/components/Toast";
import SelectField from "@/components/SelectField";
import type { BrandingProfile } from "@/lib/branding";
import { pickerFonts } from "@/lib/branding";
import { COLOR_WORLDS, OWN_WORLD_ID, adColors, colorWorld, type AdColors } from "@/lib/color-worlds";
import type { FlyerProfileData } from "@/lib/flyer-template";
import { compressImage } from "@/lib/image-compress";

/** A hirdetésen megjeleníthető adatok — a sorrend a chipek sorrendje. */
export const BRAND_FIELDS = [
  { key: "display_name", label: "NÉV" },
  { key: "title", label: "TITULUS" },
  { key: "phone", label: "TELEFON" },
  { key: "email", label: "E-MAIL" },
  { key: "company", label: "CÉG" },
  { key: "website", label: "WEB" },
] as const;
export type BrandFieldKey = (typeof BRAND_FIELDS)[number]["key"];
export type QuickBrand = Record<BrandFieldKey, string> & { accent_color: string; font: string };

// A látványterv színei (a TWINX krém alapjához illesztve).
const INK = "#1C1917";
const MUTED = "#6B6259";
const LINE = "#E8E0D7";
const SOFT = "#F6F2ED";
const TERRA_TEXT = "#A8432B"; // terrakotta — fehér háttéren is olvasható (≥4.5:1)

/**
 * Melyik adat NEM látszik a választott elrendezésen (az adatmezők helye fix, új helyet nem veszünk fel).
 * A chip ilyenkor egy kis jelzést kap, hogy a partner ne csodálkozzon.
 */
export function hiddenOnTemplate(template: string, on: Record<BrandFieldKey, boolean>): Set<BrandFieldKey> {
  const h = new Set<BrandFieldKey>();
  if (template === "premium") {
    if (on.display_name) h.add("company"); // a cég csak a név helyett jelenik meg
  } else if (template === "openhouse") {
    h.add("title");
    if (on.display_name) h.add("company");
  } else if (template === "unit") {
    h.add("display_name"); h.add("title"); h.add("company");
    if (on.phone || on.email) h.add("website");
  }
  return h;
}

/** Az élő előnézet minta-fotói (amíg a partner nem töltött fel sajátot). */
const SAMPLE_PHOTOS = ["visual-after.jpg", "enhance-after.jpg", "video-demo-1.jpg", "video-demo-2.jpg"].map((f) => `/showcase/${f}`);

export default function BrandStep({
  profiles, profileId, onProfile, shown, onShown, worldId, onWorld,
  quick, onQuick, template, size, images, previewProfile, onProfileSaved,
}: {
  profiles: BrandingProfile[];
  profileId: string;
  onProfile: (id: string) => void;
  shown: Record<BrandFieldKey, boolean>;
  onShown: (next: Record<BrandFieldKey, boolean>) => void;
  worldId: string;
  onWorld: (id: string) => void;
  quick: QuickBrand;
  onQuick: (next: QuickBrand) => void;
  template: string;
  size: string;
  images: string[];
  /** A hirdetésre ténylegesen kerülő adatok (a ki nem pipáltak már üresek). */
  previewProfile: FlyerProfileData;
  /** Az „Adatok szerkesztése" mentése után a frissített arculat. */
  onProfileSaved: (p: BrandingProfile) => void;
}) {
  const profile = profiles.find((p) => p.id === profileId) ?? null;
  const ownAccent = profile?.accent_color ?? quick.accent_color;
  // Telefonon az első 4 színvilág látszik; ha a (megjegyzett) választás a többi közt van, eleve kinyitjuk.
  const [moreWorlds, setMoreWorlds] = useState(() => ![COLOR_WORLDS[0].id, OWN_WORLD_ID, COLOR_WORLDS[1]?.id, COLOR_WORLDS[2]?.id].includes(worldId));
  const [editing, setEditing] = useState(false);
  const [bigPreview, setBigPreview] = useState(false);

  // --- Megjelenő adatok (chipek) ---
  const values: Record<BrandFieldKey, string> = profile
    ? { display_name: profile.display_name, title: profile.title, phone: profile.phone, email: profile.email, company: profile.company, website: profile.website }
    : { display_name: quick.display_name, title: quick.title, phone: quick.phone, email: quick.email, company: quick.company, website: quick.website };
  const filled = BRAND_FIELDS.filter((f) => values[f.key]?.trim());
  const allOn = filled.length > 0 && filled.every((f) => shown[f.key]);
  const hidden = hiddenOnTemplate(template, shown);
  const toggleAll = () => {
    const next = { ...shown };
    for (const f of BRAND_FIELDS) next[f.key] = values[f.key]?.trim() ? !allOn : false;
    onShown(next);
  };

  // --- Színvilágok (első: TWINX, második: Saját szín, utána a többi) ---
  const worlds = useMemo(() => {
    const twinx = COLOR_WORLDS[0];
    const rest = COLOR_WORLDS.slice(1);
    return [
      { id: twinx.id, name: twinx.name, mood: twinx.mood },
      { id: OWN_WORLD_ID, name: "Saját szín", mood: profile ? "A mentett arculatod" : "A megadott fő színed" },
      ...rest.map((w) => ({ id: w.id, name: w.name, mood: w.mood })),
    ];
  }, [profile]);
  const current = worlds.find((w) => w.id === worldId) ?? worlds[0];

  return (
    <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-8">
      <div className="min-w-0 space-y-8">
        {/* A) MEGJELENŐ ADATOK */}
        {profiles.length ? (
          <section className="space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h3 className="text-[15px] font-semibold" style={{ color: INK }}>Megjelenő adatok</h3>
              <div className="flex items-center gap-1">
                {/* A gomb kicsi, de a kattintható terület 44 px magas. */}
                <button type="button" onClick={toggleAll} disabled={!filled.length}
                  className="group flex min-h-[44px] items-center px-1 disabled:opacity-40">
                  <span className="flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition group-hover:shadow-sm"
                    style={{ border: "1px solid #DDD3C9", background: "#fff", color: INK }}>
                    <Check size={12} color={INK} />
                    <span className="sm:hidden">Összes</span>
                    <span className="hidden sm:inline">{allOn ? "Összes kijelölés törlése" : "Összes kijelölése"}</span>
                  </span>
                </button>
                <button type="button" onClick={() => setEditing(true)} disabled={!profile}
                  className="flex min-h-[44px] items-center px-2 text-[13px] font-medium hover:underline disabled:opacity-40" style={{ color: TERRA_TEXT }}>
                  <span className="sm:hidden">Szerkesztés</span>
                  <span className="hidden sm:inline">Adatok szerkesztése</span>
                </button>
              </div>
            </div>

            {/* Több mentett arculat: egyetlen legördülő (nem külön kártyák). */}
            {profiles.length > 1 && (
              <div className="max-w-xs">
                <SelectField value={profileId} onChange={onProfile} ariaLabel="Mentett arculat"
                  options={profiles.map((p) => ({ value: p.id, label: p.label || p.display_name }))} />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {BRAND_FIELDS.map((f) => {
                const v = values[f.key]?.trim();
                const on = !!v && shown[f.key];
                const notHere = on && hidden.has(f.key);
                return (
                  <label key={f.key}
                    title={!v ? "Nincs megadva — az „Adatok szerkesztése” alatt kitöltheted." : notHere ? "Ebben a megjelenésben ez az adat nem látszik." : undefined}
                    className="flex min-h-[44px] max-w-full items-center gap-2.5 rounded-full py-1 pl-3.5 pr-4 transition"
                    style={{
                      border: `1px solid ${on ? INK : "#E3DAD0"}`,
                      background: on ? "#fff" : SOFT,
                      cursor: v ? "pointer" : "default",
                    }}>
                    <input type="checkbox" checked={on} disabled={!v}
                      onChange={() => onShown({ ...shown, [f.key]: !shown[f.key] })}
                      className="h-[18px] w-[18px] shrink-0 cursor-pointer disabled:cursor-default" style={{ accentColor: INK }} />
                    <span className="shrink-0 text-[11px] font-semibold tracking-[0.08em]" style={{ color: MUTED }}>{f.label}</span>
                    <span className="min-w-0 truncate text-sm font-medium"
                      style={{
                        color: !v ? "#8C8279" : on ? INK : "#8C8279",
                        fontStyle: v ? "normal" : "italic",
                        textDecoration: v && !on ? "line-through" : "none",
                      }}>
                      {v || "nincs megadva"}
                    </span>
                    {notHere && (
                      <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: SOFT, color: MUTED }}>
                        itt nem látszik
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </section>
        ) : (
          <QuickForm quick={quick} onQuick={onQuick} />
        )}

        {/* B) SZÍNVILÁG */}
        <section className="space-y-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="text-[15px] font-semibold" style={{ color: INK }}>Színvilág</h3>
            <span className="text-[13px]" style={{ color: MUTED }}>{current.name} · {current.mood}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-3.5">
            {worlds.map((w, i) => (
              <WorldCard key={w.id} name={w.name} mood={w.mood} selected={w.id === worldId}
                colors={adColors(w.id, ownAccent)} hideOnPhone={!moreWorlds && i >= 4}
                onPick={() => onWorld(w.id)} />
            ))}
          </div>
          {!moreWorlds && worlds.length > 4 && (
            <button type="button" onClick={() => setMoreWorlds(true)}
              className="flex min-h-[44px] w-full items-center justify-center text-[13px] font-medium sm:hidden" style={{ color: TERRA_TEXT }}>
              Még {worlds.length - 4} színvilág
            </button>
          )}
        </section>
      </div>

      {/* C) ÉLŐ ELŐNÉZET — asztalon jobbra, telefonon kis kártya „Megnézem" linkkel */}
      <LivePreview worldId={worldId} profile={previewProfile} template={template} size={size} images={images}
        worldName={current.name} dataCount={BRAND_FIELDS.filter((f) => previewProfile[f.key]?.trim()).length}
        big={bigPreview} onBig={setBigPreview} colors={adColors(worldId, ownAccent)} />

      {editing && profile && (
        <EditDataModal profile={profile} onClose={() => setEditing(false)}
          onSaved={(p) => { onProfileSaved(p); setEditing(false); }} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function Check({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12l5 5L19 7" />
    </svg>
  );
}

/** Színvilág-kártya: felül egy mini-hirdetés az adott színekkel (nem pöttyök), alatta név, hangulat, 3 színpötty. */
function WorldCard({ name, mood, colors: c, selected, onPick, hideOnPhone }: {
  name: string; mood: string; colors: AdColors; selected: boolean; onPick: () => void; hideOnPhone: boolean;
}) {
  const line = (w: string, h: number, bg: string, mt: number) => (
    <span className="block rounded-[3px]" style={{ width: w, height: h, background: bg, marginTop: mt }} />
  );
  return (
    <button type="button" onClick={onPick} aria-pressed={selected} aria-label={`${name} — ${mood}`}
      className={`relative flex-col gap-0.5 rounded-2xl bg-white p-2 text-left transition ${hideOnPhone ? "hidden sm:flex" : "flex"}`}
      style={{
        boxShadow: selected ? `0 0 0 2px ${INK}, 0 10px 24px rgba(0,0,0,0.12)` : `0 0 0 1px ${LINE}`,
        transform: selected ? "translateY(-2px)" : "none",
      }}>
      <span className="flex h-[140px] flex-col rounded-[10px] p-2" style={{ background: c.bg }}>
        <span className="relative block h-[52px] rounded-md" style={{ background: "linear-gradient(135deg,#cfc6ba,#a99f92)" }}>
          <span className="absolute left-1.5 top-1.5 block h-[9px] w-[26px] rounded-[2px]" style={{ background: c.band }} />
        </span>
        {line("80%", 7, c.ink, 10)}
        {line("55%", 4, c.muted, 5)}
        {line("45%", 8, c.accent, 7)}
        <span className="mt-auto flex h-[24px] flex-col justify-center gap-1 rounded-[5px] px-2" style={{ background: c.band }}>
          {line("60%", 4, c.bandInk, 0)}
          {line("40%", 3, c.bandInk, 0)}
        </span>
      </span>
      <span className="flex items-center justify-between gap-1.5 px-1 pt-2.5">
        <span className="truncate text-[13px] font-semibold" title={name} style={{ color: INK }}>{name}</span>
        <span className="flex shrink-0 gap-[3px]">
          {[c.band, c.bg, c.ink].map((d, i) => (
            <span key={i} className="block h-3 w-3 rounded-full" style={{ background: d, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)" }} />
          ))}
        </span>
      </span>
      {/* Fix 2 soros hely: minden kártya egyforma magas, akármilyen hosszú a hangulat. */}
      <span className="line-clamp-2 min-h-[2.6em] px-1 pb-0.5 text-xs leading-[1.3]" style={{ color: MUTED }}>{mood}</span>
      {selected && (
        <span className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full"
          style={{ background: INK, boxShadow: "0 2px 6px rgba(0,0,0,0.25)" }}>
          <Check size={13} color="#fff" />
        </span>
      )}
    </button>
  );
}

/**
 * Élő előnézet: a VALÓDI hirdetéskép (ugyanaz a render, mint a kész hirdetésé), kis méretben.
 * Minden pipa / színvilág-váltás után frissül (rövid várakozással, hogy a gyors kattintgatás ne terheljen).
 * A doboz mérete fix (a választott méret arányában) — betöltés közben a régi kép marad, halványítva.
 */
function LivePreview({ worldId, profile, template, size, images, worldName, dataCount, big, onBig, colors }: {
  worldId: string; profile: FlyerProfileData; template: string; size: string; images: string[];
  worldName: string; dataCount: number; big: boolean; onBig: (v: boolean) => void; colors: AdColors;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const cache = useRef<Map<string, string>>(new Map());
  const photos = useRef<{ key: string; files: File[] } | null>(null);
  const [w, h] = size === "9:16" ? [9, 16] : size === "4:3" ? [4, 3] : [1, 1];

  const key = JSON.stringify([worldId, template, size, images.slice(0, 4), profile]);
  useEffect(() => {
    const hit = cache.current.get(key);
    if (hit) { setUrl(hit); setLoading(false); setFailed(false); return; }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        // A fotók: a partner saját képei (ha már feltöltött), különben minta-fotók — egyszer tömörítve.
        const srcs = images.length ? images.slice(0, 4) : SAMPLE_PHOTOS;
        const pk = srcs.join("|");
        if (photos.current?.key !== pk) {
          const files = await Promise.all(srcs.map(async (u) => {
            const b = await (await fetch(u)).blob();
            return compressImage(new File([b], "kep.jpg", { type: b.type || "image/jpeg" }), 1200, 0.85);
          }));
          photos.current = { key: pk, files };
        }
        const fd = new FormData();
        for (const f of photos.current.files) fd.append("images", f);
        fd.append("profile", JSON.stringify(profile));
        fd.append("world", worldId);
        fd.append("size", size);
        fd.append("template", template);
        fd.append("watermark", "1");
        fd.append("scale", "0.6");
        fd.append("title", "Újépítésű családi ház");
        fd.append("subtitle", "Csendes utca, nagy kert");
        fd.append("price", "89900000");
        fd.append("chips", JSON.stringify(["4 szoba", "Családi ház"]));
        fd.append("details", JSON.stringify({ size: "128", rooms: "4 szoba", bathrooms: "2 fürdőszoba", floor: "földszint", structure: "Tégla", condition: "Új építésű" }));
        fd.append("highlights", JSON.stringify(["Nagy kert", "Garázs"]));
        fd.append("blurb", "Világos, tágas otthon a város csendes részén, nagy kerttel és garázzsal.");
        fd.append("thumbLabels", JSON.stringify(["NAPPALI", "KONYHA", "FÜRDŐSZOBA"]));
        const res = await fetch("/api/flyer/render", { method: "POST", body: fd });
        if (!res.ok) throw new Error(await res.text());
        const u = URL.createObjectURL(await res.blob());
        cache.current.set(key, u);
        if (!cancelled) { setUrl(u); setFailed(false); }
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const frame = (
    <div className="relative w-full overflow-hidden rounded-[18px]"
      style={{ aspectRatio: `${w} / ${h}`, background: colors.bg, boxShadow: "0 18px 40px rgba(0,0,0,0.18)" }}>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="A hirdetés élő előnézete" className="absolute inset-0 h-full w-full object-cover transition-opacity"
          style={{ opacity: loading ? 0.55 : 1 }} />
      )}
      {(loading || (!url && !failed)) && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="h-7 w-7 animate-spin rounded-full border-2" style={{ borderColor: `${INK}33`, borderTopColor: INK }} />
        </span>
      )}
      {failed && !loading && (
        <span className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs" style={{ color: MUTED, background: SOFT }}>
          Az előnézet most nem készült el — a kész hirdetést ez nem érinti.
        </span>
      )}
    </div>
  );

  return (
    <>
      {/* Asztal: jobb oldali, ragadós előnézet */}
      <aside className="hidden lg:block">
        <div className="sticky top-0 space-y-3">
          <span className="block text-[11px] font-semibold tracking-[0.2em]" style={{ color: MUTED }}>ÉLŐ ELŐNÉZET</span>
          <div className={size === "9:16" ? "mx-auto w-[72%]" : ""}>{frame}</div>
          <p className="text-[11px] leading-snug" style={{ color: MUTED }}>
            Minta-fotókkal és -szöveggel — a te képeid és adataid a következő lépésekben kerülnek rá.
          </p>
        </div>
      </aside>

      {/* Telefon: kis kártya, „Megnézem" → nagy nézet */}
      <section className="flex items-center gap-3.5 rounded-2xl bg-white p-3 lg:hidden" style={{ boxShadow: `0 0 0 1px ${LINE}` }}>
        <div className="flex h-[76px] w-[60px] shrink-0 flex-col overflow-hidden rounded-lg" style={{ background: colors.bg }}>
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <>
              <span className="flex-1" style={{ background: "#BDB3A8" }} />
              <span className="mx-1.5 mt-1.5 h-2 w-3/5 rounded-sm" style={{ background: colors.ink }} />
              <span className="mt-1.5 h-[18px]" style={{ background: colors.band }} />
            </>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <span className="block text-sm font-semibold" style={{ color: INK }}>Előnézet</span>
          <span className="block truncate text-xs" style={{ color: MUTED }}>{worldName} · {dataCount} adat</span>
        </div>
        <button type="button" onClick={() => onBig(true)} className="flex min-h-[44px] items-center px-1 text-[13px] font-medium" style={{ color: TERRA_TEXT }}>
          Megnézem
        </button>
      </section>
      {big && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-5 lg:hidden" style={{ background: "rgba(20,12,8,0.7)" }}
          onClick={() => onBig(false)}>
          <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            {frame}
            <button type="button" onClick={() => onBig(false)}
              className="mx-auto mt-4 flex h-11 items-center rounded-full bg-white px-6 text-sm font-semibold" style={{ color: INK }}>
              Bezárás
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Ha még nincs mentett arculat: egyszeri űrlap — a „Tovább" elmenti arculatként, onnantól a pipás nézet látszik. */
function QuickForm({ quick, onQuick }: { quick: QuickBrand; onQuick: (q: QuickBrand) => void }) {
  const set = (k: keyof QuickBrand, v: string) => onQuick({ ...quick, [k]: v });
  // A választható betűk betöltése, hogy a nevük a saját betűjükkel látszódjon.
  useEffect(() => {
    for (const f of pickerFonts(quick.font)) {
      if (document.querySelector(`link[data-twx-font="${f.value}"]`)) continue;
      const el = document.createElement("link");
      el.rel = "stylesheet";
      el.href = f.link;
      el.dataset.twxFont = f.value;
      document.head.appendChild(el);
    }
  }, [quick.font]);
  return (
    <section className="space-y-3.5">
      <div>
        <h3 className="text-[15px] font-semibold" style={{ color: INK }}>Megjelenő adatok</h3>
        <p className="mt-0.5 text-xs" style={{ color: MUTED }}>
          Csak egyszer kell megadnod — elmentjük arculatként, legközelebb már csak pipálsz.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <QField label="Név" value={quick.display_name} onChange={(v) => set("display_name", v)} placeholder="pl. Kovács Péter" />
        <QField label="Titulus" value={quick.title} onChange={(v) => set("title", v)} placeholder="pl. ingatlanértékesítő" />
        <QField label="Telefon" value={quick.phone} onChange={(v) => set("phone", v)} placeholder="pl. +36 30 123 4567" />
        <QField label="E-mail" value={quick.email} onChange={(v) => set("email", v)} placeholder="pl. peter@iroda.hu" />
        <QField label="Cégnév" value={quick.company} onChange={(v) => set("company", v)} placeholder="pl. Prémium Ingatlanok" />
        <QField label="Weboldal" value={quick.website} onChange={(v) => set("website", v)} placeholder="pl. iroda.hu" />
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <span className="block text-xs font-medium" style={{ color: MUTED }}>Fő szín (a „Saját szín” színvilághoz)</span>
          <div className="mt-1 flex items-center gap-2">
            <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(quick.accent_color) ? quick.accent_color : "#1e3a5f"}
              onChange={(e) => set("accent_color", e.target.value)} aria-label="Fő szín"
              className="h-10 w-12 cursor-pointer rounded" style={{ border: `1px solid ${LINE}` }} />
            <input type="text" value={quick.accent_color} onChange={(e) => set("accent_color", e.target.value)} aria-label="Fő szín kódja"
              className="twx-input w-28 text-sm" />
          </div>
        </div>
      </div>
      {/* Betűtípus — válogatott lista, minden név a SAJÁT betűjével */}
      <div>
        <span className="block text-xs font-medium" style={{ color: MUTED }}>Betűtípus (a „Saját szín” színvilághoz)</span>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {pickerFonts(quick.font).map((f) => {
            const on = quick.font === f.value;
            return (
              <button key={f.value} type="button" onClick={() => set("font", f.value)} aria-pressed={on} title={f.label}
                className="flex min-h-[44px] items-center rounded-xl bg-white px-3 text-left transition hover:shadow-sm"
                style={{ border: `1px solid ${on ? INK : LINE}`, boxShadow: on ? `0 0 0 1px ${INK}` : undefined }}>
                <span className="truncate text-[15px]" style={{ fontFamily: f.family, color: INK }}>{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function QField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium" style={{ color: MUTED }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="twx-input mt-1 w-full text-sm" />
    </label>
  );
}

/** „Adatok szerkesztése": a mentett arculat 6 adata — a többi (szín, betű, logó, fotó) változatlan marad. */
function EditDataModal({ profile, onClose, onSaved }: {
  profile: BrandingProfile; onClose: () => void; onSaved: (p: BrandingProfile) => void;
}) {
  const [v, setV] = useState<Record<BrandFieldKey, string>>({
    display_name: profile.display_name, title: profile.title, phone: profile.phone,
    email: profile.email, company: profile.company, website: profile.website,
  });
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!v.display_name.trim()) { showToast("A név nem lehet üres.", "error"); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("id", profile.id);
      // A teljes arculatot küldjük (a szerver felülírja) — a nem szerkesztett mezők a régiek.
      const all = { ...profile, ...v } as unknown as Record<string, unknown>;
      for (const k of ["label", "display_name", "title", "phone", "email", "company", "website", "slogan", "accent_color", "font", "theme"]) {
        fd.append(k, String(all[k] ?? ""));
      }
      const res = await fetch("/api/branding", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error || (data.errors ? Object.values(data.errors as Record<string, string>).join(" ") : "Nem sikerült menteni.");
        throw new Error(msg);
      }
      onSaved({ ...profile, ...v });
      showToast("Adatok mentve.", "success");
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(20,12,8,0.55)" }}>
      <div className="w-full max-w-lg rounded-[22px] p-5 sm:p-6" style={{ background: "#FCFAF7", boxShadow: "0 30px 70px rgba(0,0,0,0.3)" }}>
        <h3 className="text-lg font-semibold" style={{ color: INK }}>Adatok szerkesztése</h3>
        <p className="mt-0.5 text-xs" style={{ color: MUTED }}>
          A „{profile.label}” arculat adatai — a módosítás minden további hirdetésnél érvényes.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <QField label="Név" value={v.display_name} onChange={(x) => setV({ ...v, display_name: x })} />
          <QField label="Titulus" value={v.title} onChange={(x) => setV({ ...v, title: x })} />
          <QField label="Telefon" value={v.phone} onChange={(x) => setV({ ...v, phone: x })} />
          <QField label="E-mail" value={v.email} onChange={(x) => setV({ ...v, email: x })} />
          <QField label="Cégnév" value={v.company} onChange={(x) => setV({ ...v, company: x })} />
          <QField label="Weboldal" value={v.website} onChange={(x) => setV({ ...v, website: x })} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving}
            className="h-11 rounded-full px-5 text-sm" style={{ border: "1px solid #DDD3C9", background: "#fff", color: INK }}>Mégse</button>
          <button type="button" onClick={() => void save()} disabled={saving}
            className="h-11 rounded-full px-6 text-sm font-semibold text-white disabled:opacity-60" style={{ background: INK }}>
            {saving ? "Mentés…" : "Mentés"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** A színvilág létezik-e (az emlékezetből visszatöltött érték ellenőrzéséhez). */
export function isKnownWorld(id: string): boolean {
  return id === OWN_WORLD_ID || !!colorWorld(id);
}
