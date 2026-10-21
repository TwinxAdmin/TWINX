// twinx.hu/kapcsolat — Kapcsolat: telefon (két kolléga), e-mail, élő chat, üzenetküldő űrlap, gyors linkek és egy
// kis reklám a TWINX gyorsaságáról. Nyilvános oldal; bejelentkezve az űrlapon a név és az e-mail előre kitöltve, és a „Vissza" a Portálba visz.
// Az elérhetőségek a src/lib/contact.ts-ben (egy helyen módosíthatók); az üzemeltető adatai az ÁSZF-ben.
import type { Metadata } from "next";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import ContactForm from "@/components/contact/ContactForm";
import OpenChatButton from "@/components/contact/OpenChatButton";
import { createClient } from "@/lib/supabase/server";
import { CONTACT_EMAIL, CONTACT_PHONES } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Kapcsolat — TWINX",
  description: "Kérdésed van a TWINX-ről? Hívj, írj, vagy chatelj velünk.",
};

function Icon({ d }: { d: React.ReactNode }) {
  return (
    <span aria-hidden className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl" style={{ background: "#fde4d9", color: "#c4553a" }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
    </span>
  );
}

const CARD = "flex flex-col rounded-[20px] bg-white p-6";
const CARD_STYLE = { boxShadow: "0 0 0 1px var(--twx-line), 0 10px 26px rgba(28,24,21,.05)" };

export default async function ContactPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user ? await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle() : { data: null };

  return (
    <main className="twx-page min-h-screen font-sans" style={{ background: "var(--twx-cream)" }}>
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-12">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="font-display text-2xl font-semibold tracking-wide"><Wordmark /></Link>
          <Link href={user ? "/dashboard" : "/"} className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            ← {user ? "Vissza a Portálba" : "Vissza a főoldalra"}
          </Link>
        </div>

        <header className="mt-10 max-w-2xl">
          <p className="text-[11px] font-bold tracking-[0.22em]" style={{ color: "#c4553a" }}>KAPCSOLAT</p>
          <h1 className="mt-2 font-display text-4xl font-bold leading-tight sm:text-5xl">Beszéljünk!</h1>
          <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>
            Kérdésed van, elakadtál egy modulnál, vagy céges megoldást keresel? Hívj minket, írj e-mailt,
            vagy kezdj egy chatet — személyesen válaszolunk.
          </p>
        </header>

        {/* Elérhetőségek — három egyforma kártya */}
        <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className={CARD} style={CARD_STYLE}>
            <Icon d={<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" />} />
            <h2 className="mt-4 font-display text-lg font-bold">Telefon</h2>
            <div className="mt-3 space-y-3">
              {CONTACT_PHONES.map((p) => (
                <a key={p.tel} href={`tel:${p.tel}`} className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-[#FBF6F0]" style={{ boxShadow: "inset 0 0 0 1px var(--twx-line)" }}>
                  <span className="block text-xs font-semibold" style={{ color: "var(--twx-ink-muted)" }}>{p.name}</span>
                  <span className="block font-display text-lg font-bold tabular-nums">{p.display}</span>
                </a>
              ))}
            </div>
          </div>

          <div className={CARD} style={CARD_STYLE}>
            <Icon d={<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>} />
            <h2 className="mt-4 font-display text-lg font-bold">E-mail</h2>
            <p className="mb-6 mt-1 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Kérdés, számla, céges ajánlat — írj bármikor.</p>
            <a href={`mailto:${CONTACT_EMAIL}`} className="mt-auto inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-bold" style={{ background: "#fff", boxShadow: "inset 0 0 0 1px #d9cfc4" }}>
              {CONTACT_EMAIL}
            </a>
          </div>

          <div className={CARD} style={{ ...CARD_STYLE, background: "linear-gradient(150deg,#2a221b,#16120f)", color: "var(--twx-on-dark)" }}>
            <span aria-hidden className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl" style={{ background: "rgba(239,122,90,.18)", color: "#ffb79f" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            </span>
            <h2 className="mt-4 font-display text-lg font-bold">Élő chat</h2>
            <p className="mb-6 mt-1 text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>A leggyorsabb: írj nekünk közvetlenül az oldalról.</p>
            <OpenChatButton className="mt-auto inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: "#c4553a" }} />
          </div>
        </section>

        {/* Űrlap + oldalsáv */}
        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.45fr_1fr]">
          <ContactForm initialName={String(me?.full_name ?? "")} initialEmail={user?.email ?? ""} />

          <div className="space-y-4">
            <div className="rounded-[20px] bg-white p-6" style={CARD_STYLE}>
              <h2 className="font-display text-lg font-bold">Gyors segítség</h2>
              <ul className="mt-3 space-y-1">
                {[
                  { href: "/pricing", t: "Csomagok és árak", s: "Kreditcsomagok — a kredit nem jár le" },
                  { href: "/egyedi-modul", t: "Egyedi fejlesztés", s: "Saját modul a cégednek" },
                  { href: user ? "/dashboard/settings" : "/register", t: user ? "Fiók és számlázás" : "Regisztráció", s: user ? "Profil, számlázási adatok, hírlevél" : "Ingyenes próbakreditekkel" },
                  { href: "/aszf", t: "ÁSZF", s: "Általános Szerződési Feltételek" },
                ].map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[#FBF6F0]">
                      <span>
                        <span className="block text-sm font-semibold">{l.t}</span>
                        <span className="block text-xs" style={{ color: "var(--twx-ink-muted)" }}>{l.s}</span>
                      </span>
                      <span aria-hidden style={{ color: "#c4553a" }}>→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Kis reklám: mennyivel gyorsabb a TWINX-szel (ugyanaz az üzenet, mint a Portál inspirációs blokkjában) */}
            <div className="relative overflow-hidden rounded-[20px] p-6" style={{ background: "radial-gradient(120% 140% at 85% 0%,#3a2a20 0%,#1a1512 45%,#110e0c 100%)", color: "var(--twx-on-dark)" }}>
              <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full" style={{ background: "radial-gradient(circle, rgba(239,122,90,.28), transparent 65%)" }} />
              <p className="relative text-[11px] font-bold tracking-[0.22em]" style={{ color: "#f3b49c" }}>EGY ÚJ MEGBÍZÁS, EGY DÉLELŐTT</p>
              <h2 className="relative mt-2 font-display text-2xl font-bold leading-tight">
                2–3 nap helyett <span className="twx-insp-grad">~20 perc.</span>
              </h2>
              <p className="relative mt-2 text-sm leading-relaxed" style={{ color: "var(--twx-on-dark-muted)" }}>
                Egy telefonos fotóból hirdetésre kész kép, videó, értékbecslés és látványterv — percek alatt.
              </p>
              <ul className="relative mt-4 grid grid-cols-2 gap-2 text-[13px]">
                {[["~40 mp", "feljavított fotó"], ["~2 perc", "kész hirdetéskép"], ["~1 perc", "értékbecslés"], ["~5 perc", "bemutató videó"]].map(([t, s]) => (
                  <li key={s} className="rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,.06)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.1)" }}>
                    <b className="block font-display text-base" style={{ color: "#ffb79f" }}>{t}</b>
                    <span style={{ color: "#e9e1d7" }}>{s}</span>
                  </li>
                ))}
              </ul>
              <Link href={user ? "/dashboard" : "/register"}
                className="relative mt-5 inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-bold text-white transition-opacity hover:opacity-90"
                style={{ background: "#c4553a" }}>
                {user ? "Vissza a munkához →" : "Kipróbálom ingyen →"}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
