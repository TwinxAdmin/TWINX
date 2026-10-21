// BrevoAdmin — Admin → Brevo-szinkron: beállítás-ellenőrzés, darabszámok, attribútumok létrehozása,
// a meglévő fiókok egyszeri (megismételhető) szinkronja haladásjelzővel, és a sikertelenek újrapróbálása.
"use client";

import { useCallback, useEffect, useState } from "react";
import { showToast } from "@/components/Toast";
import type { BrevoStatus } from "@/lib/brevo";

type Progress = { done: number; ok: number; failed: number; skipped: number; running: boolean };

export default function BrevoAdmin() {
  const [status, setStatus] = useState<BrevoStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [prog, setProg] = useState<Progress | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/brevo").then((r) => r.json()).then(setStatus).catch(() => null);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function post(body: object) {
    const res = await fetch("/api/admin/brevo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "Nem sikerült.");
    return d;
  }

  async function attributes() {
    setBusy("attr");
    try { await post({ action: "attributes" }); showToast("Az attribútumok rendben vannak a Brevóban.", "success"); }
    catch (e) { showToast((e as Error).message, "error"); }
    finally { setBusy(null); }
  }

  async function syncAll() {
    setBusy("sync");
    const p: Progress = { done: 0, ok: 0, failed: 0, skipped: 0, running: true };
    setProg({ ...p });
    try {
      let offset: number | null = 0;
      while (offset !== null) {
        const r = (await post({ action: "sync", offset })) as { ok: number; failed: number; skipped: number; next: number | null };
        p.ok += r.ok; p.failed += r.failed; p.skipped += r.skipped; p.done = p.ok + p.failed + p.skipped;
        setProg({ ...p });
        offset = r.next;
      }
      showToast(`Kész: ${p.ok} fiók a Brevóban${p.failed ? `, ${p.failed} sikertelen (a napi feladat újrapróbálja)` : ""}.`, p.failed ? "error" : "success");
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setProg({ ...p, running: false });
      setBusy(null);
      load();
    }
  }

  async function retry() {
    setBusy("retry");
    try {
      const r = await post({ action: "retry" });
      showToast(`Újrapróbálva: ${r.ok} sikerült, ${r.failed} még sikertelen.`, r.failed ? "error" : "success");
    } catch (e) { showToast((e as Error).message, "error"); }
    finally { setBusy(null); load(); }
  }

  const total = status?.users ?? 0;
  const pct = prog && total ? Math.min(100, Math.round((prog.done / total) * 100)) : 0;
  const disabled = !status?.configured || busy !== null;

  return (
    <div className="space-y-4">
      {/* Állapot */}
      <section className="rounded-2xl p-5" style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>
        <h2 className="font-display text-lg font-bold">Állapot</h2>
        {!status ? (
          <div className="mt-3 h-16 animate-pulse rounded-xl" style={{ background: "#EFE7DD" }} />
        ) : (
          <>
            {status.missing.length > 0 ? (
              <p className="mt-3 rounded-xl p-3 text-sm" style={{ background: "#FFF1D6", color: "#8A5A12" }}>
                Hiányzó beállítás a Vercelben: <b>{status.missing.join(", ")}</b>. Kulcs és „TWINX felhasználók” lista nélkül a szinkron nem fut
                (a regisztráció ettől még működik).
              </p>
            ) : (
              <p className="mt-3 rounded-xl p-3 text-sm" style={{ background: "#E6F2EA", color: "#1F6B3E" }}>A Brevo be van állítva — az új regisztrációk és a változások azonnal felkerülnek.</p>
            )}
            {status.optional.length > 0 && (
              <p className="mt-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                Nem kötelező, még nincs beállítva: {status.optional.join(", ")} — amíg nincs, a hírlevél- / 3D-lista kimarad, minden más működik.
              </p>
            )}
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Stat label="Regisztrált fiók" value={status.users} />
              <Stat label="Hírlevelet kér" value={status.newsletter ?? "—"} hint={status.newsletter === null ? "futtasd le a 20261021200000_brevo-newsletter.sql migrációt" : undefined} />
              <Stat label="Újrapróbálásra vár" value={status.queue ?? "—"} />
            </div>
          </>
        )}
      </section>

      {/* Műveletek */}
      <section className="space-y-3 rounded-2xl p-5" style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>
        <h2 className="font-display text-lg font-bold">Műveletek</h2>
        <Row title="1. Attribútumok létrehozása" text="REG_DATUM, FIOKTIPUS, IRODAI_SZEREP, HIRLEVEL, HIRLEVEL_DATUM — ha már megvannak, nem változik semmi.">
          <Btn onClick={() => void attributes()} disabled={disabled}>{busy === "attr" ? "Folyamatban…" : "Létrehozás"}</Btn>
        </Row>
        <Row title="2. Meglévő felhasználók szinkronja" text="Minden fiók felkerül a „TWINX felhasználók” listára (aki nem kért hírlevelet: HIRLEVEL = nem). Bármikor megismételhető — e-mail alapján frissít, nem duplikál.">
          <Btn onClick={() => void syncAll()} disabled={disabled} primary>{busy === "sync" ? "Szinkron fut…" : "Szinkron indítása"}</Btn>
        </Row>
        {prog && (
          <div>
            <div className="h-2 overflow-hidden rounded-full" style={{ background: "#EFE7DD" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "#c4553a" }} />
            </div>
            <p className="mt-1.5 text-xs tabular-nums" style={{ color: "var(--twx-ink-muted)" }}>
              {prog.done} / {total} · sikeres: {prog.ok} · sikertelen: {prog.failed} · kihagyva: {prog.skipped}{prog.running ? "" : " · kész"}
            </p>
          </div>
        )}
        <Row title="3. Sikertelenek újrapróbálása" text="Ezt a napi ütemezett feladat (03:00) magától is elvégzi.">
          <Btn onClick={() => void retry()} disabled={disabled || !status?.queue}>{busy === "retry" ? "Folyamatban…" : "Újrapróbálás"}</Btn>
        </Row>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-xl bg-white p-3" style={{ border: "1px solid var(--twx-line)" }} title={hint}>
      <p className="text-[11px] font-semibold" style={{ color: "var(--twx-ink-muted)" }}>{label}</p>
      <p className="font-display text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Row({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3.5" style={{ border: "1px solid var(--twx-line)" }}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{text}</p>
      </div>
      {children}
    </div>
  );
}

function Btn({ children, onClick, disabled, primary = false }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="h-10 w-[170px] flex-none rounded-full text-sm font-semibold disabled:opacity-40"
      style={primary ? { background: "#c4553a", color: "#fff" } : { background: "#fff", border: "1px solid #d9cfc4", color: "var(--twx-ink)" }}>
      {children}
    </button>
  );
}
