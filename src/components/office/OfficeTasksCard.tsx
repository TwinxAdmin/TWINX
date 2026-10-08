// OfficeTasksCard — „Feladataim" (kolléga-nézet): a nekem kiadott és az általam elvállalt feladatok.
// Fix magasságú kártya; „Elvállalom" → „Késznek jelölöm", modul-indító gomb. Az üzenet-sorral közös
// „twx-office-messages" eseményre frissül.
"use client";

import { useCallback, useEffect, useState } from "react";
import type { OfficeMessage } from "@/lib/office-messages-shared";
import { fmtDue } from "@/lib/office-format";
import { showToast } from "@/components/Toast";
import { EmptyState, OfficeCard } from "@/components/office/OfficeUi";
import { OFFICE_MESSAGES_EVENT } from "@/components/office/OfficeMessagesRow";

export default function OfficeTasksCard({ height = 340 }: { height?: number }) {
  const [items, setItems] = useState<OfficeMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/office/messages?box=tasks")
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); setItems(d.items ?? []); })
      .catch(() => { setError("Nem sikerült betölteni a feladatokat."); setItems([]); });
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(OFFICE_MESSAGES_EVENT, load);
    return () => window.removeEventListener(OFFICE_MESSAGES_EVENT, load);
  }, [load]);

  async function act(id: string, action: "accept" | "done") {
    setBusy(id);
    try {
      const res = await fetch("/api/office/messages", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }),
      });
      const d = await res.json();
      if (!res.ok) { showToast(d.error ?? "Nem sikerült.", "error"); return; }
      showToast(action === "accept" ? "Elvállaltad a feladatot." : "Feladat késznek jelölve.", "success");
      window.dispatchEvent(new CustomEvent(OFFICE_MESSAGES_EVENT));
    } catch {
      showToast("Hálózati hiba.", "error");
    } finally {
      setBusy(null);
    }
  }

  const open = (items ?? []).filter((t) => t.task?.status !== "done").length;
  const done = (items ?? []).length - open;

  return (
    <OfficeCard title="Feladataim" height={height}
      badge={items && items.length > 0 ? <span className="text-xs" style={{ color: "#6B6258" }}>{open} nyitott · {done} kész</span> : undefined}>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {!items && !error && <p className="text-sm" style={{ color: "#6B6258" }}>Betöltés…</p>}
      {items && items.length === 0 && !error && (
        <EmptyState
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>}
          title="Nincs feladatod"
          text="Ha a vezetőd vagy egy kollégád feladatot ad ki neked (vagy mindenkinek), itt jelenik meg — határidővel, „Elvállalom” és „Késznek jelölöm” gombbal." />
      )}
      {items && items.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {items.map((t) => {
            const st = t.task?.status ?? "open";
            const isDone = st === "done";
            return (
              <li key={t.id} className="flex flex-col gap-1.5 rounded-[10px] px-2.5 py-2"
                style={{ background: isDone ? "#F8F3EC" : "#fff", border: "1px solid #EFE7DD", opacity: isDone ? 0.75 : 1 }}>
                <div className="flex items-start gap-2">
                  <span aria-hidden className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full text-[10px] font-bold"
                    style={isDone ? { background: "#1F7A4D", color: "#fff" } : st === "accepted" ? { background: "#DCE8F5", color: "#24476B", border: "1px solid #24476B" } : { border: "1.5px solid #D5C8B9" }}>
                    {isDone ? "✓" : ""}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`line-clamp-2 text-[13px] font-medium ${isDone ? "line-through" : ""}`}>{t.body}</p>
                    <p className="text-xs" style={{ color: "#6B6258" }}>
                      Kiadta: {t.sender.name}{t.dueDate ? ` · határidő: ${fmtDue(t.dueDate).text}` : ""}
                      {st === "accepted" ? " · folyamatban" : ""}
                    </p>
                  </div>
                </div>
                {!isDone && (
                  <div className="flex flex-wrap gap-1.5 pl-6">
                    {st === "open" && (
                      <button type="button" disabled={busy === t.id} onClick={() => void act(t.id, "accept")}
                        className="h-7 rounded-full px-2.5 text-[11px] font-semibold disabled:opacity-50" style={{ background: "#1C1A17", color: "#fff" }}>
                        Elvállalom
                      </button>
                    )}
                    {(st === "accepted" || t.recipient.id !== null) && (
                    <button type="button" disabled={busy === t.id} onClick={() => void act(t.id, "done")}
                      className="h-7 rounded-full px-2.5 text-[11px] font-semibold disabled:opacity-50" style={{ background: "#fff", color: "#1C1A17", border: "1px solid #E1D6C9" }}>
                      Késznek jelölöm
                    </button>
                    )}
                    {t.moduleHref && (
                      <a href={t.moduleHref} className="inline-flex h-7 items-center rounded-full px-2.5 text-[11px] font-semibold" style={{ background: "#F08A68", color: "#1C1A17" }}>
                        {t.moduleLabel ?? "Modul"} indítása
                      </a>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </OfficeCard>
  );
}
