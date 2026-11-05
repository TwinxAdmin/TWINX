// A visszajelzés rögzítése betöltéskor (POST), utána opcionális szabad szöveg. A kártya mérete a küldés után sem változik.
"use client";

import { useEffect, useState } from "react";
import { showToast } from "@/components/Toast";

type Status = "saving" | "saved" | "already" | "failed";

export default function FeedbackClient({ token, answer }: { token: string; answer: string }) {
  const [status, setStatus] = useState<Status>("saving");
  const [text, setText] = useState("");
  const [canWrite, setCanWrite] = useState(false);
  const [sending, setSending] = useState(false);
  const [textSent, setTextSent] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/activation/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { first?: boolean; hasText?: boolean };
        if (!alive) return;
        if (!res.ok) { setStatus("failed"); return; }
        setStatus(data.first ? "saved" : "already");
        setCanWrite(!data.hasText);
      })
      .catch(() => { if (alive) setStatus("failed"); });
    return () => { alive = false; };
  }, [token]);

  async function sendText() {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/activation/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, text: value }) });
      if (!res.ok) throw new Error();
      setTextSent(true);
      showToast("Köszönjük, megkaptuk.", "success");
    } catch {
      showToast("Most nem sikerült elküldeni. Kérlek, próbáld újra.", "error");
    } finally {
      setSending(false);
    }
  }

  if (status === "saving") return <p className="text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>Egy pillanat…</p>;

  if (status === "failed") {
    return (
      <div className="text-center">
        <h1 className="font-display text-2xl font-semibold">Ez most nem sikerült</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Lehet, hogy a link már nem érvényes. Ha szeretnéd, írj nekünk: twinx.hu/kapcsolat</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">{status === "saved" ? "Köszönjük a válaszod!" : "Ezt már megkaptuk, köszönjük!"}</h1>
      {status === "saved" && <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>A válaszod: <strong style={{ color: "var(--twx-ink)" }}>{answer}</strong></p>}
      {canWrite && !textSent ? (
        <div className="mt-4">
          <label htmlFor="feedback-text" className="block text-sm">Szívesen olvasnánk róla pár szót. Nem kötelező.</label>
          <textarea id="feedback-text" value={text} onChange={(e) => setText(e.target.value.slice(0, 2000))} rows={4} className="twx-input mt-1 resize-none" />
          <button type="button" onClick={() => void sendText()} disabled={sending || !text.trim()} className="twx-btn mt-3 h-11 w-full">
            {sending ? "Küldés…" : "Elküldöm"}
          </button>
        </div>
      ) : (
        <p className="mt-4 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Elolvassuk, és igyekszünk jobbá tenni a TWINX-et. Ezt az ablakot már bezárhatod.</p>
      )}
    </div>
  );
}
