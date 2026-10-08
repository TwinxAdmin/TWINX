// OfficeHub — az „Irodai fiók" oldal tartalma:
//   • rövid magyarázó (mi az irodai TWINX, hogyan működik)
//   • fül 1: „Iroda nyitása" — igénylés a TWINX-től (vezetőknek), állapotkijelzéssel
//   • fül 1: „Csatlakozás kóddal" — kód beírása → azonnali tagság (0 kerettel)
//   • jóváhagyott igénylés után: iroda megnyitása (név + generált csatlakozási kód)
//   • ha már tag: a saját iroda panelje (OfficePanel) a fülek helyett
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
import OfficePanel from "@/components/office/OfficePanel";

type Tab = "open" | "join";
type State = {
  office: MyOffice | null;
  request: OfficeRequestRow | null;
  requestUsed?: boolean;
  offices?: { id: string; name: string; role: "owner" | "member" }[];
};

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
  const [showMore, setShowMore] = useState(false);     // már tag: másik iroda (csatlakozás / új igénylés)
  const [switching, setSwitching] = useState(false);

  /** Másik irodára váltás (ez lesz a kiválasztott a kredit-sávon is), majd újratöltés. */
  async function switchOffice(id: string) {
    setSwitching(true);
    const res = await fetch("/api/office/mode", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ officeId: id }),
    }).catch(() => null);
    if (res?.ok) window.location.reload();
    else setSwitching(false);
  }

  useEffect(() => {
    Promise.all([fetch("/api/office/request").then((r) => r.json()), fetch("/api/office").then((r) => r.json())])
      .then(([rq, of]) => {
        if (rq.error || of.error) { setLoadError(rq.error || of.error); return; }
        setState({ office: of.office ?? null, request: rq.request ?? null, requestUsed: !!rq.requestUsed, offices: of.offices ?? [] });
        // Jóváhagyott, de még meg nem nyitott iroda: rögtön a megnyitás fület mutatjuk.
        if (rq.request?.status === "approved" && !rq.requestUsed) { setTab("open"); if (of.office) setShowMore(true); }
      })
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
      setState((s) => ({ ...(s ?? { office: null }), request: data.request, requestUsed: false }));
      setNewRequest(false);
      setForm(EMPTY);
    } catch {
      setSubmitError("Hálózati hiba — próbáld újra.");
    } finally {
      setSubmitting(false);
    }
  }

  const req = state?.request ?? null;
  const showForm = state && (!req || (req.status === "rejected" && newRequest) || (req.status === "approved" && state.requestUsed));

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

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}
      {!state && !loadError && <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>}

      {/* Több iroda: váltó */}
      {state?.office && (state.offices?.length ?? 0) > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Irodáid:</span>
          {state.offices!.map((o) => {
            const on = o.id === state.office!.id;
            return (
              <button key={o.id} type="button" disabled={switching || on} onClick={() => switchOffice(o.id)}
                className="max-w-[220px] truncate rounded-full px-4 py-1.5 text-sm font-medium"
                style={on ? { background: "var(--twx-ink)", color: "var(--twx-cream)" } : { border: "1px solid var(--twx-line)" }}>
                {o.name}{o.role === "owner" ? " ★" : ""}
              </button>
            );
          })}
        </div>
      )}

      {/* Már tag: a kiválasztott iroda panelje */}
      {state?.office && <OfficePanel key={state.office.id} office={state.office} />}

      {/* Már tag: másik iroda — csatlakozás kóddal vagy új irodai fiók igénylése */}
      {state?.office && (
        <button type="button" className="twx-btn-outline" onClick={() => setShowMore((v) => !v)}>
          {showMore ? "Bezárás" : "+ Másik irodai fiók (csatlakozás vagy új létrehozása)"}
        </button>
      )}

      {/* Fülek: még nem tag, vagy másik irodát nyit / csatlakozik */}
      {state && (!state.office || showMore) && (
      <>
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

      {tab === "open" && (
        <section className="twx-card p-6">
          {req?.status === "approved" && !state.requestUsed ? (
            <OpenOffice req={req} onOpened={() => window.location.reload()} />
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

      {tab === "join" && (
        <section className="twx-card space-y-4 p-6">
          <div>
            <h2 className="font-display text-xl font-semibold">Csatlakozás egy irodához</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
              A csatlakozási kódot az irodai fiók létrehozójától kapod. Beírás után azonnal csatlakozol, és látod a saját irodai keretedet.
            </p>
          </div>
          <JoinByCode onJoined={() => window.location.reload()} />
        </section>
      )}
      </>
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

function JoinByCode({ onJoined }: { onJoined: (o: MyOffice) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function join(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.replace(/[^a-z0-9]/gi, "").length < 6) { setError("Írd be a teljes kódot (pl. TWX-8K4P9R)."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/office/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.errors?.code ?? data.error ?? "Nem sikerült csatlakozni."); return; }
      onJoined(data.office);
    } catch {
      setError("Hálózati hiba — próbáld újra.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={join} className="space-y-2" noValidate>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input className="twx-input font-mono uppercase tracking-widest sm:max-w-xs" placeholder="TWX-8K4P9R"
          value={code} maxLength={14} autoComplete="off" spellCheck={false}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }} aria-label="Csatlakozási kód" />
        <button type="submit" className="twx-btn" disabled={busy}>{busy ? "Csatlakozás…" : "Csatlakozás"}</button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
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
