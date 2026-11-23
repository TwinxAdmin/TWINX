// Az új nyilvános felső sáv (D36, terv 11 / 2. szakasz).
//
// Belépés előtt: logó · Hogyan működik · Referenciák · Kapcsolat · [Ingyenes felmérés] · Belépés · Regisztráció
// Belépés után:  logó · Moduljaim ▾ · Irodai fiók (•) · Referenciák · Kapcsolat · [Ingyenes felmérés] · profil ▾
//
// Fix magasságú sáv; a legördülők és a mobil menü a sáv ALATT, abszolút pozícióban nyílnak — semmi nem tolja el.
// A „kredit" szó itt nem jelenik meg. Az Irodai fiók mellett fix hely van a későbbi értesítési pöttynek.
"use client";

import { useEffect, useRef, useState } from "react";
import Wordmark from "@/components/Wordmark";
import AuthTrigger from "@/components/AuthTrigger";
import ModuleIcon from "@/components/ModuleIcon";
import { SITE_HOME, SITE_LINKS, type SiteViewer } from "@/lib/site";

const MUTED = "var(--twx-on-dark-muted)";
const ON_DARK = "var(--twx-on-dark)";

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

/** Lenyíló panel közös kerete: fix szélesség, belül görgethető. */
function Panel({ children, align = "left", width = 288 }: { children: React.ReactNode; align?: "left" | "right"; width?: number }) {
  return (
    <div
      className="absolute top-full mt-2 overflow-hidden rounded-2xl p-2 shadow-2xl"
      style={{
        [align]: 0, width, background: "#1b1815", border: "1px solid rgba(255,255,255,0.08)", zIndex: 70,
      }}
      role="menu"
    >
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
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-white/5"
        style={{ color: ON_DARK }}>
        Moduljaim <Chevron open={open} />
      </button>
      {open && (
        <Panel>
          {modules.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm" style={{ color: MUTED }}>Itt jelennek meg az egyedi moduljaid.</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {modules.map((m) => (
                <li key={m.href}>
                  <a href={m.href} role="menuitem"
                    className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors hover:bg-white/5"
                    style={{ color: ON_DARK }}>
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg"
                      style={{ background: "rgba(239,122,90,0.14)", color: "var(--twx-coral)" }}>
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

  const row = "block w-full rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-white/5";
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Profil"
        className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
        style={{ background: "rgba(239,122,90,0.18)", color: "var(--twx-coral-soft)", border: "1px solid rgba(239,122,90,0.35)" }}>
        {initial}
      </button>
      {open && (
        <Panel align="right" width={248}>
          <p className="truncate px-3 pb-2 pt-1 text-xs" style={{ color: MUTED }}>{email}</p>
          <a href="/dashboard" className={row} style={{ color: ON_DARK }}>Kezdőlapom</a>
          <a href="/dashboard/munkaim" className={row} style={{ color: ON_DARK }}>Korábbi munkák</a>
          {isHead && <a href="/dashboard/hozzaferesek" className={row} style={{ color: ON_DARK }}>Hozzáférések</a>}
          <a href="/dashboard/settings" className={row} style={{ color: ON_DARK }}>Fiókbeállítások</a>
          {isAdmin && <a href="/admin" className={row} style={{ color: ON_DARK }}>Admin felület</a>}
          <div className="my-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
          <button type="button" onClick={logout} disabled={leaving} className={`${row} disabled:opacity-50`} style={{ color: ON_DARK }}>
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
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: "transparent" }} aria-hidden />
    </a>
  );
}

function AssessmentButton({ className = "", onClick, href = SITE_LINKS.contact }: { className?: string; onClick?: () => void; href?: string }) {
  return (
    <a href={href} onClick={onClick}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${className}`}
      style={{ background: "var(--twx-coral)", color: "#1c1005" }}>
      Ingyenes felmérés
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
  const link = "rounded-full px-3 py-1.5 transition-colors hover:bg-white/5 hover:text-white";

  return (
    <header className="relative z-50" style={{ background: "var(--twx-dark)", color: MUTED }}>
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-6">
        <a href={SITE_HOME} className="font-display text-2xl font-semibold tracking-wide" style={{ color: ON_DARK }}>
          <Wordmark />
        </a>

        {/* Asztali sáv */}
        <nav className="ml-auto hidden items-center gap-1 text-sm lg:flex">
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
          <AssessmentButton className="mx-2" href={contactHref} />
          {viewer ? (
            <ProfileMenu email={viewer.email} isAdmin={viewer.isAdmin} isHead={viewer.isHead} />
          ) : (
            <>
              <AuthTrigger mode="login" className={link}>Belépés</AuthTrigger>
              <AuthTrigger mode="register" className={link}>Regisztráció</AuthTrigger>
            </>
          )}
        </nav>

        {/* Mobil: hamburger; a menü a sáv alatt nyílik, a sáv magassága nem változik. */}
        <div className="ml-auto lg:hidden" ref={mobileRef}>
          <button type="button" onClick={() => setMobile((v) => !v)} aria-expanded={mobile} aria-label="Menü"
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/5" style={{ color: ON_DARK }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              {mobile ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
          {mobile && (
            <div className="absolute inset-x-0 top-16 border-t px-6 pb-6 pt-3 shadow-2xl"
              style={{ background: "var(--twx-dark)", borderColor: "rgba(255,255,255,0.08)", zIndex: 70 }}>
              <div className="flex flex-col gap-1 text-base" style={{ color: ON_DARK }}>
                {viewer ? (
                  <>
                    <p className="px-1 pb-1 pt-2 text-xs uppercase tracking-[0.18em]" style={{ color: MUTED }}>Moduljaim</p>
                    {viewer.modules.length === 0 ? (
                      <p className="px-1 py-2 text-sm" style={{ color: MUTED }}>Itt jelennek meg az egyedi moduljaid.</p>
                    ) : (
                      <div className="max-h-56 overflow-y-auto">
                        {viewer.modules.map((m) => (
                          <a key={m.href} href={m.href} className="block rounded-lg px-1 py-2 text-sm hover:bg-white/5">{m.label}</a>
                        ))}
                      </div>
                    )}
                    <div className="my-2 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
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
                <AssessmentButton className="mt-3 w-full py-3" onClick={close} href={contactHref} />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
