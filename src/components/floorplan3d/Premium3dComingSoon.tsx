// Prémium 3D — „Hamarosan érkezik" nézet (nem admin, amíg a modul fejlesztés alatt áll).
// Fölül: csak a „Hamarosan érkezik" üzenet és az „Értesíts, ha elérhető" (várólista: /api/premium3d/waitlist) —
// hogy mit tud a modul, azt az alatta lévő bemutató mondja el.
// Alatta: a modul saját „Hogyan működik?" bemutatója (ModuleTour, preview mód — nincs „Kezdjük", ár, kredit).
// A bemutató 3D-motorja CSAK itt töltődik be (dinamikus import), a többi oldalt nem lassítja.
"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { SceneOptions } from "@/lib/floorplan3d/scene";
import type { StyleSheet } from "@/lib/floorplan3d/stylesheet";
import { showToast } from "@/components/Toast";

const ModuleTour = dynamic(() => import("@/components/floorplan3d/intro/ModuleTour"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[560px] items-center justify-center rounded-[28px] text-sm" style={{ background: "#14110f", color: "#BDB3A7" }}>
      A bemutató betöltése…
    </div>
  ),
});

export default function Premium3dComingSoon({ opts, style, subscribed: initial }: {
  opts: SceneOptions; style: StyleSheet | null; subscribed: boolean;
}) {
  const [subscribed, setSubscribed] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function subscribe() {
    setBusy(true);
    try {
      const r = await fetch("/api/premium3d/waitlist", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Nem sikerült feliratkozni.");
      setSubscribed(true);
      showToast("Köszönjük! Szólunk, amint elérhető.", "success");
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="space-y-5">
      {/* „Hamarosan érkezik" sáv */}
      {/* arany keret: lassan körbefutó fény (globals.css: .twx-p3d-*) */}
      <div className="twx-p3d-frame">
      <section className="relative overflow-hidden rounded-[24px] p-6 sm:p-8"
        style={{ background: "linear-gradient(150deg,#2a221b 0%,#1a1612 60%,#231a14 100%)", color: "#F4EFE7" }}>
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(45% 70% at 85% 20%,rgba(212,170,92,.18),transparent 70%)" }} />
        <PremiumDeco />
        <div className="twx-p3d-shine" aria-hidden />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em]"
              style={{ background: "linear-gradient(135deg,#F3D9A4,#D4AA5C)", color: "#2a1d0e" }}>
              ✦ Prémium 3D · Hamarosan érkezik
            </span>
            <h1 className="mt-3 font-display text-[26px] font-extrabold leading-tight sm:text-[32px]">A Prémium 3D hamarosan elérhető</h1>
            <p className="mt-2 max-w-[520px] text-[15px] leading-relaxed" style={{ color: "#CFC6BB" }}>
              Az utolsó simításokat végezzük. Iratkozz fel, és elsőként szólunk, amint használhatod.
            </p>
          </div>
          {/* fix méretű sáv: gomb ↔ feliratkozott állapot (nincs ugrálás) */}
          <div className="flex h-[52px] w-full flex-none items-center lg:w-[340px]">
            {subscribed ? (
              <p className="flex h-full w-full items-center gap-2 rounded-2xl px-4 text-[13px] font-bold leading-snug sm:rounded-full sm:px-5 sm:text-[14px]"
                style={{ background: "rgba(47,158,95,0.16)", color: "#9FE0BC", border: "1px solid rgba(47,158,95,0.35)" }}>
                ✓ Feliratkoztál – szólunk, amint elérhető.
              </p>
            ) : (
              <button type="button" onClick={() => void subscribe()} disabled={busy}
                className="h-full w-full rounded-full px-6 text-[15px] font-extrabold transition hover:brightness-105 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#F3D9A4,#D4AA5C)", color: "#2a1d0e", boxShadow: "0 12px 30px rgba(212,170,92,0.3)" }}>
                {busy ? "Egy pillanat…" : "Értesíts, ha elérhető"}
              </button>
            )}
          </div>
        </div>
      </section>
      </div>

      {/* A modul saját bemutatója — magától indul, hang nélkül, ismétlődve */}
      <ModuleTour opts={opts} style={style} preview />
    </main>
  );
}

/** Halk prémium díszítés a sarkokban (szikrák, drótváz-kocka) — a feliratoktól távol, alacsony átlátszósággal. */
function Spark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0c.7 6.4 5.6 11.3 12 12-6.4.7-11.3 5.6-12 12-.7-6.4-5.6-11.3-12-12C6.4 11.3 11.3 6.4 12 0z" />
    </svg>
  );
}

function PremiumDeco() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {/* drótváz-kocka a jobb felső sarokban — a 3D-re utal (telefonon nem fér el a címke mellett) */}
      <div className="twx-p3d-deco twx-p3d-float right-8 top-5 hidden opacity-60 sm:block">
        <svg className="twx-p3d-spin" width="54" height="54" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round">
          <path d="M24 5 41 14.5v19L24 43 7 33.5v-19L24 5z" />
          <path d="M7 14.5 24 24l17-9.5M24 24v19" />
          <path d="M24 5v19M7 33.5 24 24l17 9.5" strokeOpacity=".35" strokeDasharray="2 3" />
        </svg>
      </div>
      {/* szikrák */}
      <span className="twx-p3d-deco twx-p3d-twinkle right-[86px] top-6 hidden sm:block" style={{ animationDelay: "0.6s" }}><Spark size={15} /></span>
      <span className="twx-p3d-deco twx-p3d-twinkle right-6 bottom-5" style={{ animationDelay: "1.4s" }}><Spark size={13} /></span>
      <span className="twx-p3d-deco twx-p3d-twinkle bottom-4 left-[46%] hidden lg:block" style={{ animationDelay: "2.2s" }}><Spark size={11} /></span>
      <span className="twx-p3d-deco twx-p3d-twinkle right-[38%] top-5 hidden lg:block" style={{ animationDelay: "3s" }}><Spark size={17} /></span>
    </div>
  );
}
