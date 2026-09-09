// Ingatlanos jelentkezők kezelése: elfogadás (kód + automatikus levél),
// elutasítás, kód újraküldése. A keret betelését a szerver őrzi, itt csak
// megjelenítjük, hogy hányadiknál tartunk.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/components/Toast";
import { INVITE_STATUS_LABEL, type Invite } from "@/lib/invites";

export default function InviteList({
  invites, issued, limit, readOnly = false,
}: { invites: Invite[]; issued: number; limit: number; readOnly?: boolean }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const full = issued >= limit;

  async function act(id: string, action: "accept" | "reject" | "resend") {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "A művelet nem sikerült.");
      if (action === "accept") {
        showToast(d.mailed
          ? `Elfogadva, a kód kiment: ${d.code}`
          : `Kód létrehozva (${d.code}), de a levél NEM ment ki — küldd újra.`,
          d.mailed ? "success" : "info");
      } else if (action === "resend") showToast("A kód újra kiment.", "success");
      else showToast("Elutasítva.", "info");
      router.refresh();
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally { setBusyId(null); }
  }

  return (
    <div className="space-y-4">
      {/* Keret-számláló */}
      <div className="twx-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-semibold">Kiadott ajándékkódok</p>
          <p className="text-[12px]" style={{ color: "var(--twx-ink-muted)" }}>
            A keret betelése után a rendszer nem enged több kódot kiadni.
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-bold" style={{ color: full ? "#c0392b" : "var(--twx-coral)" }}>
            {issued} / {limit}
          </p>
          {full && <p className="text-[12px] font-semibold" style={{ color: "#c0392b" }}>A keret betelt.</p>}
        </div>
      </div>

      {invites.length === 0 && (
        <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Még nincs jelentkező.</p>
      )}

      <div className="space-y-2">
        {invites.map((it) => {
          const busy = busyId === it.id;
          return (
            <div key={it.id} className="twx-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {it.name}
                    <span className="ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{
                        background: it.status === "elfogadva" ? "rgba(31,111,92,0.12)"
                          : it.status === "elutasitva" ? "rgba(192,57,43,0.10)" : "var(--twx-cream)",
                        color: it.status === "elfogadva" ? "#1f6f5c"
                          : it.status === "elutasitva" ? "#c0392b" : "var(--twx-ink-muted)",
                      }}>
                      {INVITE_STATUS_LABEL[it.status]}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[13px]" style={{ color: "var(--twx-ink-muted)" }}>
                    {it.email} · {it.phone} · {it.office}
                  </p>
                  <p className="mt-0.5 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                    Jelentkezett: {new Date(it.created_at).toLocaleString("hu-HU")}
                    {it.decided_at && ` · Elbírálta: ${it.decided_by_email ?? "munkatárs"} (${new Date(it.decided_at).toLocaleDateString("hu-HU")})`}
                  </p>
                  {it.code && (
                    <p className="mt-1.5 text-sm font-bold tracking-wider" style={{ color: "var(--twx-coral)" }}>
                      {it.code}
                      {it.redeemed_at
                        ? <span className="ml-2 text-[11px] font-medium" style={{ color: "var(--twx-ink-muted)" }}>
                            beváltva {new Date(it.redeemed_at).toLocaleDateString("hu-HU")}
                          </span>
                        : <span className="ml-2 text-[11px] font-medium" style={{ color: "var(--twx-ink-muted)" }}>
                            még nincs beváltva
                          </span>}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {/* Sales csak látja a jelentkezőket — a kód kiadása (=kredit) admin döntés. */}
                  {readOnly && it.status === "uj" && (
                    <span className="rounded-lg px-3 py-1.5 text-xs font-medium"
                      style={{ background: "var(--twx-cream-card)", color: "var(--twx-ink-muted)", border: "1px solid var(--twx-line)" }}>
                      Admin jóváhagyásra vár
                    </span>
                  )}
                  {!readOnly && it.status === "uj" && (
                    <>
                      <button type="button" disabled={busy || full}
                        onClick={() => void act(it.id, "accept")}
                        title={full ? "A kampány kerete betelt." : "Kód generálása és kiküldése"}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                        style={{ background: "var(--twx-coral)" }}>
                        Elfogadom
                      </button>
                      <button type="button" disabled={busy}
                        onClick={() => { if (confirm(`Elutasítod ${it.name} jelentkezését?`)) void act(it.id, "reject"); }}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                        style={{ border: "1px solid #f0b3b3", color: "#c0392b", background: "#fff" }}>
                        Elutasítom
                      </button>
                    </>
                  )}
                  {!readOnly && it.status === "elfogadva" && !it.redeemed_at && (
                    <button type="button" disabled={busy}
                      onClick={() => void act(it.id, "resend")}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                      style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
                      Kód újraküldése
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
