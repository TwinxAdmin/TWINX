// A nyilvános (és a belépett, új felületű) felső sáv — D36, terv 11 / 2.; 6. lépés: B arculat (terv 29 / 3.).
//
// Háromoszlopos rács: [logó] | [menü PONTOSAN középen] | [gombok jobbra]. A két szélső oszlop minmax(0,1fr),
// ezért egyforma szélesek, és a középső oszlop a valódi középvonalon áll (belépés előtt és után is).
// Belépés előtt: Hogyan működik · Referenciák · Kapcsolat | [Belépés · Regisztráció] (halvány kapszulában)
// Belépés után:  Moduljaim ▾ · Irodai fiók (•) · Referenciák · Kapcsolat | profil ▾
// (az „Ingyenes felmérés" gomb asztalin nincs a sávban: a hero / foglalási sáv adja; a mobilmenüben megvan)
//
// Sötét sáv (b-dark) világos szöveggel; fix magasságú (72 px); a legördülők és a mobil menü a sáv ALATT, abszolút pozícióban nyílnak — semmi nem
// tolja el. A „kredit" szó itt nem jelenik meg. Az Irodai fiók mellett fix hely van a későbbi értesítési pöttynek.
// Asztali menü 1280 px-től (xl); alatta hamburger, hogy a jobb oldali gombok soha ne lógjanak a középső menübe.
"use client";

import { useEffect, useRef, useState } from "react";
import Wordmark from "@/components/Wordmark";
import AuthTrigger from "@/components/AuthTrigger";
import ModuleIcon from "@/components/ModuleIcon";
import { SITE_HOME, SITE_LINKS, type SiteViewer } from "@/lib/site";

/** Kattintásra kívül zárás + Esc. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open, close]);
  return ref;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden
      style={{ transition: "transform .18s", transform: open ? "rotate(180deg)" : "none" }}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** Logó: korall csempe + TWINX (a B minta szerint). */
export function SiteLogo({ href = SITE_HOME }: { href?: string }) {
  return (
    <a href={href} className="inline-flex items-center gap-2.5 text-b-on-dark" aria-label="TWINX — főoldal">
      <span className="h-[26px] w-[26px] flex-none rounded-[7px] bg-b-accent" aria-hidden />
      <Wordmark className="font-display text-[22px] font-bold" accent="var(--color-b-accent-on-dark)" />
    </a>
  );
}

/** Lenyíló panel közös kerete: fix szélesség, belül görgethető. */
function Panel({ children, align = "left", width = 288 }: { children: React.ReactNode; align?: "left" | "right"; width?: number }) {
  return (
    <div className="absolute top-full z-[70] mt-2 overflow-hidden rounded-[18px] border border-b-line bg-b-card p-2 shadow-b"
      style={{ [align]: 0, width }} role="menu">
      {children}
    </div>
  );
}

function ModulesMenu({ modules }: { modules: { label: string; href: string; icon?: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex items-center gap-1.5 hover:text-b-accent-on-dark">
        Moduljaim <Chevron open={open} />
      </button>
      {open && (
        <Panel>
          {modules.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-b-ink-2">Itt jelennek meg az egyedi moduljaid.</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {modules.map((m) => (
                <li key={m.href}>
                  <a href={m.href} role="menuitem"
                    className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium text-b-ink transition-colors hover:bg-b-bg">
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-b-accent-tint text-b-accent-ink">
                      <ModuleIcon name={m.icon} size={16} />
                    </span>
                    <span className="truncate">{m.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}

function ProfileMenu({ email, isAdmin, isHead }: { email: string; isAdmin: boolean; isHead?: boolean }) {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const initial = (email.trim()[0] ?? "?").toUpperCase();

  async function logout() {
    setLeaving(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = SITE_HOME;
  }

  const row = "block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-b-ink transition-colors hover:bg-b-bg";
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Profil"
        className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-white/15 bg-white/10 text-[15px] font-semibold text-b-on-dark">
        {initial}
      </button>
      {open && (
        <Panel align="right" width={248}>
          <p className="truncate px-3 pb-2 pt-1 text-xs text-b-ink-2">{email}</p>
          <a href="/dashboard" className={row}>Kezdőlapom</a>
          <a href="/dashboard/munkaim" className={row}>Korábbi munkák</a>
          {isHead && <a href="/dashboard/hozzaferesek" className={row}>Hozzáférések</a>}
          <a href="/dashboard/settings" className={row}>Fiókbeállítások</a>
          {isAdmin && <a href="/admin" className={row}>Admin felület</a>}
          <div className="my-1 h-px bg-b-line" />
          <button type="button" onClick={logout} disabled={leaving} className={`${row} disabled:opacity-50`}>
            {leaving ? "Kilépés…" : "Kilépés"}
          </button>
        </Panel>
      )}
    </div>
  );
}

/** „Irodai fiók" link fix hellyel az értesítési pöttynek (most nem világít — D36, 3. fázis). */
function OfficeLink({ className = "" }: { className?: string }) {
  return (
    <a href="/dashboard/iroda" className={`relative inline-flex items-center gap-1.5 ${className}`}>
      Irodai fiók
      <span className="inline-block h-2 w-2 rounded-full bg-transparent" aria-hidden />
    </a>
  );
}

export default function SiteHeader({ viewer, contactHref = SITE_LINKS.contact }: {
  viewer: SiteViewer;
  /** Hova vigyen a „Kapcsolat" és az „Ingyenes felmérés" (a dashboardon a kezdőlap kapcsolatblokkja). */
  contactHref?: string;
}) {
  const [mobile, setMobile] = useState(false);
  const mobileRef = useDismiss(mobile, () => setMobile(false));
  const close = () => setMobile(false);
  const link = "hover:text-b-accent-on-dark";

  return (
    // Sötét sáv (Márk kérése 2026-11-24): a világos oldal tetején keretet ad, nem olvad bele.
    <header className="relative z-50 bg-b-dark text-b-on-dark" ref={mobileRef}>
      <div className="mx-auto grid h-[72px] w-full max-w-[1200px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-4 sm:px-8">
        {/* Bal: logó */}
        <div className="flex min-w-0 items-center"><SiteLogo /></div>

        {/* Közép: a menü a valódi középvonalon (asztali). A burkoló mobilon is a rácsban marad (üresen), hogy a jobb
            oldali hamburger ne csússzon a középső oszlopba. */}
        <div className="flex justify-center">
        <nav data-site-nav className={`hidden items-center text-[15px] font-medium xl:flex ${viewer ? "gap-[30px]" : "gap-[34px]"}`}>
          {viewer ? (
            <>
              <ModulesMenu modules={viewer.modules} />
              <OfficeLink className={link} />
            </>
          ) : (
            <a href={SITE_LINKS.how} className={link}>Hogyan működik</a>
          )}
          <a href={SITE_LINKS.references} className={link}>Referenciák</a>
          <a href={contactHref} className={link}>Kapcsolat</a>
        </nav>
        </div>

        {/* Jobb: gombok (asztali) + hamburger (mobil) */}
        <div className="flex min-w-0 items-center justify-end gap-4 text-[15px]">
          <div className="hidden items-center gap-4 xl:flex">
            {/* Az „Ingyenes felmérés" gomb Márk kérésére (2026-11-24) kikerült a felső sávból: közvetlenül alatta, a
                hero-ban és az oldalak foglalási sávjában ott van, így nem duplázunk. (A mobilmenüben megmaradt.) */}
            {viewer ? (
              <ProfileMenu email={viewer.email} isAdmin={viewer.isAdmin} isHead={viewer.isHead} />
            ) : (
              // Belépés · Regisztráció: saját, halvány háttérrel elkülönülő „kapszulában" (Márk kérése).
              <div className="flex items-center gap-1 rounded-full bg-white/[0.07] p-1 ring-1 ring-white/15">
                <AuthTrigger mode="login" className="rounded-full px-4 py-[7px] font-medium transition-colors hover:bg-white/10 hover:text-b-accent-on-dark">Belépés</AuthTrigger>
                <AuthTrigger mode="register" className="rounded-full bg-white/[0.12] px-4 py-[7px] font-semibold transition-colors hover:bg-white/20">Regisztráció</AuthTrigger>
              </div>
            )}
          </div>
          <button type="button" onClick={() => setMobile((v) => !v)} aria-expanded={mobile} aria-label="Menü"
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10 xl:hidden">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              {mobile ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobil menü: a sáv alatt nyílik, a sáv magassága nem változik. */}
      {mobile && (
        <div className="absolute inset-x-0 top-[72px] z-[70] border-t border-white/10 bg-b-dark px-4 pb-6 pt-3 shadow-b-lg sm:px-8 xl:hidden">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-1 text-base font-medium">
            {viewer ? (
              <>
                <p className="px-1 pb-1 pt-2 text-xs uppercase tracking-[0.16em] text-b-on-dark-2">Moduljaim</p>
                {viewer.modules.length === 0 ? (
                  <p className="px-1 py-2 text-sm text-b-on-dark-2">Itt jelennek meg az egyedi moduljaid.</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto">
                    {viewer.modules.map((m) => (
                      <a key={m.href} href={m.href} className="block rounded-lg px-1 py-2 text-sm hover:bg-white/10">{m.label}</a>
                    ))}
                  </div>
                )}
                <div className="my-2 h-px bg-white/10" />
                <OfficeLink className="rounded-lg px-1 py-2" />
              </>
            ) : (
              <a href={SITE_LINKS.how} onClick={close} className="rounded-lg px-1 py-2">Hogyan működik</a>
            )}
            <a href={SITE_LINKS.references} className="rounded-lg px-1 py-2">Referenciák</a>
            <a href={contactHref} onClick={close} className="rounded-lg px-1 py-2">Kapcsolat</a>
            {viewer ? (
              <>
                <a href="/dashboard" className="rounded-lg px-1 py-2">Kezdőlapom</a>
                {viewer.isHead && <a href="/dashboard/hozzaferesek" className="rounded-lg px-1 py-2">Hozzáférések</a>}
                <a href="/dashboard/settings" className="rounded-lg px-1 py-2">Fiókbeállítások</a>
                {viewer.isAdmin && <a href="/admin" className="rounded-lg px-1 py-2">Admin felület</a>}
              </>
            ) : (
              <>
                <AuthTrigger mode="login" className="rounded-lg px-1 py-2 text-left">Belépés</AuthTrigger>
                <AuthTrigger mode="register" className="rounded-lg px-1 py-2 text-left">Regisztráció</AuthTrigger>
              </>
            )}
            <a href={contactHref} onClick={close} className="b-btn mt-3 w-full">Ingyenes felmérés</a>
          </div>
        </div>
      )}
    </header>
  );
}
