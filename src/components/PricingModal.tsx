// Csomagok modális ablakban (a landingen és a dashboardon is ez nyílik az
// `open-pricing` window-eseményre).
//
// KÉT nézete van:
//   1) "packages" — a csomaglista. Amíg a bankkártyás fizetés nincs élesítve
//      (CHECKOUT_ENABLED=false), a „Vásárlás" gomb kikapcsolva, „Hamarosan"
//      felirattal látszik, és alatta ott a MŰKÖDŐ út: Kredit igénylés.
//   2) "request" — az igénylő nézet: csomagválasztás → (ha kell) számlázási
//      adatok → megrendelés. A partner egy ablakban végigmegy, nem veszti el a fonalat.
//   3) "checkout" — bankkártyás vásárlás (2026-10-17): (ha kell) számlázási adatok → „azonnali jóváírást kérem"
//      jelölőnégyzet → Stripe. A sikeres fizetés után a kredit azonnal jár, a számlát a Számlázz.hu e-mailben küldi.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CREDIT_PACKAGES, CHECKOUT_ENABLED } from "@/lib/packages";
import { formatHuf, isBillingComplete, type BillingInfo } from "@/lib/billing";
import BillingForm from "@/components/BillingForm";

type Pending = {
  id: string;
  amount: number;
  net_huf: number | null;
  invoice_status: "none" | "to_issue" | "issued" | "paid" | null;
  billing_kind: "free" | "invoice" | null;
  created_at: string;
};

type State = {
  signedIn: boolean;
  role?: string;
  preview?: boolean; // admin előnézet: minden látszik, de nem küldünk be semmit
  needsBilling?: boolean;
  billing?: BillingInfo | null;
  billingComplete?: boolean;
  pending?: Pending | null;
};

const PENDING_LABEL: Record<string, string> = {
  to_issue: "Megkaptuk a megrendelésed — a számla készül.",
  issued: "A számla kiállítva, befizetésre vár. Beérkezés után jóváírjuk a kreditet.",
  none: "Az igényed elbírálásra vár.",
};

export default function PricingModal() {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"packages" | "request" | "checkout">("packages");
  const [consent, setConsent] = useState(false); // azonnali jóváírás kérése + az elállás szabályainak tudomásulvétele (ÁSZF 6.)
  const [state, setState] = useState<State | null>(null);
  const [pickedId, setPickedId] = useState<string>("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const close = useCallback(() => {
    setVisible(false);
    window.setTimeout(() => {
      setOpen(false);
      setMode("packages");
      setDone(false);
      setError(null);
      setConsent(false);
    }, 180);
  }, []);

  // Az `open-pricing` esemény detail.packageId-vel egyenesen a fizetési lépést nyitja (pl. a /pricing oldalról).
  const directCheckout = useRef<string | null>(null);
  // Hová menjen a kredit: saját egyenleg, vagy az iroda közös egyenlege (az irodai feltöltő ablakból).
  const [target, setTarget] = useState<"self" | "office">("self");
  useEffect(() => {
    const onOpen = (e: Event) => {
      setError(null);
      const detail = (e as CustomEvent<{ packageId?: string; target?: "office" }>).detail;
      directCheckout.current = detail?.packageId ?? null;
      setTarget(detail?.target === "office" ? "office" : "self");
      setOpen(true);
    };
    window.addEventListener("open-pricing", onOpen);
    return () => window.removeEventListener("open-pricing", onOpen);
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

  // Az igénylő nézethez kell tudnunk, ki a partner és van-e számlázási adata.
  const loadState = useCallback(async () => {
    try {
      const res = await fetch("/api/me/billing-state");
      if (!res.ok) return null;
      const d = (await res.json()) as State;
      setState(d);
      return d;
    } catch {
      return null;
    }
  }, []);

  // Nyitáskor megnézzük, ki a partner. A sales kollégának nincs értelme
  // csomagárakat mutatni (ingyenes belső keretet kap) — neki rögtön az
  // igénylő nézet nyílik.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const d = await loadState();
      if (cancelled || !d) return;
      const direct = directCheckout.current;
      directCheckout.current = null;
      if (direct && CHECKOUT_ENABLED) {
        if (!d.signedIn) {
          // kijelentkezve: regisztráció (ugyanaz, mint az openAuth, de a hatáson belül)
          close();
          window.setTimeout(() => window.dispatchEvent(new CustomEvent("open-auth", { detail: { mode: "register" } })), 180);
          return;
        }
        setPickedId(direct); setConsent(false); setMode("checkout");
        return;
      }
      if (d.signedIn && d.role === "sales") setMode("request");
    })();
    return () => { cancelled = true; };
  }, [open, loadState, close]);

  function openAuth() {
    close();
    window.setTimeout(
      () => window.dispatchEvent(new CustomEvent("open-auth", { detail: { mode: "register" } })),
      180
    );
  }

  async function startRequest() {
    setError(null);
    const d = state ?? (await loadState());
    // Kijelentkezve nincs értelme az űrlapnak — regisztrációra küldjük.
    if (!d?.signedIn) { openAuth(); return; }
    setMode("request");
  }

  /** „Vásárlás" a csomaglistán → a fizetési lépés (bejelentkezés nélkül előbb regisztráció). */
  async function startCheckout(packageId: string) {
    setError(null);
    const d = state ?? (await loadState());
    if (!d?.signedIn) { openAuth(); return; }
    setPickedId(packageId);
    setConsent(false);
    setTarget("self");
    setMode("checkout");
  }

  async function buy(packageId: string) {
    if (state?.preview) { setError("Ez csak előnézet — nem indítunk valódi fizetést."); return; }
    setError(null);
    setLoadingId(packageId);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId, immediateConsent: consent, ...(target === "office" ? { target: "office" } : {}) }),
      });
      const data = await res.json();

      if (res.status === 401) { openAuth(); return; }
      if (res.status === 428 || data.needsBilling) {
        await loadState();
        setError("A fizetés előtt töltsd ki a számlázási adataidat.");
        return;
      }
      if (!res.ok || !data.url) {
        setError(data.error ?? "Hiba a fizetés indításakor.");
        return;
      }
      window.location.href = data.url as string;
    } catch {
      setError("Hálózati hiba. Próbáld újra.");
    } finally {
      setLoadingId(null);
    }
  }

  async function sendRequest() {
    const pkg = CREDIT_PACKAGES.find((p) => p.id === pickedId);
    if (!pkg) { setError("Válassz csomagot."); return; }
    // Admin előnézetben csak a megjelenést nézzük — nem hozunk létre valódi kérést.
    if (state?.preview) {
      setError("Ez csak előnézet — nem küldünk el valódi igénylést.");
      return;
    }
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/credit-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: pkg.id,
          amount: pkg.credits,
          reason: note.trim() || undefined,
        }),
      });
      const d = await res.json();
      // 428 = hiányzik a számlázási adat → itt helyben megadható.
      if (res.status === 428 || d.needsBilling) {
        await loadState();
        setError("A megrendeléshez töltsd ki a számlázási adataidat.");
        return;
      }
      if (!res.ok) { setError(d.error || "A megrendelés nem sikerült."); return; }
      setDone(true);
      await loadState();
    } catch {
      setError("Hálózati hiba. Próbáld újra.");
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  const picked = CREDIT_PACKAGES.find((p) => p.id === pickedId) ?? null;
  const needsBillingForm = state?.needsBilling && !state?.billingComplete;
  // A kártyás vásárlásnál MINDENKINEK kell számlázási adat (a számla automatikusan készül).
  const checkoutNeedsBilling = !isBillingComplete(state?.billing ?? null);
  // A sales kolléga belső keretet kap: neki nincs számla és nincs ár.
  const isSales = state?.role === "sales";

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 transition-opacity duration-200"
      style={{ background: "rgba(12,11,10,0.82)", opacity: visible ? 1 : 0 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="my-8 w-full max-w-md rounded-2xl p-7 transition-all duration-200"
        style={{
          background: "var(--twx-cream-card)",
          border: "1px solid var(--twx-line)",
          color: "var(--twx-ink)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0.94)",
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold">
            {mode === "packages" ? "Csomagok" : mode === "checkout" ? "Fizetés bankkártyával" : isSales ? "Keret igénylése" : "Kredit igénylés"}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Bezárás"
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg"
            style={{ background: "var(--twx-line)", color: "var(--twx-ink)" }}
          >
            ×
          </button>
        </div>

        {/* ------------------------------ CSOMAGLISTA ------------------------------ */}
        {mode === "packages" && (
          <>
            <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
              Fix áras csomagok. A megvásárolt egyenleg nem jár le.
              {CHECKOUT_ENABLED ? " Bankkártyával fizetsz, a kredit azonnal megérkezik, a számlát e-mailben küldjük." : ""}
            </p>

            <ul className="mt-5 space-y-3">
              {CREDIT_PACKAGES.map((pkg) => (
                <li
                  key={pkg.id}
                  className="flex items-center justify-between gap-3 rounded-xl p-4"
                  style={{ background: "var(--twx-cream)", border: "1px solid var(--twx-line)" }}
                >
                  <div>
                    <p className="font-display text-lg font-medium">{pkg.name}</p>
                    <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                      {pkg.priceHuf.toLocaleString("hu-HU")} Ft
                    </p>
                  </div>
                  {CHECKOUT_ENABLED ? (
                    <button
                      onClick={() => void startCheckout(pkg.id)}
                      className="twx-btn shrink-0"
                    >
                      Vásárlás
                    </button>
                  ) : (
                    <span
                      className="shrink-0 cursor-not-allowed rounded-xl px-4 py-2 text-sm font-semibold"
                      style={{ background: "var(--twx-line)", color: "var(--twx-ink-muted)", opacity: 0.75 }}
                      title="A bankkártyás fizetés hamarosan indul"
                    >
                      Hamarosan
                    </span>
                  )}
                </li>
              ))}
            </ul>

            {/* A MŰKÖDŐ út — külön blokkban, hogy ne tűnjön hibának a fenti gomb */}
            {!CHECKOUT_ENABLED && (
              <div
                className="mt-5 rounded-xl p-4"
                style={{ background: "var(--twx-coral-soft)", border: "1px solid var(--twx-coral)" }}
              >
                <p className="text-sm font-semibold" style={{ color: "#7a2e17" }}>
                  Most így tudsz kreditet szerezni
                </p>
                <p className="mt-1 text-xs" style={{ color: "#7a2e17" }}>
                  A bankkártyás fizetés hamarosan indul. Addig leadod az igényed, mi
                  kiállítjuk a számlát, és a befizetés beérkezése után jóváírjuk a kreditet.
                </p>
                <button
                  type="button"
                  onClick={() => void startRequest()}
                  className="mt-3 w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
                  style={{ background: "var(--twx-coral)" }}
                >
                  Kredit igénylés
                </button>
              </div>
            )}

            {/* kártyás fizetés mellett is megmarad a számla alapú (utalásos) út */}
            {CHECKOUT_ENABLED && (
              <button type="button" onClick={() => void startRequest()}
                className="mt-4 w-full text-xs underline-offset-2 hover:underline" style={{ color: "var(--twx-ink-muted)" }}>
                Inkább számla alapján, átutalással fizetnél? Kredit igénylés →
              </button>
            )}

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <p className="mt-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
              Bejelentkezés szükséges. Az árak végösszegek (alanyi adómentes, ÁFA-t nem tartalmaz).
            </p>
          </>
        )}

        {/* ------------------------------ BANKKÁRTYÁS FIZETÉS ------------------------------ */}
        {mode === "checkout" && picked && (
          <>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl p-4"
              style={{ background: "var(--twx-cream)", border: "1px solid var(--twx-line)" }}>
              <span>
                <span className="block font-display text-lg font-medium">{picked.credits} kredit</span>
                <span className="block text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  {target === "office" ? "az iroda közös egyenlegére" : picked.name}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-lg font-semibold">{formatHuf(picked.priceHuf)}</span>
                <span className="block text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>végösszeg</span>
              </span>
            </div>

            {checkoutNeedsBilling ? (
              <div className="mt-4 rounded-xl p-4" style={{ background: "var(--twx-cream)", border: "1px solid var(--twx-line)" }}>
                <p className="text-sm font-semibold">Számlázási adatok</p>
                <p className="mt-1 mb-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  Erre a névre és címre állítjuk ki a számlát. Egyszer kell megadni, később a Beállításokban módosíthatod.
                </p>
                <BillingForm
                  initial={state?.billing ?? null}
                  embedded
                  preview={state?.preview}
                  onSaved={() => void loadState()}
                />
              </div>
            ) : (
              <>
                <p className="mt-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  Számla erre: <strong>{state?.billing?.billing_type === "company" ? state?.billing?.billing_company_name : state?.billing?.billing_name}</strong>
                  {" · "}a Beállításokban módosítható
                </p>
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl p-3 text-xs leading-relaxed"
                  style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 flex-none" />
                  <span>
                    Kérem, hogy a krediteket a fizetés után <strong>azonnal jóváírjátok</strong>. Tudomásul veszem, hogy a
                    <strong> felhasznált</strong> kreditekre az elállási jog megszűnik (a fel nem használtakra 14 napig megmarad —{" "}
                    <a href="/aszf" target="_blank" rel="noreferrer" className="underline">ÁSZF</a> 6. pont).
                  </span>
                </label>
                <button type="button" onClick={() => void buy(picked.id)}
                  disabled={!consent || loadingId !== null}
                  title={!consent ? "Előbb fogadd el az azonnali jóváírást" : undefined}
                  className="mt-4 w-full rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: "var(--twx-coral)" }}>
                  {loadingId ? "Átirányítás a fizetéshez…" : `Fizetés bankkártyával — ${formatHuf(picked.priceHuf)}`}
                </button>
                <p className="mt-2 text-center text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                  Biztonságos fizetés a Stripe oldalán · a kártyaadatod hozzánk nem jut el
                </p>
              </>
            )}

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <button type="button" onClick={() => { setMode("packages"); setError(null); }}
              className="mt-3 w-full text-xs" style={{ color: "var(--twx-ink-muted)" }}>
              ← Vissza a csomagokhoz
            </button>
          </>
        )}

        {/* ------------------------------ IGÉNYLŐ NÉZET ------------------------------ */}
        {mode === "request" && (
          <>
            {done ? (
              <div className="mt-4">
                <p className="rounded-xl p-4 text-sm" style={{ background: "#f2f9f5", color: "#2e7d52" }}>
                  Köszönjük, megkaptuk az igényed! Kiállítjuk a számlát, és a befizetés
                  beérkezése után jóváírjuk a kreditet. Az állapotot a Beállításokban
                  bármikor megnézheted.
                </p>
                <button type="button" onClick={close}
                  className="mt-4 w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
                  style={{ background: "var(--twx-coral)" }}>
                  Rendben
                </button>
              </div>
            ) : state?.pending ? (
              <div className="mt-4">
                <p className="rounded-xl p-4 text-sm" style={{ background: "#fff8ec", color: "#7a5a12" }}>
                  {PENDING_LABEL[state.pending.invoice_status ?? "none"] ?? PENDING_LABEL.none}
                </p>
                <p className="mt-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  {state.pending.amount} kredit
                  {state.pending.net_huf ? ` · ${formatHuf(state.pending.net_huf)}` : ""}
                  {" · beadva: "}{new Date(state.pending.created_at).toLocaleDateString("hu-HU")}
                </p>
                <button type="button" onClick={close}
                  className="mt-4 w-full rounded-xl px-5 py-2.5 text-sm font-semibold"
                  style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
                  Bezárás
                </button>
              </div>
            ) : (
              <>
                <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                  {isSales
                    ? "Sales kollégaként belső keretet kapsz — nincs számlázás. Válaszd ki, mekkora keretre van szükséged."
                    : "Válaszd ki a csomagot. A számlát e-mailben küldjük, a kredit a befizetés beérkezése után érkezik meg."}
                </p>

                <div className="mt-4 space-y-2">
                  {CREDIT_PACKAGES.map((p) => {
                    const on = pickedId === p.id;
                    return (
                      <button key={p.id} type="button" onClick={() => setPickedId(p.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl p-3 text-left transition"
                        style={on
                          ? { border: "2px solid var(--twx-coral)", background: "var(--twx-coral-soft)" }
                          : { border: "1px solid var(--twx-line)", background: "var(--twx-cream)" }}>
                        <span>
                          <span className="block font-display text-base font-medium">{p.credits} kredit</span>
                          {!isSales && (
                            <span className="block text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                              {Math.round(p.priceHuf / p.credits)} Ft / kredit
                            </span>
                          )}
                        </span>
                        {!isSales && (
                          <span className="text-sm font-semibold">{formatHuf(p.priceHuf)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Számlázási adatok — csak ha még hiányoznak */}
                {needsBillingForm ? (
                  <div className="mt-5 rounded-xl p-4" style={{ background: "var(--twx-cream)", border: "1px solid var(--twx-line)" }}>
                    <p className="text-sm font-semibold">Számlázási adatok</p>
                    <p className="mt-1 mb-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                      Egyszer kell megadni, később a Beállításokban módosíthatod.
                    </p>
                    <BillingForm
                      initial={state?.billing ?? null}
                      embedded
                      preview={state?.preview}
                      onSaved={() => void loadState()}
                    />
                  </div>
                ) : (
                  <>
                    <label className="mt-4 block">
                      <span className="mb-1 block text-xs font-medium">
                        {isSales ? "Mire kell? (nem kötelező)" : "Megjegyzés a számlához (nem kötelező)"}
                      </span>
                      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                        placeholder={isSales ? "pl. 3 ügyfélbemutató a jövő héten" : "pl. megrendelésszám, költséghely"}
                        className="twx-input w-full text-sm" />
                    </label>

                    <button type="button" onClick={() => void sendRequest()}
                      disabled={sending || !picked}
                      className="mt-4 w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                      style={{ background: "var(--twx-coral)" }}>
                      {sending
                        ? "Küldés…"
                        : isSales
                          ? picked ? `Igénylés — ${picked.credits} kredit` : "Igénylés"
                          : picked ? `Megrendelés — ${formatHuf(picked.priceHuf)}` : "Megrendelés"}
                    </button>
                  </>
                )}

                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

                {/* A sales-nek nincs mit visszalépnie: neki nincs árlistás nézet. */}
                {!isSales && (
                  <button type="button" onClick={() => { setMode("packages"); setError(null); }}
                    className="mt-3 w-full text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    ← Vissza a csomagokhoz
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
