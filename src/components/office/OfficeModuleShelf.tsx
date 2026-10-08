// OfficeModuleShelf — „Kedvenc moduljaim / Összes modul" sáv az irodai felület alján
// (megjelenési terv, kolléga-nézet alja — a vezetőnél is). A modullista a katalógusból jön.
//   • Kedvencek fül: a megcsillagozott modulok kártyái (utolsó használat + Megnyitás),
//     alattuk a további modulok — csillaggal kedvencnek jelölhetők.
//   • Saját moduljaim fül: a neked fejlesztett egyedi modulok; ha még nincs, rövid magyarázat + „Mi az egyedi modul?" gomb.
// A csillag azonnal vált (optimista frissítés), hiba esetén visszaáll.
// A sáv mérete FIX: fülváltáskor nem változik (a tartalom belül görget).
"use client";

import { useEffect, useMemo, useState } from "react";
import ModuleIcon from "@/components/ModuleIcon";
import { showToast } from "@/components/Toast";
import { selectableModules } from "@/lib/module-favorites";
import { fmtWhen } from "@/lib/office-format";

type Tab = "fav" | "own";
type OwnModule = { id: string; name: string; href: string };

export default function OfficeModuleShelf() {
  const modules = useMemo(() => selectableModules(), []);
  const [tab, setTab] = useState<Tab>("fav");
  const [favs, setFavs] = useState<string[] | null>(null);
  const [lastUsed, setLastUsed] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [own, setOwn] = useState<OwnModule[] | null>(null);

  useEffect(() => {
    fetch("/api/my-custom-modules")
      .then((r) => r.json())
      .then((d) => setOwn(d.modules ?? []))
      .catch(() => setOwn([]));
  }, []);

  useEffect(() => {
    fetch("/api/module-favorites")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); setFavs([]); return; }
        setFavs(d.favorites ?? []); setLastUsed(d.lastUsed ?? {});
      })
      .catch(() => { setError("Nem sikerült betölteni a kedvenceket."); setFavs([]); });
  }, []);

  async function toggle(href: string) {
    if (!favs) return;
    const on = favs.includes(href);
    const prev = favs;
    setFavs(on ? favs.filter((h) => h !== href) : [...favs, href]);
    try {
      const res = await fetch("/api/module-favorites", {
        method: on ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ href }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setFavs(prev);
        showToast(d.error ?? "Nem sikerült menteni.", "error");
      }
    } catch {
      setFavs(prev);
      showToast("Hálózati hiba.", "error");
    }
  }

  const favMods = modules.filter((m) => favs?.includes(m.href));
  const otherMods = modules.filter((m) => !favs?.includes(m.href));

  return (
    <section className="flex flex-col gap-4 rounded-[20px] px-5 py-5 sm:px-[22px]"
      style={{
        background: "#121110",
        backgroundImage: "radial-gradient(ellipse 600px 260px at 0% 100%, rgba(238,123,91,0.16), transparent 70%)",
        border: "1px solid #2A2420",
        color: "#F3EDE6",
      }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-full p-[3px]" style={{ background: "#0E0C0B", border: "1px solid #2E2723" }} role="tablist">
          <TabBtn active={tab === "fav"} onClick={() => setTab("fav")}>
            <Star filled size={13} /> Kedvenc moduljaim <span className="tabular-nums">{favs?.length ?? 0}</span>
          </TabBtn>
          <TabBtn active={tab === "own"} onClick={() => setTab("own")}>
            Saját moduljaim <span className="tabular-nums">{own?.length ?? 0}</span>
          </TabBtn>
        </div>
        <span className="text-xs" style={{ color: "#8F857B" }}>Csillaggal jelöld meg, amit gyakran használsz — egy kattintással nyílik.</span>
      </div>

      {/* FIX MAGASSÁGÚ tartalom: fülváltáskor (Kedvencek ⇄ Összes) és betöltéskor sem változik
          a sáv mérete — ami nem fér el, a dobozon belül görget. */}
      <div className="flex h-[380px] flex-col gap-4 overflow-y-auto overscroll-contain pr-1" role="tabpanel">
      {error && <p className="text-xs" style={{ color: "#F4A48A" }}>{error}</p>}
      {tab === "fav" && !favs && <p className="text-sm" style={{ color: "#8F857B" }}>Betöltés…</p>}

      {favs && tab === "fav" && (
        <>
          {favMods.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
              {favMods.map((m) => (
                <FavCard key={m.href} href={m.href} label={m.label} icon={m.icon} last={lastUsed[m.href]} onUnstar={() => toggle(m.href)} />
              ))}
            </div>
          ) : (
            <div className="flex min-h-[132px] flex-col items-center justify-center gap-1.5 rounded-[14px] px-6 py-5 text-center"
              style={{ border: "1.5px dashed #3A322C", background: "rgba(255,255,255,0.02)" }}>
              <span style={{ color: "#EE7B5B" }}><Star filled size={20} /></span>
              <p className="font-display text-sm font-semibold" style={{ color: "#F6F1EA" }}>Még nincs kedvenc modulod</p>
              <p className="max-w-[380px] text-xs" style={{ color: "#A89E94" }}>
                Kattints a csillagra egy modul mellett lent — a kedvenceid itt, nagy kártyán jelennek meg, egy kattintással nyílnak.
              </p>
            </div>
          )}

          {otherMods.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold tracking-[0.1em]" style={{ color: "#8F857B" }}>
                TOVÁBBI MODULOK — CSILLAGGAL KEDVENCNEK JELÖLHETŐ
              </span>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
                {otherMods.map((m) => <ModuleRow key={m.href} href={m.href} label={m.label} starred={false} onToggle={() => toggle(m.href)} />)}
              </div>
            </div>
          )}
        </>
      )}

      {tab === "own" && <OwnModules modules={own} />}
      </div>
    </section>
  );
}

/** „Saját moduljaim" fül: a neked fejlesztett egyedi modulok — vagy ha még nincs, rövid magyarázat. */
function OwnModules({ modules }: { modules: OwnModule[] | null }) {
  if (!modules) return <p className="text-sm" style={{ color: "#8F857B" }}>Betöltés…</p>;

  if (modules.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[14px] px-6 py-6 text-center"
        style={{ border: "1.5px dashed #3A322C", background: "rgba(255,255,255,0.02)" }}>
        <span className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: "rgba(238,123,91,0.16)", color: "#EE7B5B" }}>
          <ModuleIcon name="custom" size={22} />
        </span>
        <p className="font-display text-base font-semibold" style={{ color: "#F6F1EA" }}>Még nincs saját modulod</p>
        <p className="max-w-[460px] text-[13px] leading-relaxed" style={{ color: "#A89E94" }}>
          A saját (egyedi) modul egy csak nektek fejlesztett eszköz: a te munkafolyamatodra, árlistáidra és sablonjaidra épül,
          és azt a feladatot végzi el egy kattintással, ami ma órákat visz el. Ugyanúgy itt, a TWINX-ben használod, kreditből.
        </p>
        <a href="/dashboard/egyedi-modul" className="mt-1 inline-flex h-10 items-center rounded-full px-5 text-[13px] font-semibold transition-opacity hover:opacity-90"
          style={{ background: "#F08A68", color: "#1C1A17" }}>
          Mi az egyedi modul? →
        </a>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
      {modules.map((m) => (
        <a key={m.id} href={m.href} className="flex flex-col gap-2.5 rounded-[14px] p-3.5 transition-colors hover:bg-[#221E1A]"
          style={{ background: "#1B1815", border: "1px solid rgba(238,123,91,0.45)", color: "#F3EDE6" }}>
          <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px]" style={{ background: "rgba(238,123,91,0.16)", color: "#EE7B5B" }}>
            <ModuleIcon name="custom" size={18} />
          </span>
          <div>
            <div className="font-display text-[15px] font-semibold" style={{ color: "#F6F1EA" }}>{m.name}</div>
            <div className="text-xs" style={{ color: "#8F857B" }}>Neked fejlesztett modul</div>
          </div>
          <span className="text-xs font-semibold" style={{ color: "#EE7B5B" }}>Megnyitás →</span>
        </a>
      ))}
    </div>
  );
}

function FavCard({ href, label, icon, last, onUnstar }: { href: string; label: string; icon?: string; last?: string; onUnstar: () => void }) {
  return (
    <div className="relative flex flex-col gap-2.5 rounded-[14px] p-3.5 transition-colors hover:bg-[#221E1A]"
      style={{ background: "#1B1815", border: "1px solid rgba(238,123,91,0.45)" }}>
      <div className="flex items-start justify-between">
        <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px]" style={{ background: "rgba(238,123,91,0.16)", color: "#EE7B5B" }}>
          <ModuleIcon name={icon ?? "custom"} size={18} />
        </span>
        <button type="button" onClick={onUnstar} aria-label={`${label} eltávolítása a kedvencek közül`} title="Kivétel a kedvencek közül"
          className="relative z-10 rounded-md p-1 transition-transform hover:scale-110" style={{ color: "#EE7B5B" }}>
          <Star filled size={16} />
        </button>
      </div>
      <div>
        <div className="font-display text-[15px] font-semibold" style={{ color: "#F6F1EA" }}>{label}</div>
        <div className="text-xs" style={{ color: "#8F857B" }}>{last ? `Utoljára: ${fmtWhen(last, false)}` : "Még nem használtad"}</div>
      </div>
      {/* az egész kártya kattintható — a csillag fölötte marad */}
      <a href={href} className="text-xs font-semibold after:absolute after:inset-0 after:rounded-[14px] after:content-['']" style={{ color: "#EE7B5B" }}>
        Megnyitás →
      </a>
    </div>
  );
}

function ModuleRow({ href, label, icon, starred, onToggle }: { href: string; label: string; icon?: string; starred: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2" style={{ background: "#1B1815", border: `1px solid ${starred ? "rgba(238,123,91,0.45)" : "#2E2723"}` }}>
      <button type="button" onClick={onToggle} aria-pressed={starred} aria-label={starred ? `${label} eltávolítása a kedvencek közül` : `${label} kedvencnek jelölése`}
        className="flex h-7 w-7 flex-none items-center justify-center rounded-md transition-colors hover:bg-white/5"
        style={{ color: starred ? "#EE7B5B" : "#6E655C" }}>
        <Star filled={starred} size={15} />
      </button>
      {icon && <span style={{ color: "#A89E94" }}><ModuleIcon name={icon} size={15} /></span>}
      <span className="min-w-0 flex-1 truncate text-[13px]">{label}</span>
      <a href={href} className="flex-none text-xs hover:underline" style={{ color: "#BFB4A8" }}>Megnyitás</a>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick}
      className="inline-flex h-8 min-w-[150px] items-center justify-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors"
      style={active ? { background: "#F08A68", color: "#1C1A17" } : { color: "#A89E94" }}>
      {children}
    </button>
  );
}

function Star({ filled, size = 15 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
      <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
    </svg>
  );
}
