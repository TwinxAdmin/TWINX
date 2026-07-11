// Admin prompt-szerkesztő (kliens). A zárolt adat-blokk csak olvasható előnézet;
// a szegmensekben változó/behelyettesítő token nem engedélyezett (a mentést a
// szerver is validálja). Minden mentés új verzió; a korábbiak visszaállíthatók.
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SegDef = { id: string; label: string; hint?: string };
type Version = {
  id: string;
  version: number;
  name: string | null;
  is_active: boolean;
  created_at: string;
  segments: Record<string, string>;
};

// Kliensoldali gyors ellenőrzés (a szerver újravalidál).
const TOKEN_RE = /\{\{?\s*[\w.]+\s*\}?\}|\$\{[^}]*\}/;

export default function PromptEditor({
  moduleKey,
  moduleLabel,
  segmentDefs,
  dataBlockPreview,
  dataBlockAfter,
  activeSegments,
  usingDefault,
  versions,
}: {
  moduleKey: string;
  moduleLabel: string;
  segmentDefs: SegDef[];
  dataBlockPreview: string;
  dataBlockAfter: string;
  activeSegments: Record<string, string>;
  usingDefault: boolean;
  versions: Version[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({ ...activeSegments });
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [openVersion, setOpenVersion] = useState<string | null>(null);

  const tokenErrors = useMemo(() => {
    const e: Record<string, boolean> = {};
    for (const s of segmentDefs) e[s.id] = TOKEN_RE.test((values[s.id] ?? ""));
    return e;
  }, [values, segmentDefs]);

  const hasTokenError = Object.values(tokenErrors).some(Boolean);
  const dirty = segmentDefs.some((s) => (values[s.id] ?? "") !== (activeSegments[s.id] ?? ""));

  async function post(payload: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: moduleKey, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Hiba történt.");
        return false;
      }
      return true;
    } catch {
      setErr("Hálózati hiba.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    if (hasTokenError) {
      setErr("A szövegben változó/behelyettesítő nem szerepelhet. A változók helye zárolt.");
      return;
    }
    const ok = await post({ action: "save", segments: values, name });
    if (ok) {
      setMsg("Elmentve új verzióként és aktiválva.");
      setName("");
      router.refresh();
    }
  }

  async function onActivate(id: string) {
    const ok = await post({ action: "activate", id });
    if (ok) {
      setMsg("Verzió aktiválva.");
      router.refresh();
    }
  }

  async function onReset() {
    const ok = await post({ action: "reset" });
    if (ok) {
      setMsg("Visszaállítva a beépített (alapértelmezett) promptra.");
      router.refresh();
    }
  }

  // Szegmensek + a zárolt blokk a megfelelő helyre beszúrva.
  const rendered: React.ReactNode[] = [];
  for (const s of segmentDefs) {
    rendered.push(
      <div key={s.id}>
        <label htmlFor={`seg-${s.id}`} className="block text-sm font-medium">
          {s.label}
        </label>
        {s.hint && (
          <p className="mt-0.5 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{s.hint}</p>
        )}
        <textarea
          id={`seg-${s.id}`}
          value={values[s.id] ?? ""}
          onChange={(e) => setValues((p) => ({ ...p, [s.id]: e.target.value }))}
          rows={s.id === "task" ? 12 : 5}
          className="twx-input mt-1 w-full font-mono text-sm"
          style={tokenErrors[s.id] ? { borderColor: "#dc2626" } : undefined}
        />
        {tokenErrors[s.id] && (
          <p className="mt-1 text-xs text-red-600">
            Változó/behelyettesítő ({"{...}"}) nem engedélyezett — a változók helye zárolt.
          </p>
        )}
      </div>
    );
    if (s.id === dataBlockAfter) {
      rendered.push(
        <div key="__datablock" className="rounded-xl p-4" style={{ background: "var(--twx-coral-soft)", border: "1px dashed var(--twx-coral)" }}>
          <p className="text-xs font-semibold" style={{ color: "#7a2e17" }}>
            🔒 Zárolt adat-blokk — a rendszer ide illeszti be a felhasználói adatokat (nem szerkeszthető)
          </p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs" style={{ color: "var(--twx-ink)" }}>
            {dataBlockPreview}
          </pre>
        </div>
      );
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-xl font-medium">{moduleLabel}</h2>
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={
            usingDefault
              ? { background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }
              : { background: "var(--twx-coral)", color: "#1c1005" }
          }
        >
          {usingDefault ? "Beépített alapértelmezett" : "Testreszabott verzió aktív"}
        </span>
      </div>

      {rendered}

      <div className="flex flex-wrap items-end gap-3">
        <div className="grow">
          <label htmlFor="pname" className="block text-sm">Verzió megnevezése (opcionális)</label>
          <input
            id="pname"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="pl. óvatosabb hangnem"
            className="twx-input mt-1"
          />
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={busy || hasTokenError || !dirty}
          className="twx-btn"
          style={busy || hasTokenError || !dirty ? { opacity: 0.5 } : undefined}
        >
          {busy ? "Mentés…" : "Mentés új verzióként"}
        </button>
        {!usingDefault && (
          <button
            type="button"
            onClick={onReset}
            disabled={busy}
            className="rounded-full px-5 py-2.5 text-sm font-medium transition-colors"
            style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream-card)", color: "var(--twx-ink)" }}
          >
            Alapértelmezettre vissza
          </button>
        )}
      </div>

      {msg && <p className="text-sm text-green-700">{msg}</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}

      {/* Verziótörténet */}
      <div>
        <h3 className="font-display font-medium">Verziótörténet</h3>
        {versions.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            Még nincs mentett verzió — a rendszer a beépített alapértelmezettet használja.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {versions.map((vrs) => (
              <li key={vrs.id} className="twx-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      v{vrs.version}
                      {vrs.name ? ` — ${vrs.name}` : ""}
                      {vrs.is_active && (
                        <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: "var(--twx-coral)", color: "#1c1005" }}>
                          aktív
                        </span>
                      )}
                    </p>
                    <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                      {new Date(vrs.created_at).toLocaleString("hu-HU")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setOpenVersion(openVersion === vrs.id ? null : vrs.id)}
                      className="rounded-full px-3 py-1.5 text-xs font-medium"
                      style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream-card)", color: "var(--twx-ink)" }}
                    >
                      {openVersion === vrs.id ? "Elrejtés" : "Megtekintés"}
                    </button>
                    {!vrs.is_active && (
                      <button
                        type="button"
                        onClick={() => onActivate(vrs.id)}
                        disabled={busy}
                        className="rounded-full px-3 py-1.5 text-xs font-medium"
                        style={{ background: "var(--twx-coral)", color: "#1c1005" }}
                      >
                        Aktiválás
                      </button>
                    )}
                  </div>
                </div>
                {openVersion === vrs.id && (
                  <div className="mt-3 space-y-3">
                    {segmentDefs.map((s) => (
                      <div key={s.id}>
                        <p className="text-xs font-semibold" style={{ color: "var(--twx-ink-muted)" }}>{s.label}</p>
                        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg p-2 text-xs" style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>
                          {vrs.segments[s.id] ?? ""}
                        </pre>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setValues({ ...activeSegments, ...vrs.segments })}
                      className="rounded-full px-3 py-1.5 text-xs font-medium"
                      style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream-card)", color: "var(--twx-ink)" }}
                    >
                      Betöltés a szerkesztőbe
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
