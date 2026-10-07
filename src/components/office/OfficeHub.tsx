// OfficeHub — az „Irodai fiók" oldal tartalma:
//   • rövid magyarázó (mi az irodai TWINX, hogyan működik)
//   • fül 1: „Iroda nyitása" — igénylés a TWINX-től (vezetőknek), állapotkijelzéssel
//   • fül 2: „Csatlakozás kóddal" — alkalmazottaknak (a beváltás a következő lépésben jön)
"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  validateOfficeRequest,
  NOTE_MAX,
  OFFICE_NAME_MAX,
  type OfficeRequestInput,
  type OfficeRequestRow,
} from "@/lib/office";

type Tab = "open" | "join";
type State = { membership: { office_id: string; role: string } | null; request: OfficeRequestRow | null };

const EMPTY: OfficeRequestInput = { officeName: "", teamSize: "", phone: "", note: "" };

export default function OfficeHub() {
  const [tab, setTab] = useState<Tab>("join");
  const [state, setState] = useState<State | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState<OfficeRequestInput>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof OfficeRequestInput, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [newRequest, setNewRequest] = useState(false); // elutasítás után új igénylés

  useEffect(() => {
    fetch("/api/office/request")
      .then((r) => r.json())
      .then((d) => (d.error ? setLoadError(d.error) : setState({ membership: d.membership, request: d.request })))
      .catch(() => setLoadError("Nem sikerült betölteni az állapotot."));
  }, []);

  const set = <K extends keyof OfficeRequestInput>(k: K, v: OfficeRequestInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const payload = { ...form };
    const check = validateOfficeRequest(payload as Record<string, unknown>);
    if (!check.valid) { setErrors(check.errors); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/office/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.status === 422) { setErrors(data.errors ?? {}); return; }
      if (!res.ok) { setSubmitError(data.error ?? "Nem sikerült elküldeni."); return; }
      setState((s) => ({ membership: s?.membership ?? null, request: data.request }));
      setNewRequest(false);
      setForm(EMPTY);
    } catch {
      setSubmitError("Hálózati hiba — próbáld újra.");
    } finally {
      setSubmitting(false);
    }
  }

  const req = state?.request ?? null;
  const showForm = state && !state.membership && (!req || (req.status === "rejected" && newRequest));

  return (
    <div className="space-y-6">
      {/* Rövid magyarázó */}
      <section className="twx-card p-6">
        <h2 className="font-display text-xl font-semibold">Mi az irodai TWINX fiók?</h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>
          Közös irodai kredit-egyenleg. Az irodai fiók létrehozója vásárolja és osztja ki a krediteket
          a kollégáknak, és jogosultságot is adhat másoknak.
        </p>
      </section>

      {/* Fülek */}
      <div className="flex gap-2" role="tablist">
        {([["join", "Csatlakozás kóddal"], ["open", "Irodai fiók létrehozás"]] as [Tab, string][]).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className="rounded-full px-4 py-2 text-sm font-medium transition-colors"
            style={tab === k
              ? { background: "var(--twx-ink)", color: "var(--twx-cream)" }
              : { border: "1px solid var(--twx-line)", color: "var(--twx-ink)" }}>
            {label}
          </button>
        ))}
      </div>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}
      {!state && !loadError && <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>}

      {state && tab === "open" && (
        <section className="twx-card p-6">
          {state.membership ? (
            <p className="text-sm">
              Már tagja vagy egy irodai fióknak{state.membership.role === "owner" ? " — te vagy a vezetője" : ""}.
              Az iroda kezelése hamarosan itt lesz elérhető.
            </p>
          ) : req && !showForm ? (
            <RequestStatus req={req} onNew={() => setNewRequest(true)} />
          ) : (
            <form onSubmit={submit} className="space-y-5" noValidate>
              <div>
                <h2 className="font-display text-xl font-semibold">Irodai fiók igénylése</h2>
                <p className="mt-1 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                  Küldd el az alábbi adatokat. Felhívunk, egyeztetünk, és jóváhagyás után megnyithatod az irodát.
                </p>
              </div>

              <Field label="Iroda neve" error={errors.officeName}>
                <input className="twx-input" value={form.officeName} maxLength={OFFICE_NAME_MAX}
                  onChange={(e) => set("officeName", e.target.value)} placeholder="pl. Belvárosi Ingatlaniroda" />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Hányan használnátok?" error={errors.teamSize}>
                  <input className="twx-input" type="number" min={1} max={500} inputMode="numeric"
                    value={form.teamSize} onChange={(e) => set("teamSize", e.target.value)} placeholder="pl. 6" />
                </Field>
                <Field label="Telefonszám" error={errors.phone}>
                  <input className="twx-input" type="tel" value={form.phone}
                    onChange={(e) => set("phone", e.target.value)} placeholder="+36 30 123 4567" />
                </Field>
              </div>

              <p className="rounded-2xl p-4 text-sm" style={{ background: "var(--twx-cream)", border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}>
                <strong style={{ color: "var(--twx-ink)" }}>A munkák mindig a készítőjüknél maradnak.</strong>{" "}
                Másik kolléga — az irodai fiók létrehozója is — csak azt látja, amit a készítője közös irodai mappába tesz.
                A létrehozó a kreditfelhasználást látja: ki, melyik modulban, mennyi kreditet használt.
              </p>

              <Field label="Megjegyzés (nem kötelező)" error={errors.note}>
                <textarea className="twx-input min-h-[90px]" maxLength={NOTE_MAX} value={form.note ?? ""}
                  onChange={(e) => set("note", e.target.value)} placeholder="Bármi, amit érdemes tudnunk az irodátokról." />
              </Field>

              {submitError && <p className="text-sm text-red-600">{submitError}</p>}
              <button type="submit" className="twx-btn" disabled={submitting}>
                {submitting ? "Küldés…" : "Igénylés elküldése"}
              </button>
            </form>
          )}
        </section>
      )}

      {state && tab === "join" && (
        <section className="twx-card space-y-4 p-6">
          <div>
            <h2 className="font-display text-xl font-semibold">Csatlakozás egy irodához</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
              A csatlakozási kódot az irodavezetődtől kapod. Beírás után azonnal látod az iroda moduljait és a saját keretedet.
            </p>
          </div>
          {state.membership ? (
            <p className="text-sm">Már tagja vagy egy irodai fióknak.</p>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input className="twx-input sm:max-w-xs" placeholder="pl. TWX-8K4P" disabled aria-disabled />
                <button type="button" className="twx-btn" disabled>Csatlakozás</button>
              </div>
              <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                A kóddal csatlakozás a következő frissítésben kapcsol be.
              </p>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function RequestStatus({ req, onNew }: { req: OfficeRequestRow; onNew: () => void }) {
  const date = new Date(req.created_at).toLocaleDateString("hu-HU");
  if (req.status === "pending") {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--twx-coral)" }}>Elbírálás alatt</p>
        <h2 className="font-display text-xl font-semibold">{req.office_name}</h2>
        <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          Igénylésedet {date}-án megkaptuk. Hamarosan felhívunk a megadott számon ({req.phone}).
        </p>
      </div>
    );
  }
  if (req.status === "approved") {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#15803d" }}>Jóváhagyva</p>
        <h2 className="font-display text-xl font-semibold">{req.office_name}</h2>
        <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          Az irodai fiókod jóvá lett hagyva. Az iroda megnyitása hamarosan itt lesz elérhető.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-red-600">Nem hagytuk jóvá</p>
      <h2 className="font-display text-xl font-semibold">{req.office_name}</h2>
      {req.decision_note && <p className="text-sm">{req.decision_note}</p>}
      <button type="button" className="twx-btn-outline" onClick={onNew}>Új igénylés</button>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
