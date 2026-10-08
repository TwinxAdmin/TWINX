// OfficeRequestFlow — „Irodai fiók igénylése" oldal tartalma:
//   igénylő űrlap → elbírálás alatt → jóváhagyva: iroda megnyitása (név + csatlakozási kód).
//   Több irodai fiók is igényelhető: ha a legutóbbi jóváhagyottból már nyitott irodát, újra kitölthető.
"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  validateOfficeRequest,
  NOTE_MAX,
  OFFICE_NAME_MAX,
  type MyOffice,
  type OfficeRequestInput,
  type OfficeRequestRow,
} from "@/lib/office";

const EMPTY: OfficeRequestInput = { officeName: "", teamSize: "", phone: "", note: "" };

export default function OfficeRequestFlow() {
  const [req, setReq] = useState<OfficeRequestRow | null>(null);
  const [requestUsed, setRequestUsed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState<OfficeRequestInput>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof OfficeRequestInput, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [newRequest, setNewRequest] = useState(false);

  useEffect(() => {
    fetch("/api/office/request")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setLoadError(d.error); return; }
        setReq(d.request ?? null); setRequestUsed(!!d.requestUsed);
      })
      .catch(() => setLoadError("Nem sikerült betölteni az állapotot."))
      .finally(() => setLoaded(true));
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
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.status === 422) { setErrors(data.errors ?? {}); return; }
      if (!res.ok) { setSubmitError(data.error ?? "Nem sikerült elküldeni."); return; }
      setReq(data.request); setRequestUsed(false); setNewRequest(false); setForm(EMPTY);
    } catch {
      setSubmitError("Hálózati hiba — próbáld újra.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!loaded) return <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>;
  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;

  const showForm = !req || (req.status === "rejected" && newRequest) || (req.status === "approved" && requestUsed);

  return (
    <section className="twx-card p-6">
      {req?.status === "approved" && !requestUsed ? (
        <OpenOffice req={req} onOpened={() => { window.location.href = "/dashboard/iroda"; }} />
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
          Az irodai fiókod jóvá lett hagyva.
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

function OpenOffice({ req, onOpened }: { req: OfficeRequestRow; onOpened: (o: MyOffice) => void }) {
  const [name, setName] = useState(req.office_name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function open(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) { setError("Add meg az iroda nevét."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/office", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.errors?.name ?? data.error ?? "Nem sikerült megnyitni."); return; }
      onOpened(data.office);
    } catch {
      setError("Hálózati hiba — próbáld újra.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={open} className="space-y-4" noValidate>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#15803d" }}>Jóváhagyva</p>
        <h2 className="mt-1 font-display text-xl font-semibold">Nyisd meg az irodai fiókot</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          Megnyitás után kapsz egy csatlakozási kódot, amivel a kollégáid azonnal csatlakozhatnak.
        </p>
      </div>
      <Field label="Iroda neve" error={error ?? undefined}>
        <input className="twx-input" value={name} maxLength={OFFICE_NAME_MAX} onChange={(e) => setName(e.target.value)} />
      </Field>
      <button type="submit" className="twx-btn" disabled={busy}>{busy ? "Megnyitás…" : "Iroda megnyitása"}</button>
    </form>
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
