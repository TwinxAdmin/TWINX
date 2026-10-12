// OfficeRequestFlow — „Irodai fiók igénylése" oldal tartalma.
//   1. lépés: a FORMA kiválasztása (két azonos méretű kártya): Iroda vezetővel / Közös munkatér.
//   • Iroda vezetővel: igénylő űrlap → elbírálás alatt → jóváhagyva: iroda megnyitása (név + kód).
//     Több irodai fiók is igényelhető: ha a legutóbbi jóváhagyottból már nyitott irodát, újra kitölthető.
//   • Közös munkatér: név + létszám (2–5) → AZONNAL létrejön (POST /api/office, kind: "team"), jóváhagyás nélkül.
"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  validateOfficeRequest,
  validateTeamCreate,
  NOTE_MAX,
  OFFICE_NAME_MAX,
  TEAM_MEMBERS_MAX,
  TEAM_MEMBERS_MIN,
  type MyOffice,
  type OfficeKind,
  type OfficeRequestInput,
  type OfficeRequestRow,
  type TeamCreateInput,
} from "@/lib/office";

const TEAL = "#2F7F86";

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
  // a választott forma; ha már van vezetős igénylése, azt mutatjuk elsőre
  const [kind, setKind] = useState<OfficeKind | null>(null);

  useEffect(() => {
    fetch("/api/office/request")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setLoadError(d.error); return; }
        setReq(d.request ?? null); setRequestUsed(!!d.requestUsed);
        // a „Mi az irodai fiók?" oldalról érkezve (?forma=office|team) a forma előre ki van választva
        const forma = new URLSearchParams(window.location.search).get("forma");
        if (forma === "team" || forma === "office") setKind(forma);
        else if (d.request) setKind("office");
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
    <div className="space-y-4">
    <KindChooser kind={kind} onPick={setKind} />
    {kind === null ? (
      <p className="rounded-2xl px-5 py-4 text-sm" style={{ background: "var(--twx-cream-card)", border: "1px dashed var(--twx-line)", color: "var(--twx-ink-muted)" }}>
        Válaszd ki fent, hogyan dolgoztok együtt — utána megjelennek a szükséges adatok.
      </p>
    ) : kind === "team" ? (
      <TeamForm />
    ) : (
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
    )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Forma-választó — két AZONOS méretű kártya; a választás csak a keretet és a pöttyöt váltja
// ---------------------------------------------------------------------------
const KINDS: { kind: OfficeKind; title: string; when: string; text: string; points: string[]; accent: string; soft: string }[] = [
  {
    kind: "office", title: "Iroda vezetővel", when: "jóváhagyással", accent: "#C2512F", soft: "#FBE1D6",
    text: "Egy közös irodai keret: a vezető tölti fel és osztja ki a kollégáknak, ők abból dolgoznak.",
    points: ["Létrehozó + vezetők + kollégák", "Közös irodai egyenleg, keretkiosztás", "Kredithasználat kollégánként és modulonként", "Felhívunk, egyeztetünk, jóváhagyjuk"],
  },
  {
    kind: "team", title: "Közös munkatér", when: "⚡ azonnal", accent: TEAL, soft: "#DCEFF0",
    text: "Egyenrangú társak, akik együtt dolgoznak — mindenki a saját kreditjéből, közös mappákkal.",
    points: ["Mindenki „Társ” — nincs vezető", "Saját kredit, de adhatsz a társaidnak", "Közös mappák, közös szerkesztés", "Azonnal létrejön, nincs jóváhagyás"],
  },
];

function KindChooser({ kind, onPick }: { kind: OfficeKind | null; onPick: (k: OfficeKind) => void }) {
  return (
    <section className="twx-card p-6">
      <h2 className="font-display text-xl font-semibold">Hogyan dolgoztok együtt?</h2>
      <p className="mt-1 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        A forma a fiók része — később nem kell külön beállítani.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Az irodai fiók formája">
        {KINDS.map((k) => {
          const on = kind === k.kind;
          return (
            <button key={k.kind} type="button" role="radio" aria-checked={on} onClick={() => onPick(k.kind)}
              className="relative flex flex-col gap-2.5 rounded-2xl p-[18px] text-left transition-shadow sm:h-[296px]"
              style={{
                background: "#fff",
                border: `1.5px solid ${on ? "#F08A68" : "#E1D6C9"}`,
                boxShadow: on ? "0 0 0 4px rgba(240,138,104,0.16)" : "none",
              }}>
              <span aria-hidden className="absolute right-4 top-4 h-5 w-5 rounded-full"
                style={{ border: `2px solid ${on ? "#F08A68" : "#D3C5B6"}`, background: on ? "radial-gradient(circle, #F08A68 45%, #fff 50%)" : "#fff" }} />
              <span className="absolute right-12 top-[18px] rounded-full px-2 py-[3px] text-[11px] font-bold"
                style={{ background: k.soft, color: k.accent }}>{k.when}</span>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: k.soft, color: k.accent }}>
                {k.kind === "office" ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-6h6v6" /></svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="8" cy="8" r="3.2" /><circle cx="16" cy="8" r="3.2" /><path d="M2.5 20c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5" /><path d="M12.5 15.6c.9-.4 2-.6 3.5-.6 2.6 0 4.9 1.8 5.5 5" /></svg>
                )}
              </span>
              <span className="font-display text-[17px] font-bold">{k.title}</span>
              <span className="text-[13px] leading-snug" style={{ color: "var(--twx-ink-muted)" }}>{k.text}</span>
              <ul className="mt-auto flex flex-col gap-1.5">
                {k.points.map((p) => (
                  <li key={p} className="flex gap-2 text-xs leading-snug">
                    <span aria-hidden className="font-extrabold" style={{ color: "#1F7A4D" }}>✓</span>{p}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Közös munkatér létrehozása — név + létszám; azonnal létrejön
// ---------------------------------------------------------------------------
function TeamForm() {
  const [form, setForm] = useState<TeamCreateInput>({ name: "", teamSize: "2" });
  const [errors, setErrors] = useState<Partial<Record<keyof TeamCreateInput, string>>>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const set = <K extends keyof TeamCreateInput>(k: K, v: TeamCreateInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const check = validateTeamCreate(form as Record<string, unknown>);
    if (!check.valid) { setErrors(check.errors); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/office", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "team", ...form }),
      });
      const data = await res.json();
      if (res.status === 422) { setErrors(data.errors ?? {}); return; }
      if (!res.ok) { setSubmitError(data.error ?? "Nem sikerült létrehozni."); return; }
      window.location.href = "/dashboard/iroda";
    } catch {
      setSubmitError("Hálózati hiba — próbáld újra.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="twx-card space-y-5 p-6" noValidate>
      <div>
        <h2 className="font-display text-xl font-semibold">Közös munkatér létrehozása</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          Add meg a nevét és hogy hányan lesztek. Telefonszám nem kell, és nem kell jóváhagyásra várni.
        </p>
      </div>

      <Field label="Munkatér neve" error={errors.name}>
        <input className="twx-input" value={form.name} maxLength={OFFICE_NAME_MAX}
          onChange={(e) => set("name", e.target.value)} placeholder="pl. Kovács & Szabó — közös projektek" />
      </Field>

      <Field label={`Hányan lesztek? (${TEAM_MEMBERS_MIN}–${TEAM_MEMBERS_MAX} társ)`} error={errors.teamSize}>
        <input className="twx-input sm:max-w-[200px]" type="number" min={TEAM_MEMBERS_MIN} max={TEAM_MEMBERS_MAX} inputMode="numeric"
          value={form.teamSize} onChange={(e) => set("teamSize", e.target.value)} />
      </Field>

      <p className="rounded-2xl p-4 text-sm" style={{ background: "var(--twx-cream)", border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}>
        <strong style={{ color: "var(--twx-ink)" }}>A munkák mindig a készítőjüknél maradnak.</strong>{" "}
        A társak csak azt látják, amit valaki közös mappába tesz. Mindenki a saját kreditjéből dolgozik, és bárki{" "}
        <strong style={{ color: "var(--twx-ink)" }}>adhat</strong> kreditet egy társának — visszavenni nem lehet.
        A munkatér egyetlen, állandó csatlakozási kódot kap.
      </p>

      <p className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold" style={{ background: "#DCEFF0", color: "#1F5F65" }}>
        <span aria-hidden>⚡</span> A közös munkatér azonnal létrejön — utána rögtön megkapod a csatlakozási kódot.
      </p>

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}
      <button type="submit" className="twx-btn" disabled={busy} style={{ background: TEAL, color: "#fff" }}>
        {busy ? "Létrehozás…" : "Közös munkatér létrehozása"}
      </button>
    </form>
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
