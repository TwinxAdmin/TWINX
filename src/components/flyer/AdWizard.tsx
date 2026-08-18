// Hirdetés-varázsló: Arculat → Képek → Adatok → Stílus → Előnézet.
// A hirdetést kódból rajzoljuk (nincs AI): a fotókat egy igényes sablonba rendezzük,
// a feliratokat élesen írjuk rá — így az ékezetek, a telefonszám és az e-mail mindig hibátlan.
"use client";

import { useEffect, useRef, useState } from "react";
import { showToast } from "@/components/Toast";
import AssetTray, { readTwxDragUrl } from "@/components/AssetTray";
import { compressImage } from "@/lib/image-compress";
import { toDownloadUrl } from "@/lib/files";
import type { BrandingProfile } from "@/lib/branding";
import { BRANDING_FONTS } from "@/lib/branding";
import {
  FLYER_TONES, EMPTY_FACTS, EMPTY_TEXT, MAX_FLYER_IMAGES, FLYER_CREDITS, FLYER_BLURB_MAX,
  ROOMS_OPTIONS, BATHROOM_OPTIONS, FLYER_ROOM_OPTIONS,
  type FlyerFacts, type FlyerText,
} from "@/lib/flyer";
import { PROPERTY_TYPE_OPTIONS, FLOOR_OPTIONS, CONDITION_OPTIONS, STRUCTURE_OPTIONS } from "@/lib/valuation";
import ComboField from "@/components/ComboField";
import TemplateMock from "@/components/flyer/TemplateMock";
import { useFieldMemory, FieldSuggestions } from "@/components/field-memory";
import {
  FLYER_SIZES, FLYER_TEMPLATES, getFlyerSize, getFlyerTemplate, flyerGeom,
} from "@/lib/flyer-poster";
import type { FlyerProfileData } from "@/lib/flyer-template";

// A SABLON tudatosan a 2. lépés: a partner előbb lássa, milyen elrendezésbe
// kerülnek a fotók, és csak utána válasszon/töltsön fel képeket.
const STEPS = ["Arculat", "Sablon", "Képek", "Adatok", "Méret", "Előnézet"] as const;
const FLYER_MOOD = "luxus"; // egyetlen, prémium megjelenés (a fő szín az arculatból)
const SIZES = FLYER_SIZES;

// A gépi helyiség-felismerés kimenete → a hirdetésen megjelenő, szép felirat.
const ROOM_LABELS: Record<string, string> = {
  nappali: "Nappali",
  konyha: "Konyha",
  "étkező": "Étkező",
  "háló": "Hálószoba",
  "fürdő": "Fürdőszoba",
  wc: "Mosdó",
  "előszoba": "Előszoba",
  "erkély/terasz": "Erkély",
  "kert/kültér": "Kert",
  homlokzat: "Homlokzat",
  "egyéb": "",
};
function roomLabel(raw: string): string {
  const k = String(raw ?? "").trim().toLowerCase();
  if (!k) return "";
  if (k in ROOM_LABELS) return ROOM_LABELS[k];
  return k.charAt(0).toUpperCase() + k.slice(1);
}
// A saját cím/alcím max hossza — e fölött a hirdetésen levágódna, ezért blokkoljuk a továbblépést.
const FLYER_TITLE_MAX = 38;
const FLYER_SUBTITLE_MAX = 46;

export default function AdWizard({
  profiles, onClose, onDone,
}: { profiles: BrandingProfile[]; onClose: () => void; onDone?: () => void }) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // 1) Arculat — mentett vagy egyszeri
  const [brandMode, setBrandMode] = useState<"saved" | "quick">(profiles.length ? "saved" : "quick");
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [quick, setQuick] = useState({
    display_name: "", title: "", phone: "", email: "", company: "", website: "",
    accent_color: "#1e3a5f", font: BRANDING_FONTS[0].value,
  });

  // 2) Képek
  const [images, setImages] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [arranging, setArranging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Az üres kiegészítő-helyek tallózója + a húzás alatt kiemelt hely indexe.
  const slotRef = useRef<HTMLInputElement>(null);
  const [slotDragOver, setSlotDragOver] = useState<number | null>(null);

  // 3) Adatok + szöveg
  const [facts, setFacts] = useState<FlyerFacts>({ ...EMPTY_FACTS });
  const [tone, setTone] = useState(FLYER_TONES[1]?.value ?? "marketinges");
  const [text, setText] = useState<FlyerText>({ ...EMPTY_TEXT });
  // Rövid leírás — a magazin- és az adatlap-sablon szöveges blokkja.
  // A szöveggenerálás tölti ki, de kézzel is átírható; üresen hagyva a sablon
  // az adatokból állít össze egy rövid mondatot.
  const [blurb, setBlurb] = useState("");
  const [genLoading, setGenLoading] = useState(false);

  // Mező-memória — a korábbi szabadszöveges értékeket felajánljuk (kliensoldali).
  const locMem = useFieldMemory("flyer:location", { min: 2 });
  const streetMem = useFieldMemory("flyer:street", { min: 2 });
  const sizeMem = useFieldMemory("flyer:size", { min: 2 });
  const priceMem = useFieldMemory("flyer:price", { min: 2 });
  const titleMem = useFieldMemory("flyer:title", { min: 3 });
  const subtitleMem = useFieldMemory("flyer:subtitle", { min: 3 });
  const dispPriceMem = useFieldMemory("flyer:display_price", { min: 2 });

  // 4) Sablon (elrendezés) + méret. A méretből TÖBB is választható; minden
  //    kiválasztott méret külön előnézetet kap, a sablon mindegyikre érvényes.
  const mood = FLYER_MOOD;
  const [template, setTemplate] = useState<string>(FLYER_TEMPLATES[0].value);
  const [sizes, setSizes] = useState<string[]>([SIZES[0].value]);
  // A képek helyiség-feliratai. KÉP SZERINT tároljuk (nem sorszám szerint), így
  // átrendezésnél és törlésnél is a helyes képhez tapadnak. A partner a Képek
  // lépésben megadhatja, a gépi felismerés pedig kitölti az üreseket.
  const [roomByImage, setRoomByImage] = useState<Record<string, string>>({});
  const setRoom = (url: string, v: string) =>
    setRoomByImage((prev) => ({ ...prev, [url]: v.slice(0, 18) }));
  // A rendernek átadott feliratok: a főkép után következő (max 3) kis kép.
  const thumbLabels = images.slice(1, 4).map((u) => roomByImage[u] ?? "");
  const thumbLabelsKey = thumbLabels.join("|"); // stabil kulcs az effect-függőséghez

  // 5) Előnézet — méretenként külön előnézet/elfogadás; a főkép-igazítás közös.
  const [previewIdx, setPreviewIdx] = useState(0);
  const [heroPos, setHeroPos] = useState({ x: 50, y: 50 }); // a főkép kivágása (%)
  const [slotsBySize, setSlotsBySize] = useState<Record<string, Record<number, "row" | "up1" | "up2">>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [finals, setFinals] = useState<Record<string, string>>({}); // elfogadott (mentett) URL-ek
  const [rendering, setRendering] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [sharing, setSharing] = useState(false);

  const curSize = sizes[Math.min(previewIdx, sizes.length - 1)] ?? SIZES[0].value;
  const sizeDef = getFlyerSize(curSize);
  const preview = previews[curSize] ?? null;
  const finalUrl = finals[curSize] ?? null;

  /** Az adott méret kis kép-elrendezése (story: alapból oszlop). */
  function slotsFor(sv: string): Record<number, "row" | "up1" | "up2"> {
    const s = slotsBySize[sv];
    if (s) return s;
    const def = getFlyerSize(sv);
    return flyerGeom(def.w, def.h).story ? { 0: "up2", 1: "up1" } : {};
  }
  const thumbSlots = slotsFor(curSize);

  const profileData: FlyerProfileData = (() => {
    const p = brandMode === "saved" ? profiles.find((x) => x.id === profileId) : null;
    if (p) {
      return {
        display_name: p.display_name, title: p.title, phone: p.phone, email: p.email,
        company: p.company, website: p.website, slogan: p.slogan,
        logo_url: p.logo_url, agent_photo_url: p.agent_photo_url,
        accent_color: p.accent_color, font: p.font, theme: p.theme === "dark" ? "dark" : "light",
      };
    }
    return {
      display_name: quick.display_name, title: quick.title, phone: quick.phone, email: quick.email,
      company: quick.company, website: quick.website, slogan: "",
      logo_url: null, agent_photo_url: null,
      accent_color: quick.accent_color, font: quick.font, theme: "light",
    };
  })();

  // --- Képek ---
  function addFiles(list: FileList | null) {
    if (!list) return;
    const room = MAX_FLYER_IMAGES - images.length;
    if (room <= 0) { showToast(`Legfeljebb ${MAX_FLYER_IMAGES} kép.`, "info"); return; }
    setImages((prev) => [...prev, ...Array.from(list).slice(0, room).map((f) => URL.createObjectURL(f))]);
  }
  const addUrl = (u: string) =>
    setImages((prev) => (prev.includes(u) || prev.length >= MAX_FLYER_IMAGES ? prev : [...prev, u]));
  const removeImage = (i: number) => setImages((prev) => prev.filter((_, j) => j !== i));
  const moveImage = (from: number, to: number) =>
    setImages((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const n = [...prev]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n;
    });

  // "AI elrendezés": a fotókat esztétikai/főkép-alkalmassági pontszám alapján
  // értékeli, és a legjobbat teszi FŐKÉPnek (index 0). A partner utólag átrendezheti.
  async function arrangeByAI() {
    if (images.length < 2 || arranging) return;
    setArranging(true); setError(null);
    try {
      const fd = new FormData();
      for (const u of images) {
        const blob = await (await fetch(u)).blob();
        const f = new File([blob], "kep.jpg", { type: blob.type || "image/jpeg" });
        fd.append("images", await compressImage(f, 1024, 0.8));
      }
      const res = await fetch("/api/flyer/arrange", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Az AI-elrendezés nem sikerült.");
      const order: number[] = Array.isArray(data.order) ? data.order : [];
      const validOrder =
        order.length === images.length &&
        order.every((n) => Number.isInteger(n) && n >= 0 && n < images.length) &&
        new Set(order).size === images.length;
      if (data.applied && validOrder) {
        const ordered = order.map((i) => images[i]);
        setImages(ordered);
        // A felismert helyiségek (már az új sorrendben) → a képek feliratai.
        // A KÉZZEL megadott feliratokat nem írjuk felül, csak az üreseket töltjük ki.
        const rooms: string[] = Array.isArray(data.rooms) ? data.rooms : [];
        if (rooms.length) {
          setRoomByImage((prev) => {
            const next = { ...prev };
            ordered.forEach((u, k) => {
              if (!next[u]?.trim()) next[u] = roomLabel(String(rooms[k] ?? ""));
            });
            return next;
          });
        }
        showToast("Elrendezve: a legjobb fotó a főkép, a kisképekben eltérő helyiségek.", "success");
      } else if (data.applied) {
        showToast("Az AI-elrendezés nem hozott változást.", "info");
      } else {
        showToast("Az AI-elrendezés most nem elérhető — a sorrend változatlan.", "info");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setArranging(false);
    }
  }

  // --- AI szöveg ---
  async function generateText() {
    setGenLoading(true); setError(null);
    try {
      const res = await fetch("/api/flyer/text", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facts, tone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const t = data.text as FlyerText;
      setText(t);
      // Rövid leírás a sablonokhoz: az infrastruktúra-mondat, különben a jellemzők.
      const derived = String(t.infra ?? "").trim() || (t.characteristics ?? []).slice(0, 2).join(" ");
      if (derived) setBlurb(derived.slice(0, FLYER_BLURB_MAX));
    } catch {
      setError("A szöveg generálása nem sikerült — kézzel is kitöltheted.");
    } finally { setGenLoading(false); }
  }

  // --- A hirdetés PNG-je a szerveren, Satorival (pixelpontos, valódi betűkkel) ---
  async function buildBlob(watermark: boolean, sizeVal: string): Promise<{ blob: Blob; ext: string; contentType: string }> {
    // Felül csak a lényeg (szoba + típus) — a részletes adatok lent, ikonosan.
    const chips = [facts.rooms, facts.propertyType].filter(Boolean);
    const details = {
      size: facts.size, rooms: facts.rooms, bathrooms: facts.bathrooms,
      floor: facts.floor, structure: facts.structure, condition: facts.condition,
    };
    const slots = slotsFor(sizeVal);
    const fd = new FormData();
    for (const u of images) {
      const b = await (await fetch(u)).blob();
      const f = new File([b], "kep.jpg", { type: b.type || "image/jpeg" });
      // 2400px bőven elég a 2160-as renderhez; a kérés így a Vercel-limit alatt marad.
      fd.append("images", await compressImage(f, 2400, 0.9));
    }
    fd.append("profile", JSON.stringify(profileData));
    fd.append("mood", mood);
    fd.append("size", sizeVal);
    fd.append("template", template);
    fd.append("watermark", watermark ? "1" : "0");
    fd.append("title", text.title ?? "");
    fd.append("subtitle", text.subtitle ?? "");
    fd.append("price", text.price ?? "");
    fd.append("chips", JSON.stringify(chips));
    fd.append("details", JSON.stringify(details));
    // A magazin- és adatlap-sablon szöveges blokkjai (a prémium sablon nem használja).
    fd.append("highlights", JSON.stringify((text.highlights ?? []).slice(0, 4)));
    fd.append("blurb", blurb.trim());
    fd.append("thumbLabels", JSON.stringify(thumbLabels.slice(0, 3)));
    fd.append("heroX", String(heroPos.x));
    fd.append("heroY", String(heroPos.y));
    fd.append("thumbSlots", JSON.stringify([slots[0] ?? "row", slots[1] ?? "row"]));
    // A főkép valódi mérete → a szerver a teljes rejtett területen tud mozgatni.
    if (images[0]) {
      try {
        const dim = await new Promise<{ w: number; h: number }>((resolve, reject) => {
          const im = new Image();
          im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
          im.onerror = () => reject(new Error("mérés hiba"));
          im.src = images[0];
        });
        fd.append("heroW", String(dim.w));
        fd.append("heroH", String(dim.h));
      } catch { /* mérés nélkül a tartalék (16%) mozgástér él */ }
    }
    const res = await fetch("/api/flyer/render", { method: "POST", body: fd });
    if (!res.ok) throw new Error(await res.text());
    return { blob: await res.blob(), ext: "png", contentType: "image/png" };
  }

  async function makePreview(sizeVal: string) {
    setRendering(true); setError(null);
    try {
      const { blob } = await buildBlob(true, sizeVal);
      const url = URL.createObjectURL(blob);
      setPreviews((prev) => ({ ...prev, [sizeVal]: url }));
    } catch (e) {
      setError("Nem sikerült az előnézet: " + (e as Error).message);
    } finally { setRendering(false); }
  }

  // Kész hirdetés megosztása: mobilon a rendszer megosztó-panelje (Instagram,
  // Facebook, Messenger, WhatsApp…) a képpel; asztali böngészőben letöltés-fallback.
  async function shareFinal() {
    if (!finalUrl || sharing) return;
    setSharing(true); setError(null);
    try {
      const blob = await (await fetch(toDownloadUrl(finalUrl))).blob();
      const file = new File([blob], "hirdetes.jpg", { type: blob.type || "image/jpeg" });
      const nav = navigator as Navigator & {
        canShare?: (data?: { files?: File[] }) => boolean;
        share?: (data?: { files?: File[]; title?: string; text?: string }) => Promise<void>;
      };
      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: "Ingatlan hirdetés" });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "hirdetes.jpg";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
        showToast("A böngésző nem támogatja a közvetlen megosztást — a kép letöltődött, töltsd fel a platformra.", "info");
      }
    } catch (e) {
      // A megosztó-panel bezárása AbortError-t dob — ez nem hiba.
      if ((e as Error).name !== "AbortError") setError("A megosztás nem sikerült. Töltsd le a képet és oszd meg kézzel.");
    } finally {
      setSharing(false);
    }
  }

  async function accept() {
    const sizeVal = curSize;
    if (finals[sizeVal]) return; // ez a méret már elfogadva
    setAccepting(true); setError(null);
    try {
      const { blob } = await buildBlob(false, sizeVal);
      // A nagy felbontású PNG-t minőségi JPEG-ként töltjük fel (nem skálázzuk).
      const jpeg = await compressImage(new File([blob], "hirdetes.png", { type: "image/png" }), 10000, 0.93);
      const fd = new FormData();
      fd.append("image", jpeg);
      if (brandMode === "saved") fd.append("profileId", profileId);
      fd.append("title", `${text.title ?? ""} (${getFlyerSize(sizeVal).label})`.trim());
      const res = await fetch("/api/flyer/accept", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // AZONNAL mentve: a kép a tárhelyre és az előzményekbe került — nem veszhet el.
      setFinals((prev) => ({ ...prev, [sizeVal]: data.url as string }));
      // A sikeresen elfogadott hirdetés szabadszöveges értékeit megjegyezzük.
      locMem.remember(facts.location.trim());
      streetMem.remember(facts.street.trim());
      sizeMem.remember(facts.size.trim());
      priceMem.remember(facts.price.trim());
      titleMem.remember((text.title ?? "").trim());
      subtitleMem.remember((text.subtitle ?? "").trim());
      dispPriceMem.remember((text.price ?? "").trim());
      onDone?.(); // a "Korábbi hirdetéseim" lista frissítése
      showToast(
        data.charged
          ? `${getFlyerSize(sizeVal).label} kész és mentve! ${FLYER_CREDITS} kredit levonva.`
          : `${getFlyerSize(sizeVal).label} kész és mentve!`,
        "success"
      );
    } catch (e) {
      setError((e as Error).message || "Nem sikerült az elfogadás.");
    } finally { setAccepting(false); }
  }

  // Az előnézet lépésre lépve / méretváltásnál az AKTUÁLIS méretet rendereli (ha még nincs).
  useEffect(() => {
    if (step === 5 && !finals[curSize] && !previews[curSize] && !rendering) void makePreview(curSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, previewIdx, previews]);
  // Kép-változásnál minden előnézet érvénytelen; az elfogadottak (mentettek) maradnak.
  // A SORREND is számít (főkép-csere, átrendezés), ezért a teljes listát figyeljük.
  const imagesKey = images.join("|");
  useEffect(() => {
    setPreviews({}); setSlotsBySize({}); setPreviewIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagesKey]);
  // Méret-választás változásakor a lapozó az elejére áll.
  useEffect(() => { setPreviewIdx(0); }, [sizes.length]);

  // A főkép igazítása KÖZÖS → minden előnézet újrarenderel; a kis képek méretenként.
  function nudgeHero(dx: number, dy: number) {
    if (rendering || accepting || finalUrl) return;
    setHeroPos((p) => ({
      x: Math.max(0, Math.min(100, p.x + dx)),
      y: Math.max(0, Math.min(100, p.y + dy)),
    }));
  }
  useEffect(() => {
    if (step === 5) { setPreviews({}); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroPos, slotsBySize]);
  // Sablon- vagy felirat-váltásnál minden korábbi előnézet érvénytelen.
  useEffect(() => {
    setPreviews({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, thumbLabelsKey, blurb]);

  function next() {
    if (step === 0) {
      if (brandMode === "saved" && !profileId) { setError("Válassz arculatot."); return; }
      if (brandMode === "quick" && !quick.display_name.trim() && !quick.company.trim()) {
        setError("Adj meg egy nevet vagy cégnevet."); return;
      }
      if (brandMode === "quick" && !quick.phone.trim() && !quick.email.trim()) {
        setError("Adj meg legalább egy elérhetőséget."); return;
      }
    }
    if (step === 2 && !images.length) { setError("Adj hozzá legalább egy képet."); return; }
    if (step === 4 && !sizes.length) { setError("Válassz legalább egy méretet."); return; }
    if (step === 3) {
      if (!text.title?.trim()) { setError("Adj címet a hirdetésnek."); return; }
      const tl = (text.title ?? "").trim().length;
      const sl = (text.subtitle ?? "").trim().length;
      if (tl > FLYER_TITLE_MAX) {
        setError(`A főcím túl hosszú: ${tl}/${FLYER_TITLE_MAX} karakter. Rövidítsd le a folytatáshoz, különben levágódna a hirdetésen.`);
        return;
      }
      if (sl > FLYER_SUBTITLE_MAX) {
        setError(`Az alcím túl hosszú: ${sl}/${FLYER_SUBTITLE_MAX} karakter. Rövidítsd le a folytatáshoz, különben levágódna a hirdetésen.`);
        return;
      }
    }
    setError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  const set = <K extends keyof typeof quick>(k: K, v: string) => setQuick({ ...quick, [k]: v });
  const setF = <K extends keyof FlyerFacts>(k: K, v: string) => setFacts({ ...facts, [k]: v });
  const setT = <K extends keyof FlyerText>(k: K, v: FlyerText[K]) => setText({ ...text, [k]: v });

  return (
    <div onClick={() => !accepting && !rendering && onClose()} className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(20,12,8,0.55)" }}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl"
        style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 24px 60px rgba(0,0,0,0.28)" }}>

        {/* Fejléc + lépésjelző */}
        <div className="border-b p-4" style={{ borderColor: "var(--twx-line)" }}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Új hirdetés</h2>
            <button onClick={onClose} className="rounded-lg px-2 text-xl" style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <div key={s} className="flex flex-1 items-center gap-1.5">
                <button type="button" onClick={() => i < step && setStep(i)} className="flex items-center gap-1.5 text-[11px] font-semibold"
                  style={{ color: i === step ? "var(--twx-coral)" : i < step ? "var(--twx-ink)" : "var(--twx-ink-muted)" }}>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px]"
                    style={i <= step ? { background: "var(--twx-coral)", color: "#1c1005" } : { border: "1px solid var(--twx-line)" }}>{i + 1}</span>
                  <span className="hidden sm:inline">{s}</span>
                </button>
                {i < STEPS.length - 1 && <span className="h-px flex-1" style={{ background: "var(--twx-line)" }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Tartalom */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {/* 1) ARCULAT */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <button type="button" onClick={() => setBrandMode("saved")} disabled={!profiles.length}
                  className="flex-1 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40"
                  style={brandMode === "saved" ? { background: "var(--twx-coral-soft)", border: "1px solid var(--twx-coral)", color: "#7a2e17" } : { background: "#fff", border: "1px solid var(--twx-line)" }}>
                  Mentett arculatom
                </button>
                <button type="button" onClick={() => setBrandMode("quick")}
                  className="flex-1 rounded-xl px-4 py-2 text-sm font-medium"
                  style={brandMode === "quick" ? { background: "var(--twx-coral-soft)", border: "1px solid var(--twx-coral)", color: "#7a2e17" } : { background: "#fff", border: "1px solid var(--twx-line)" }}>
                  Most adom meg
                </button>
              </div>

              {brandMode === "saved" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {profiles.map((p) => {
                    const on = profileId === p.id;
                    return (
                      <button key={p.id} type="button" onClick={() => setProfileId(p.id)}
                        className="flex items-center gap-3 rounded-xl p-3 text-left transition hover:shadow-sm"
                        style={{ border: `1px solid ${on ? "var(--twx-coral)" : "var(--twx-line)"}`, background: on ? "var(--twx-coral-soft)" : "#fff" }}>
                        <span className="h-9 w-9 shrink-0 rounded-lg" style={{ background: p.accent_color }} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{p.label}</span>
                          <span className="block truncate text-xs" style={{ color: "var(--twx-ink-muted)" }}>{p.display_name}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    Nem kell arculatot létrehoznod — ezekből készül a hirdetés.
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Név" value={quick.display_name} onChange={(v) => set("display_name", v)} placeholder="pl. Kovács Péter" />
                    <Field label="Titulus" value={quick.title} onChange={(v) => set("title", v)} placeholder="pl. ingatlanértékesítő" />
                    <Field label="Telefon" value={quick.phone} onChange={(v) => set("phone", v)} placeholder="pl. +36 30 123 4567" />
                    <Field label="E-mail" value={quick.email} onChange={(v) => set("email", v)} placeholder="pl. peter@iroda.hu" />
                    <Field label="Cégnév" value={quick.company} onChange={(v) => set("company", v)} placeholder="pl. Prémium Ingatlanok" />
                    <Field label="Weboldal" value={quick.website} onChange={(v) => set("website", v)} placeholder="pl. iroda.hu" />
                  </div>
                  <div className="flex flex-wrap items-end gap-4">
                    <div>
                      <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Fő szín</label>
                      <div className="mt-1 flex items-center gap-2">
                        <input type="color" value={quick.accent_color} onChange={(e) => set("accent_color", e.target.value)} className="h-9 w-12 cursor-pointer rounded" style={{ border: "1px solid var(--twx-line)" }} />
                        <input type="text" value={quick.accent_color} onChange={(e) => set("accent_color", e.target.value)} className="twx-input w-28 text-sm" />
                      </div>
                    </div>
                    <div className="min-w-[12rem] flex-1">
                      <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Betűtípus</label>
                      <select value={quick.font} onChange={(e) => set("font", e.target.value)} className="twx-input mt-1 w-full text-sm">
                        {BRANDING_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3) KÉPEK */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Emlékeztető: melyik sablonba kerülnek a fotók */}
              <div className="flex items-center gap-3 rounded-xl p-3"
                style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
                <span className="w-16 shrink-0">
                  <TemplateMock template={template} accent={profileData.accent_color} images={images} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>A képek ebbe kerülnek</span>
                  <span className="block text-sm font-semibold">{getFlyerTemplate(template).label}</span>
                  <span className="mt-0.5 block text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                    1 főkép + {MAX_FLYER_IMAGES - 1} kisebb fotó
                  </span>
                </span>
                <button type="button" onClick={() => setStep(1)}
                  className="ml-auto shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium"
                  style={{ border: "1px solid var(--twx-line)" }}>
                  Sablon csere
                </button>
              </div>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault(); setDragOver(false);
                  const url = readTwxDragUrl(e.dataTransfer);
                  if (url) { addUrl(url); return; }
                  addFiles(e.dataTransfer.files);
                }}
                className="cursor-pointer rounded-xl border-2 border-dashed p-5 text-center text-sm transition-colors"
                style={{ borderColor: dragOver ? "var(--twx-coral)" : "var(--twx-line)", background: dragOver ? "rgba(239,122,90,0.06)" : "transparent", color: dragOver ? "var(--twx-coral)" : "var(--twx-ink-muted)" }}>
                {dragOver ? "Engedd el a képet" : "Húzd ide a képeket, vagy kattints a tallózáshoz"}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
                  onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }} />
              </div>
              {images.length >= 2 && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={arrangeByAI}
                    disabled={arranging}
                    className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-60"
                    style={{ border: "1px solid var(--twx-coral)", color: "#7a2e17", background: "var(--twx-coral-soft)" }}
                  >
                    <span aria-hidden>✨</span>
                    {arranging ? "AI elrendezés folyamatban…" : "AI elrendezés — főkép + változatos kisképek"}
                  </button>
                  <span className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                    A legvonzóbb fotó lesz a főkép, a kisképekbe eltérő helyiségek kerülnek. Utána szabadon átrendezheted.
                  </span>
                </div>
              )}
              {/* FŐKÉP — kiemelt, külön blokkban, hogy egyértelmű legyen */}
              {images.length > 0 && (
                <div className="rounded-2xl p-3"
                  style={{ border: "2px solid var(--twx-coral)", background: "var(--twx-coral-soft)" }}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2">
                      <span className="rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide"
                        style={{ background: "var(--twx-coral)", color: "#fff" }}>FŐKÉP</span>
                      <span className="text-xs font-semibold" style={{ color: "#7a2e17" }}>
                        Ez lesz a hirdetés nagy képe
                      </span>
                    </span>
                    <button type="button" onClick={() => removeImage(0)}
                      className="rounded-lg px-2 py-1 text-xs font-medium"
                      style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
                      Eltávolítás
                    </button>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={images[0]} alt="Főkép" className="w-full rounded-xl object-cover"
                    style={{ aspectRatio: "16 / 9", border: "1px solid rgba(0,0,0,0.08)" }} />
                  <p className="mt-2 text-[11px]" style={{ color: "#7a2e17" }}>
                    Másik fotót szeretnél főképnek? A lenti kis képeknél kattints a <strong>Főkép</strong> gombra.
                  </p>
                </div>
              )}

              {/* KIEGÉSZÍTŐ KÉPEK — a főkép után AZONNAL látszik mind a 3 hely,
                  üresen is, hogy egyértelmű legyen: ide még jöhet 3 fotó. */}
              {images.length > 0 && (
                <div>
                  <p className="text-sm font-semibold">
                    Kiegészítő képek <span style={{ color: "var(--twx-ink-muted)" }}>({images.length - 1}/{MAX_FLYER_IMAGES - 1})</span>
                  </p>
                  <p className="mt-0.5 mb-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    Húzz ide még {MAX_FLYER_IMAGES - 1} fotót, és add meg, melyik helyiség
                    látszik rajtuk — így nem a véletlenre bízzuk. Bármikor módosíthatod.
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {Array.from({ length: MAX_FLYER_IMAGES - 1 }).map((_, k) => {
                      const i = k + 1; // az images tömbbeli valódi index
                      const src = images[i];

                      // ÜRES HELY: ide húzható vagy kattintással tallózható a fotó.
                      if (!src) {
                        const on = slotDragOver === i;
                        return (
                          <button
                            key={`slot${i}`}
                            type="button"
                            onClick={() => slotRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); setSlotDragOver(i); }}
                            onDragLeave={() => setSlotDragOver(null)}
                            onDrop={(e) => {
                              e.preventDefault(); setSlotDragOver(null);
                              const url = readTwxDragUrl(e.dataTransfer);
                              if (url) { addUrl(url); return; }
                              addFiles(e.dataTransfer.files);
                            }}
                            className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-xs transition-colors"
                            style={{
                              borderColor: on ? "var(--twx-coral)" : "var(--twx-line)",
                              background: on ? "rgba(239,122,90,0.08)" : "#fff",
                              color: on ? "var(--twx-coral)" : "var(--twx-ink-muted)",
                            }}
                          >
                            <span className="text-xl leading-none">+</span>
                            <span className="font-medium">{k + 2}. kép</span>
                            <span className="text-[10px]">húzd ide vagy tallózz</span>
                          </button>
                        );
                      }

                      // KITÖLTÖTT HELY: kép + helyiség + vezérlők.
                      return (
                        <div key={src + i} className="rounded-xl bg-white p-2"
                          style={{ border: "1px solid var(--twx-line)" }}>
                          <div className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" />
                            <span className="absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold"
                              style={{ background: "rgba(255,255,255,0.92)", color: "var(--twx-ink-muted)" }}>{i + 1}.</span>
                            <button type="button" onClick={() => removeImage(i)} aria-label="Törlés"
                              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-sm shadow"
                              style={{ background: "rgba(255,255,255,0.95)" }}>×</button>
                          </div>
                          <ComboField className="mt-2 w-full" value={roomByImage[src] ?? ""}
                            onChange={(v) => setRoom(src, v)} options={FLYER_ROOM_OPTIONS}
                            placeholder="Melyik helyiség?" />
                          <div className="mt-1.5 flex items-center justify-between">
                            <button type="button" onClick={() => moveImage(i, 0)}
                              className="rounded-lg px-2 py-1 text-[11px] font-semibold"
                              style={{ border: "1px solid var(--twx-coral)", color: "#7a2e17", background: "var(--twx-coral-soft)" }}>
                              Főkép
                            </button>
                            <span className="flex gap-1 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                              <button type="button" aria-label="Előrébb" onClick={() => moveImage(i, i - 1)} className="px-1.5">‹</button>
                              <button type="button" aria-label="Hátrébb" onClick={() => moveImage(i, i + 1)} className="px-1.5">›</button>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <input ref={slotRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
                    onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }} />
                  <p className="mt-2 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                    A feliratok az <strong>Adatlap</strong> sablonon jelennek meg a képek alatt.
                  </p>
                </div>
              )}
              <AssetTray onPick={(u) => addUrl(u)} selectedUrls={images}
                note="Válassz egy mappát, majd kattints egy képre a hirdetéshez adáshoz — vagy húzd a feltöltőre." />
            </div>
          )}

          {/* 4) ADATOK */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold">Az ingatlan adatai</p>
                <p className="mt-0.5 mb-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  Válassz a listából, vagy írj sajátot. Minél több adat, annál gazdagabb a hirdetés.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Település, kerület" value={facts.location} onChange={(v) => setF("location", v)} placeholder="pl. Budapest, V. kerület" mem={locMem} />
                  <Field label="Pontosabb helyszín / utca" value={facts.street} onChange={(v) => setF("street", v)} placeholder="pl. Belváros / Váci utca" mem={streetMem} />
                  <Combo label="Ingatlan típusa" value={facts.propertyType} onChange={(v) => setF("propertyType", v)} options={PROPERTY_TYPE_OPTIONS} placeholder="Válassz vagy írj sajátot" />
                  <Combo label="Szobaszám" value={facts.rooms} onChange={(v) => setF("rooms", v)} options={ROOMS_OPTIONS} placeholder="Válassz vagy írj sajátot" />
                  <Combo label="Épület szintje" value={facts.floor} onChange={(v) => setF("floor", v)} options={FLOOR_OPTIONS} placeholder="Válassz a listából" />
                  <Combo label="Fürdő / mellékhelyiség" value={facts.bathrooms} onChange={(v) => setF("bathrooms", v)} options={BATHROOM_OPTIONS} placeholder="Válassz vagy írj sajátot" />
                  <Combo label="Műszaki állapot" value={facts.condition} onChange={(v) => setF("condition", v)} options={CONDITION_OPTIONS} placeholder="Válassz a listából" />
                  <Combo label="Szerkezet" value={facts.structure} onChange={(v) => setF("structure", v)} options={STRUCTURE_OPTIONS} placeholder="Válassz a listából" />
                  <Field label="Méret" value={facts.size} onChange={(v) => setF("size", v)} placeholder="pl. 125 m²" mem={sizeMem} />
                  <Field label="Ár" value={facts.price} onChange={(v) => setF("price", v)} placeholder="pl. 145.000.000 Ft" mem={priceMem} />
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Hangnem</label>
                  <select value={tone} onChange={(e) => setTone(e.target.value)} className="twx-input mt-1 text-sm">
                    {FLYER_TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <button type="button" onClick={generateText} disabled={genLoading}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--twx-coral)" }}>
                  {genLoading ? "Szöveg készül…" : "Szöveg generálása"}
                </button>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold">A hirdetés szövege</p>
                <Limit label="Főcím" value={text.title} onChange={(v) => setT("title", v)} max={FLYER_TITLE_MAX} mem={titleMem} />
                <Limit label="Alcím" value={text.subtitle} onChange={(v) => setT("subtitle", v)} max={FLYER_SUBTITLE_MAX} mem={subtitleMem} />
                <Limit label="Megjelenő ár" value={text.price} onChange={(v) => setT("price", v)} max={18} mem={dispPriceMem} />
                <div>
                  <div className="flex items-baseline justify-between">
                    <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>
                      Rövid leírás <span className="opacity-70">(opcionális)</span>
                    </label>
                    <span className="text-[11px]" style={{ color: blurb.length >= FLYER_BLURB_MAX ? "#c0392b" : "var(--twx-ink-muted)" }}>
                      {blurb.length}/{FLYER_BLURB_MAX}
                    </span>
                  </div>
                  <textarea
                    value={blurb}
                    onChange={(e) => setBlurb(e.target.value.slice(0, FLYER_BLURB_MAX))}
                    maxLength={FLYER_BLURB_MAX}
                    rows={3}
                    placeholder="1-2 mondat az ingatlanról — a magazin és az adatlap sablonon jelenik meg. Üresen hagyva az adatokból állítjuk össze."
                    className="twx-input mt-1 w-full text-sm"
                  />
                  <p className="mt-1 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                    Eddig a hosszig minden sablonon és minden méreten hiánytalanul kifér.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 5) MÉRET — több is választható */}
          {step === 4 && (
            <div className="space-y-5">
              {/* Emlékeztető: melyik sablonba készül, kicsi előnézettel */}
              <div className="flex items-center gap-3 rounded-xl p-3"
                style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
                <span className="w-16 shrink-0">
                  <TemplateMock template={template} accent={profileData.accent_color} images={images} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>Választott sablon</span>
                  <span className="block text-sm font-semibold">{getFlyerTemplate(template).label}</span>
                </span>
                <button type="button" onClick={() => setStep(1)}
                  className="ml-auto shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium"
                  style={{ border: "1px solid var(--twx-line)" }}>
                  Csere
                </button>
              </div>

              <div>
                <p className="text-sm font-semibold">Méret — több is választható</p>
                <p className="mt-0.5 mb-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  Jelöld be, mely méretek készüljenek el. Mindegyik külön előnézetet kap, és
                  méretenként {FLYER_CREDITS} kreditért fogadhatod el.
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {SIZES.map((s) => {
                    const on = sizes.includes(s.value);
                    return (
                      <button key={s.value} type="button"
                        onClick={() =>
                          setSizes((prev) =>
                            prev.includes(s.value)
                              ? prev.filter((v) => v !== s.value)
                              : SIZES.map((x) => x.value).filter((v) => prev.includes(v) || v === s.value)
                          )
                        }
                        className="flex items-center gap-3 rounded-xl p-3 text-left transition hover:shadow-sm"
                        style={{ border: `1px solid ${on ? "var(--twx-coral)" : "var(--twx-line)"}`, background: on ? "var(--twx-coral-soft)" : "#fff" }}>
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[12px] font-bold"
                          style={on ? { background: "var(--twx-coral)", color: "#fff" } : { border: "1.5px solid var(--twx-line)" }}>
                          {on ? "✓" : ""}
                        </span>
                        <span>
                          <span className="block text-sm font-semibold" style={{ color: on ? "#7a2e17" : "var(--twx-ink)" }}>{s.label}</span>
                          <span className="mt-0.5 block text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>{s.hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 2) SABLON — a képfeltöltés ELŐTT, hogy a partner lássa, mibe kerülnek a fotók */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold">Válaszd ki az elrendezést</p>
                <p className="mt-0.5 mb-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  Előbb a sablon, utána a fotók — így már tudod, hány kép kell és hova
                  kerülnek. A képeken <strong>minta-fotók</strong> és a te arculati színed
                  látszik; mindhárom sablon minden méreten elkészül.
                </p>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {FLYER_TEMPLATES.map((tpl) => {
                    const on = template === tpl.value;
                    return (
                      <button key={tpl.value} type="button" onClick={() => setTemplate(tpl.value)}
                        className="rounded-xl p-2 text-left transition hover:shadow-sm"
                        style={{ border: `2px solid ${on ? "var(--twx-coral)" : "var(--twx-line)"}`, background: on ? "var(--twx-coral-soft)" : "#fff" }}>
                        <TemplateMock template={tpl.value} accent={profileData.accent_color} images={images} />
                        <span className="mt-2 flex items-center gap-1.5">
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                            style={on ? { background: "var(--twx-coral)", color: "#fff" } : { border: "1.5px solid var(--twx-line)" }}>
                            {on ? "✓" : ""}
                          </span>
                          <span className="block text-[13px] font-semibold" style={{ color: on ? "#7a2e17" : "var(--twx-ink)" }}>{tpl.label}</span>
                        </span>
                        <span className="mt-1 block text-[11px] leading-snug" style={{ color: "var(--twx-ink-muted)" }}>{tpl.hint}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                  Mindegyik sablon <strong>1 főképet és 3 kisebb fotót</strong> használ.
                  A választás később is módosítható.
                </p>
              </div>
            </div>
          )}

          {/* 6) ELŐNÉZET — lapozható a kiválasztott méretek között */}
          {step === 5 && (
            <div className="space-y-3 text-center">
              {sizes.length > 1 && (
                <div className="flex items-center justify-center gap-3">
                  <button type="button" aria-label="Előző méret"
                    onClick={() => setPreviewIdx((i) => Math.max(0, i - 1))}
                    disabled={previewIdx === 0 || accepting}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-lg shadow-sm disabled:opacity-35"
                    style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>‹</button>
                  <div className="min-w-[11rem] rounded-xl px-4 py-1.5 text-sm font-semibold" style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
                    {getFlyerSize(curSize).label} · {previewIdx + 1} / {sizes.length}
                  </div>
                  <button type="button" aria-label="Következő méret"
                    onClick={() => setPreviewIdx((i) => Math.min(sizes.length - 1, i + 1))}
                    disabled={previewIdx === sizes.length - 1 || accepting}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-lg shadow-sm disabled:opacity-35"
                    style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>›</button>
                </div>
              )}
              {sizes.length > 1 && (
                <div className="flex items-center justify-center gap-2">
                  {sizes.map((sv, i) => (
                    <button key={sv} type="button" onClick={() => setPreviewIdx(i)} aria-label={getFlyerSize(sv).label}
                      className="h-2.5 w-2.5 rounded-full transition"
                      style={{
                        background: finals[sv] ? "#22a35c" : i === previewIdx ? "var(--twx-coral)" : "transparent",
                        border: `1.5px solid ${finals[sv] ? "#22a35c" : i === previewIdx ? "var(--twx-coral)" : "var(--twx-line)"}`,
                      }} />
                  ))}
                  <span className="ml-1 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                    {Object.keys(finals).length ? `${Object.keys(finals).length} kész és mentve` : "zöld = elfogadva és mentve"}
                  </span>
                </div>
              )}
              {finalUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={finalUrl} alt="Kész hirdetés" className="mx-auto max-h-[50vh] rounded-xl" style={{ border: "1px solid var(--twx-line)" }} />
                  <p className="text-sm text-green-700">
                    Kész! Elmentve a Korábbi hirdetéseim közé — innen bármikor letölthető.
                  </p>
                </>
              ) : rendering ? (
                <div className="py-12">
                  <p className="text-sm font-medium">A hirdetés készül…</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>Néhány másodperc.</p>
                </div>
              ) : preview ? (
                <>
                  <div className="relative mx-auto inline-flex">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="Előnézet" draggable={false} className="mx-auto max-h-[54vh] select-none rounded-xl" style={{ border: "1px solid var(--twx-line)" }} />
                    {/* A kis képek áthelyezése: a mozgathatók felhúzhatók a jobb szélső (fix) fölé.
                        CSAK a prémium sablonnál — a másik kettőnél a képek fix rácsban ülnek. */}
                    {template === "premium" && images.length > 2 && !flyerGeom(sizeDef.w, sizeDef.h).wide && (
                      <ThumbSlotOverlay
                        w={sizeDef.w} h={sizeDef.h}
                        count={images.length - 2}
                        slots={thumbSlots}
                        onMove={(i, slot) =>
                          setSlotsBySize((prev) => ({ ...prev, [curSize]: { ...slotsFor(curSize), [i]: slot } }))
                        }
                      />
                    )}
                  </div>
                  <HeroControls heroPos={heroPos} nudge={nudgeHero} reset={() => setHeroPos({ x: 50, y: 50 })} disabled={rendering} />
                  {template === "premium" && images.length > 2 && (
                    <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                      A kis képek egérrel áthúzhatók — húzás közben megjelennek a lehetséges helyek a jobb szélső kép fölött.
                    </p>
                  )}
                  <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    Vízjeles előnézet, ingyenes. Az elfogadás {FLYER_CREDITS} kredit, és tiszta, letölthető hirdetést ad.
                  </p>
                </>
              ) : (
                <p className="py-10 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Nincs előnézet.</p>
              )}
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        {/* Lábléc */}
        <div className="flex items-center justify-between gap-3 border-t p-4" style={{ borderColor: "var(--twx-line)" }}>
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || accepting}
            className="rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40" style={{ border: "1px solid var(--twx-line)" }}>
            Vissza
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={next} className="rounded-xl px-5 py-2 text-sm font-semibold text-white" style={{ background: "var(--twx-coral)" }}>
              Tovább
            </button>
          ) : finalUrl ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={shareFinal} disabled={sharing}
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--twx-coral)" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
                {sharing ? "Megosztás…" : "Megosztás"}
              </button>
              <a href={toDownloadUrl(finalUrl)} className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ border: "1px solid var(--twx-line)" }}>Letöltés</a>
              <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium" style={{ border: "1px solid var(--twx-line)" }}>Kész</button>
            </div>
          ) : (
            <button type="button" onClick={accept} disabled={accepting || rendering || !preview}
              className="rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--twx-coral)" }}>
              {accepting ? "Feldolgozás…" : `Elfogadom (${FLYER_CREDITS} kredit)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function HeroControls({ heroPos, nudge, reset, disabled }: {
  heroPos: { x: number; y: number };
  nudge: (dx: number, dy: number) => void;
  reset: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      <span className="text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Főkép igazítása:</span>
      {([
        ["←", 12, 0], ["→", -12, 0], ["↑", 0, 12], ["↓", 0, -12],
      ] as Array<[string, number, number]>).map(([lbl, dx, dy]) => (
        <button key={lbl} type="button" onClick={() => nudge(dx, dy)} disabled={disabled}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold disabled:opacity-40"
          style={{ border: "1px solid var(--twx-line)", background: "#fff" }} aria-label={`Főkép ${lbl}`}>
          {lbl}
        </button>
      ))}
      {(heroPos.x !== 50 || heroPos.y !== 50) && (
        <button type="button" onClick={reset} disabled={disabled}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium disabled:opacity-40"
          style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
          Középre
        </button>
      )}
    </div>
  );
}

/** A kis képek áthelyezése az előnézeten: a bal oldaliak felhúzhatók a jobb szélső (fix) fölé.
 *  A pozíciók a sablon geometriáját tükrözik (1080-as alapegység, %-ban). */
function ThumbSlotOverlay({ w, h, count, slots, onMove }: {
  w: number; h: number;
  count: number; // hány NEM-fix kis kép van (1 vagy 2)
  slots: Record<number, "row" | "up1" | "up2">;
  onMove: (i: number, slot: "row" | "up1" | "up2") => void;
}) {
  const [hover, setHover] = useState<string | null>(null); // épp e fölé húzzák a képet
  const [dragging, setDragging] = useState(false); // csak húzás közben mutatjuk a drop-helyeket
  // KÖZÖS geometria a szerver-renderrel (flyerGeom) — méretenként más kompozíció.
  const g = flyerGeom(w, h);
  const T = g.thumbD, gap = g.gapT, right0 = g.right0;
  const B0 = g.B0;
  // 4:3 (fekvő, nem 16:9): a kis képek BAL-horgonyúak — a fix kép balra lent,
  // a többi mellette jobbra VAGY fölé húzva. Máshol jobb-horgonyú (változatlan).
  const landNarrow = g.land && !g.wide;
  const left0 = Math.round(60 * g.u);
  const wPct = (px: number) => (px / w) * 100;
  const hPct = (px: number) => (px / h) * 100;

  type P = { right?: number; left?: number; bottom: number };
  const anchorRow = (kk: number): P => landNarrow ? { left: left0 + kk * (T + gap) } as P : { right: right0 + kk * (T + gap) } as P;
  const anchorFix = (): P => landNarrow ? { left: left0 } as P : { right: right0 } as P;

  // Ugyanaz az elrendezési logika, mint a szerveren.
  // 4:3-nál csak EGY felső hely (up1) — az up2 kitakarná a cím/alcím sávot.
  const allowUp2 = !landNarrow;
  const pos: Record<number, P> = {};
  let k = 1;
  for (let i = count - 1; i >= 0; i--) {
    const s = slots[i] ?? "row";
    if (s === "up1") pos[i] = { ...anchorFix(), bottom: B0 + (T + gap) };
    else if (s === "up2" && allowUp2) pos[i] = { ...anchorFix(), bottom: B0 + 2 * (T + gap) };
    else { pos[i] = { ...anchorRow(k), bottom: B0 }; k++; }
  }
  const used = new Set(Object.values(slots));
  const emptySlots: Array<P & { slot: "up1" | "up2" | "row" }> = [];
  if (!used.has("up1")) emptySlots.push({ slot: "up1", ...anchorFix(), bottom: B0 + (T + gap) });
  if (allowUp2 && !used.has("up2") && used.has("up1")) emptySlots.push({ slot: "up2", ...anchorFix(), bottom: B0 + 2 * (T + gap) });
  if (used.has("up1") || (allowUp2 && used.has("up2"))) emptySlots.push({ slot: "row", ...anchorRow(k), bottom: B0 });

  const boxStyle = (p: P): React.CSSProperties => {
    const s: React.CSSProperties = {
      position: "absolute",
      bottom: `${hPct(p.bottom)}%`,
      width: `${wPct(T)}%`,
      height: `${hPct(T)}%`,
    };
    if (p.left !== undefined) s.left = `${wPct(p.left)}%`;
    if (p.right !== undefined) s.right = `${wPct(p.right)}%`;
    return s;
  };

  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const moved = (slots[i] ?? "row") !== "row"; // áthelyezett kép: más szín
        return (
          <div key={`d${i}`} draggable
            onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(i)); e.dataTransfer.effectAllowed = "move"; setDragging(true); }}
            onDragEnd={() => { setDragging(false); setHover(null); }}
            style={{
              ...boxStyle(pos[i]), cursor: "grab", borderRadius: 10,
              border: moved ? "3px solid #ff8a5c" : "2px dashed rgba(255,255,255,0.9)",
              background: moved ? "rgba(255,138,92,0.16)" : "transparent",
              boxShadow: moved ? "0 0 0 2px rgba(255,138,92,0.35)" : undefined,
            }}
            title="Húzd át egy másik helyre"
          />
        );
      })}
      {dragging && emptySlots.map((s) => {
        const hovered = hover === s.slot;
        return (
          <div key={s.slot}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setHover(s.slot); }}
            onDragLeave={() => setHover(null)}
            onDrop={(e) => {
              e.preventDefault();
              setHover(null);
              const i = Number(e.dataTransfer.getData("text/plain"));
              if (Number.isInteger(i) && i >= 0 && i < count) onMove(i, s.slot);
            }}
            style={{
              ...boxStyle(s), borderRadius: 10,
              border: hovered ? "3px solid #7ee08a" : "2px dashed rgba(255,255,255,0.6)",
              background: hovered ? "rgba(126,224,138,0.28)" : "rgba(255,255,255,0.14)",
            }}
            title="Ide húzhatod a kis képet"
          />
        );
      })}
    </>
  );
}

function Field({ label, value, onChange, placeholder, mem }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  mem?: { items: string[]; remove: (v: string) => void };
}) {
  const [focus, setFocus] = useState(false);
  return (
    <div>
      <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>{label}</label>
      <div className="relative">
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} className="twx-input mt-1 w-full text-sm" />
        {mem && <FieldSuggestions open={focus} value={value} items={mem.items} onPick={onChange} onRemove={mem.remove} />}
      </div>
    </div>
  );
}

function Combo({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; options: readonly string[]; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>{label}</label>
      <ComboField className="mt-1 w-full" value={value} onChange={onChange} options={options} placeholder={placeholder} />
    </div>
  );
}

function Limit({ label, value, onChange, max, mem }: {
  label: string; value: string; onChange: (v: string) => void; max: number;
  mem?: { items: string[]; remove: (v: string) => void };
}) {
  const len = (value ?? "").length;
  const over = len > max;
  const [focus, setFocus] = useState(false);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>{label}</label>
        <span className="text-[11px]" style={{ color: over ? "#c0392b" : len > max * 0.9 ? "var(--twx-coral)" : "var(--twx-ink-muted)", fontWeight: over ? 700 : 400 }}>{len}/{max}</span>
      </div>
      <div className="relative">
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} className="twx-input mt-1 w-full text-sm"
          style={over ? { borderColor: "#c0392b", boxShadow: "0 0 0 1px #c0392b" } : undefined} />
        {mem && <FieldSuggestions open={focus} value={value} items={mem.items} onPick={onChange} onRemove={mem.remove} />}
      </div>
      {over && (
        <p className="mt-1 text-[11px] font-medium" style={{ color: "#c0392b" }}>
          Túllépted a {max} karakteres limitet — rövidítsd le, különben nem léphetsz tovább (a hirdetésen levágódna).
        </p>
      )}
    </div>
  );
}
