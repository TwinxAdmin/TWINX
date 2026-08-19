// Kredit-kérés a Beállításokban.
//
// Két ág, szerepkör szerint:
//   • sales  — belső keretet kér, INGYEN kapja, nincs számlázás.
//   • user   — fix csomagot választ, amiről SZÁMLÁT állítunk ki. A kredit
//              a befizetés után érkezik meg. Számlázási adat nélkül nem tud
//              kérést beadni: felugró ablakban rögtön ott a kitöltő űrlap.
//
// Az árakat a lib/packages.ts adja — ugyanaz a forrás, amit majd a Stripe
// Checkout is használni fog.
"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { showToast } from "@/components/Toast";
import BillingForm from "@/components/BillingForm";
import { CREDIT_PACKAGES } from "@/lib/packages";
import { formatHuf, isBillingComplete, type BillingInfo } from "@/lib/billing";

type RequestRow = {
  id: string;
  amount: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  decision_note: string | null;
  granted_amount: number | null;
  decided_at: string | null;
  created_at: string;
  billing_kind?: "free" | "invoice" | null;
  invoice_status?: "none" | "to_issue" | "issued" | "paid" | null;
  invoice_number?: string | null;
  net_huf?: number | null;
};

const QUICK = [10, 25, 50, 100];

const STATUS: Record<RequestRow["status"], { label: string; color: string; bg: string }> = {
  pending: { label: "Elbírálásra vár", color: "#7a5a12", bg: "#fff8ec" },
  approved: { label: "Jóváhagyva", color: "#2e7d52", bg: "#f2f9f5" },
  rejected: { label: "Elutasítva", color: "#c0392b", bg: "#fdecea" },
};

// A számlás ág beszédesebb állapota — a partner lássa, hol tart a folyamat.
function invoiceLabel(it: RequestRow): string | null {
  if (it.billing_kind !== "invoice") return null;
  if (it.invoice_status === "to_issue") return "Számla készül";
  if (it.invoice_status === "issued") return "Számla kiállítva — befizetésre vár";
  if (it.invoice_status === "paid") return "Befizetve";
  return null;
}

export default function CreditRequestPanel({
  balance,
  billing,
  needsBilling,
}: {
  balance: number;
  billing: Partial<BillingInfo> | null;
  needsBilling: boolean; // true = sima felhasználó (számlázunk), false = sales
}) {
  const [packageId, setPackageId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<RequestRow[]>([]);
  const [bill, setBill] = useState<Partial<BillingInfo> | null>(billing);
  const [gateOpen, setGateOpen] = useState(false);

  const billingOk = !needsBilling || isBillingComplete(bill);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/credit-requests");
      if (!res.ok) return;
      const d = await res.json();
      setItems((d.items ?? []) as RequestRow[]);
    } catch { /* lista nélkül is használható */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const pending = items.find((i) => i.status === "pending");
  const selected = CREDIT_PACKAGES.find((p) => p.id === packageId) ?? null;

  async function submit() {
    // Számlás ágon a csomag kötelező (ebből lesz a számla összege).
    if (needsBilling && !selected) {
      showToast("Válassz csomagot.", "error");
      return;
    }
    if (needsBilling && !billingOk) {
      setGateOpen(true);
      return;
    }
    const amt = needsBilling ? (selected as { credits: number }).credits : parseInt(amount, 10);
    if (!Number.isInteger(amt) || amt <= 0) {
      showToast("Add meg, hány kreditre van szükséged.", "error");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/credit-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          packageId: selected?.id,
          reason: reason.trim() || undefined,
        }),
      });
      const d = await res.json();
      // 428 = a szerver szerint hiányos a számlázási adat → nyissuk a kaput.
      if (res.status === 428 || d.needsBilling) {
        setGateOpen(true);
        return;
      }
      if (!res.ok) throw new Error(d.error || "A kérés beadása nem sikerült.");
      showToast(
        d.emailed
          ? "Kérés elküldve — az adminok értesítést kaptak."
          : "Kérés rögzítve. (Az értesítő e-mail nem ment ki, szólj az adminnak.)",
        d.emailed ? "success" : "error"
      );
      setAmount("");
      setPackageId("");
      setReason("");
      void load();
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="twx-card space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold">{needsBilling ? "Kredit vásárlás" : "Keret igénylése"}</h2>
        <p className="mt-0.5 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          Jelenlegi egyenleged: <strong>{balance}</strong> kredit.{" "}
          {needsBilling
            ? "Válassz csomagot, mi kiállítjuk a számlát, és a befizetés után jóváírjuk a kreditet."
            : "Ha elfogyott, itt kérhetsz újat — az adminok értesítést kapnak, és jóváhagyás után azonnal megérkezik."}
        </p>
      </div>

      {/* Átmeneti időszak — legyen világos, hogy ez nem így marad. */}
      {needsBilling && (
        <p className="rounded-xl px-3 py-2 text-xs"
          style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
          A bankkártyás vásárlás hamarosan elindul — addig a kredit igénylés utáni
          átutalással érkezik, ezért a jóváírásra várni kell egy kicsit.
        </p>
      )}

      {pending ? (
        <div className="rounded-xl p-3 text-sm"
          style={{ background: STATUS.pending.bg, border: `1px solid ${STATUS.pending.color}33` }}>
          <p className="font-medium" style={{ color: STATUS.pending.color }}>
            {invoiceLabel(pending) ?? `Van egy elbírálásra váró kérésed: ${pending.amount} kredit`}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            {pending.amount} kredit
            {pending.net_huf ? ` · ${formatHuf(pending.net_huf)} + áfa` : ""}
            {pending.invoice_number ? ` · számlaszám: ${pending.invoice_number}` : ""}
            {" · beadva: "}{new Date(pending.created_at).toLocaleString("hu-HU")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {needsBilling ? (
            <div>
              <span className="mb-1.5 block text-xs font-medium">Válassz csomagot</span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {CREDIT_PACKAGES.map((p) => {
                  const on = packageId === p.id;
                  return (
                    <button key={p.id} type="button" onClick={() => setPackageId(p.id)}
                      className="rounded-xl p-3 text-left transition"
                      style={on
                        ? { border: "2px solid var(--twx-coral)", background: "var(--twx-coral-soft)" }
                        : { border: "1px solid var(--twx-line)", background: "#fff" }}>
                      <span className="block text-lg font-bold" style={{ color: on ? "var(--twx-coral)" : undefined }}>
                        {p.credits} kredit
                      </span>
                      <span className="block text-sm font-semibold">{formatHuf(p.priceHuf)} + áfa</span>
                      <span className="block text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                        {Math.round(p.priceHuf / p.credits)} Ft / kredit
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <span className="mb-1.5 block text-xs font-medium">Mennyi kreditre van szükséged?</span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK.map((q) => (
                  <button key={q} type="button" onClick={() => setAmount(String(q))}
                    className="rounded-lg px-3 py-1.5 text-sm font-semibold transition"
                    style={amount === String(q)
                      ? { background: "var(--twx-coral)", color: "#fff" }
                      : { border: "1px solid var(--twx-line)", background: "#fff" }}>
                    {q}
                  </button>
                ))}
                <input type="number" min={1} value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="egyéb" className="twx-input w-24 text-right text-sm" />
              </div>
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-medium">
              {needsBilling ? "Megjegyzés a számlához (nem kötelező)" : "Mire kell? (nem kötelező)"}
            </span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
              placeholder={needsBilling ? "pl. megrendelésszám, költséghely" : "pl. 3 ügyfélbemutató a jövő héten"}
              className="twx-input w-full text-sm" />
          </label>

          {/* A hiányzó számlázási adat nem tiltja le a gombot — inkább elmagyarázzuk,
              és egy kattintásra ott a kitöltő űrlap. */}
          {needsBilling && !billingOk && (
            <p className="text-xs" style={{ color: "#c0392b" }}>
              A megrendeléshez számlázási adat szükséges — a gomb megnyomásakor megadhatod.
            </p>
          )}

          <button type="button" onClick={submit}
            disabled={busy || (needsBilling ? !selected : !amount.trim())}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--twx-coral)" }}>
            {busy
              ? "Küldés…"
              : needsBilling
                ? selected ? `Megrendelés — ${formatHuf(selected.priceHuf)} + áfa` : "Megrendelés"
                : "Kérés elküldése"}
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold">Korábbi kéréseim</p>
          <div className="space-y-1.5">
            {items.map((it) => {
              const s = STATUS[it.status];
              const inv = it.status === "pending" ? invoiceLabel(it) : null;
              return (
                <div key={it.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg px-3 py-2 text-xs"
                  style={{ border: "1px solid var(--twx-line)" }}>
                  <span>
                    <strong>{it.amount} kredit</strong>
                    {it.net_huf ? (
                      <span style={{ color: "var(--twx-ink-muted)" }}>{" · "}{formatHuf(it.net_huf)} + áfa</span>
                    ) : null}
                    {it.granted_amount != null && it.granted_amount !== it.amount && (
                      <> → jóváírva: <strong>{it.granted_amount}</strong></>
                    )}
                    <span style={{ color: "var(--twx-ink-muted)" }}>
                      {" · "}{new Date(it.created_at).toLocaleDateString("hu-HU")}
                    </span>
                  </span>
                  <span className="rounded-full px-2 py-0.5 font-medium"
                    style={{ background: s.bg, color: s.color }}>
                    {inv ?? s.label}
                  </span>
                  {it.decision_note && (
                    <span className="w-full" style={{ color: "var(--twx-ink-muted)" }}>{it.decision_note}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Számlaadat-kapu — a megrendelés előtt egyszer kell kitölteni. */}
      <AnimatePresence>
        {gateOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
            style={{ background: "rgba(20,12,8,0.55)" }}
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
              className="my-8 w-full max-w-lg rounded-2xl p-5"
              style={{ background: "var(--twx-cream)" }}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">Számlázási adatok</h3>
                  <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    A kredit megrendeléséhez számlát állítunk ki, ehhez kellenek az adataid.
                    Egyszer kell megadni, később bármikor módosíthatod a Beállításokban.
                  </p>
                </div>
                <button type="button" onClick={() => setGateOpen(false)}
                  aria-label="Bezárás"
                  className="shrink-0 rounded-lg px-2 py-1 text-sm"
                  style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>✕</button>
              </div>

              <p className="mb-4 rounded-xl px-3 py-2 text-xs"
                style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
                Ez egy induló, átmeneti időszak: a bankkártyás fizetés hamarosan
                automatikus lesz, addig számlát küldünk, és a befizetés után írjuk
                jóvá a kreditet — így erre most még várni kell egy kicsit.
              </p>

              <BillingForm
                initial={bill}
                embedded
                onSaved={(b) => { setBill(b); setGateOpen(false); }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
