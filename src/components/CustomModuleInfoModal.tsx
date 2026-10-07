// „Mi az egyedi modul?” — részletes ismertető ablak (dashboard).
// Az `open-custom-info` window-eseményre nyílik; az ablak aljáról egy kattintással
// indítható az igénylés (`open-b2b` esemény → B2BModal).
"use client";

import { useCallback, useEffect, useState } from "react";

const EXAMPLES: Array<{ title: string; text: string }> = [
  { title: "Ingatlaniroda", text: "Az irodád saját adatlap- és ajánlatsablonja, ami a te ingatlanlistádból és arculatodból dolgozik — egy kattintással kész, egységes anyag minden kollégának." },
  { title: "Vendéglátás", text: "Menü- és árkalkulátor a saját beszállítói áraidból: ha drágul egy alapanyag, azonnal látod, melyik étel árát kell módosítani." },
  { title: "Szolgáltató cég", text: "Ajánlatkészítő a saját díjtételeiddel és feltételeiddel: a munkatárs megadja az igényt, a rendszer kész, márkázott árajánlatot ad." },
];

const STEPS: Array<{ title: string; text: string }> = [
  { title: "Igénylés", text: "Röviden leírod, mire lenne szükséged, és megadod a telefonszámod (opcionálisan azt is, mikor hívhatunk)." },
  { title: "Telefonos egyeztetés", text: "Felhívunk, és közösen átnézzük a mostani munkafolyamatodat: mi ismétlődik, mi visz el sok időt, honnan jönnek az adatok." },
  { title: "Árajánlat", text: "Írásban megkapod, mit tud majd a modul, mennyibe kerül és mikorra készül el. Az egyeztetés és az ajánlat díjmentes, nem kötelez semmire." },
  { title: "Fejlesztés és tesztelés", text: "Elkészítjük a modult, és veled együtt kipróbáljuk valós adatokkal — addig finomítjuk, amíg pontosan úgy működik, ahogy kell." },
  { title: "Átadás", text: "A modul megjelenik a „Saját moduljaim” menüpontban, és ugyanúgy használod, mint a portál többi eszközét." },
];

export default function CustomModuleInfoModal() {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);

  const close = useCallback(() => {
    setVisible(false);
    window.setTimeout(() => setOpen(false), 180);
  }, []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("open-custom-info", onOpen);
    return () => window.removeEventListener("open-custom-info", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setVisible(true));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  // Ismertetőből egyenesen az igénylésbe.
  function startRequest() {
    close();
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("open-b2b")), 200);
  }

  if (!open) return null;

  const muted = { color: "var(--twx-ink-muted)" };
  const h3 = "font-display text-base font-semibold";

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200"
      style={{ background: "rgba(12,11,10,0.82)", opacity: visible ? 1 : 0 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-info-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl transition-all duration-200"
        style={{
          background: "var(--twx-cream-card)",
          border: "1px solid var(--twx-line)",
          color: "var(--twx-ink)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0.94)",
        }}
      >
        {/* Fejléc */}
        <div className="flex items-start justify-between gap-4 border-b p-6" style={{ borderColor: "var(--twx-line)" }}>
          <div>
            <h2 id="custom-info-title" className="font-display text-2xl font-semibold">Mi az egyedi modul?</h2>
            <p className="mt-1 text-sm" style={muted}>
              Egy kifejezetten a te vállalkozásodra szabott eszköz a TWINX-en belül.
            </p>
          </div>
          <button type="button" onClick={close} aria-label="Bezárás"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg"
            style={{ background: "var(--twx-line)", color: "var(--twx-ink)" }}>
            ×
          </button>
        </div>

        {/* Tartalom (görgethető) */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6 text-sm leading-relaxed">
          <section>
            <p>
              A portál moduljai (értékbecslés, videó, hirdetés…) mindenkinek ugyanúgy működnek. Az <strong>egyedi modul</strong> ezzel
              szemben a <strong>te munkafolyamatodra, adataidra és szabályaidra</strong> épül: azt a feladatot végzi el, ami nálad
              rendszeresen ismétlődik és sok időt visz el. Ugyanúgy kezeled, mint a többi modult — de csak te látod, és
              azok a munkatársaid, akiknek hozzáférést adunk.
            </p>
          </section>

          <section>
            <h3 className={h3}>Mire jó?</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5" style={muted}>
              <li>ismétlődő, kézzel végzett feladatok automatizálására (adatlapok, ajánlatok, riportok);</li>
              <li>a saját sablonjaid, árlistáid, díjtételeid beépítésére — hogy minden anyag egységes legyen;</li>
              <li>több lépésből álló folyamatok összefűzésére egyetlen kattintásba;</li>
              <li>olyan számításokra és elemzésekre, amik a te üzleted szabályait követik.</li>
            </ul>
          </section>

          <section>
            <h3 className={h3}>Néhány példa</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {EXAMPLES.map((e) => (
                <div key={e.title} className="rounded-xl p-3" style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
                  <p className="text-[13px] font-semibold" style={{ color: "var(--twx-coral)" }}>{e.title}</p>
                  <p className="mt-1 text-[12px] leading-snug" style={muted}>{e.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className={h3}>Hogyan készül el?</h3>
            <ol className="mt-2 space-y-2.5">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ background: "var(--twx-coral)", color: "#1c1005" }}>{i + 1}</span>
                  <span>
                    <strong>{s.title}.</strong> <span style={muted}>{s.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl p-3" style={{ background: "var(--twx-cream)", border: "1px solid var(--twx-line)" }}>
              <h3 className="text-[13px] font-semibold">Mennyibe kerül?</h3>
              <p className="mt-1 text-[12px]" style={muted}>
                Az ár a modul összetettségétől függ, ezért mindig egyedi árajánlatot adunk. Az egyeztetés és az ajánlat
                díjmentes, és nem kötelez semmire.
              </p>
            </div>
            <div className="rounded-xl p-3" style={{ background: "var(--twx-cream)", border: "1px solid var(--twx-line)" }}>
              <h3 className="text-[13px] font-semibold">Ki látja az adataimat?</h3>
              <p className="mt-1 text-[12px]" style={muted}>
                Az egyedi modul és a benne kezelt adatok csak a te fiókodhoz — és az általad megjelölt munkatársakhoz —
                tartoznak. Más felhasználó nem látja és nem éri el.
              </p>
            </div>
          </section>
        </div>

        {/* Lábléc: egyenesen az igénylésbe */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-5" style={{ borderColor: "var(--twx-line)" }}>
          <p className="text-xs" style={muted}>Van egy ötleted? Pár perc az igénylés — mi hívunk vissza.</p>
          <div className="flex gap-2">
            <button type="button" onClick={close} className="rounded-full px-4 py-2 text-sm font-medium"
              style={{ border: "1px solid var(--twx-line)" }}>
              Bezárás
            </button>
            <button type="button" onClick={startRequest} className="rounded-full px-5 py-2 text-sm font-semibold"
              style={{ background: "var(--twx-coral)", color: "#1c1005" }}>
              Egyedi modul igénylése
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
