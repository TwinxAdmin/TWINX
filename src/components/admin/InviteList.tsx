// Ingatlanos jelentkezők kezelése — KÉTLÉPCSŐS kiküldéssel:
//   1) „Elfogadom”  → a rendszer legenerálja a kódot (levél még nem megy ki),
//   2) „Átnézem és kiküldöm” → felugrik a KÉSZ levél a jelentkező nevével és
//      címével; a kolléga ellenőrzi az adatokat, és egy gombbal kiküldi.
// Így soha nem kell kézzel bemásolni a kódot vagy a nevet, de van egy emberi
// ellenőrzési pont, mielőtt a levél elmegy a partnernek.
// A keret betelését a szerver őrzi, itt csak megjelenítjük, hol tartunk.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/components/Toast";
import { INVITE_STATUS_LABEL, type Invite } from "@/lib/invites";

type Preview = {
  id: string;
  to: string;
  toName: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  code: string;
  sentAt: string | null;
};

/** Fájl letöltése a böngészőből (szerver nélkül). */
function downloadFile(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Ékezet nélküli, fájlnévbe illő változat. */
function slug(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "jelentkezo";
}

export default function InviteList({
  invites, issued, limit, readOnly = false,
}: { invites: Invite[]; issued: number; limit: number; readOnly?: boolean }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [sending, setSending] = useState(false);
  const full = issued >= limit;

  async function act(id: string, action: "accept" | "reject") {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "A művelet nem sikerült.");
      if (action === "accept") {
        showToast(`Kód legenerálva: ${d.code} — nézd át a levelet, és küldd ki.`, "success");
        router.refresh();
        // Rögtön felajánljuk az átnézést, hogy ne maradjon kiküldetlenül.
        await openPreview(id);
        return;
      }
      showToast("Elutasítva.", "info");
      router.refresh();
    } catch (e) {
      showToast((e as Error).message, "error");
      // Tipikus ok: közben egy másik munkatárs már elbírálta — húzzuk be a friss állapotot.
      router.refresh();
    } finally { setBusyId(null); }
  }

  /** A kész levél lekérése megjelenítésre (küldés nélkül). */
  async function openPreview(id: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "preview" }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Az előnézet nem tölthető be.");
      setPreview({ id, to: d.to, toName: d.toName, from: d.from, subject: d.subject, html: d.html, text: d.text ?? "", code: d.code, sentAt: d.sentAt });
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally { setBusyId(null); }
  }

  /** A megnézett levél kiküldése a jelentkező saját címére. */
  async function sendNow() {
    if (!preview) return;
    setSending(true);
    try {
      // Ha már ment ki levél, az TUDATOS újraküldés ("resend"); az első küldést
      // a szerver elutasítja, ha közben egy kolléga már elintézte.
      const action = preview.sentAt ? "resend" : "send";
      const res = await fetch("/api/admin/invites", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: preview.id, action }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Ütközés: időközben más küldte ki. Zárjuk az ablakot és frissítünk,
        // hogy ne menjen ki kétszer ugyanaz a levél.
        if (d.alreadySent) { setPreview(null); router.refresh(); }
        throw new Error(d.error || "A levél nem ment ki.");
      }
      showToast(`A kód kiment ide: ${preview.to}`, "success");
      setPreview(null);
      router.refresh();
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally { setSending(false); }
  }

  /** Vágólapra: sortöréshelyesen illeszthető be bármelyik levelezőbe. */
  async function copyRich() {
    if (!preview) return;
    try {
      const ClipItem = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
      if (ClipItem && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipItem({
          "text/html": new Blob([preview.html], { type: "text/html" }),
          "text/plain": new Blob([preview.text], { type: "text/plain" }),
        })]);
        showToast("A levél a vágólapon — illeszd be a levelezőbe (Cmd+V).", "success");
      } else {
        await navigator.clipboard.writeText(preview.text);
        showToast("A szöveges változat a vágólapon.", "info");
      }
    } catch {
      showToast("A másolás nem sikerült — használd a letöltést.", "error");
    }
  }

  /** Kézi kiküldés után: a rendszer csak megjelöli, levelet nem küld. */
  async function markSent() {
    if (!preview) return;
    if (!confirm(`Megerősíted, hogy a kódot kiküldted ide: ${preview.to}?`)) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: preview.id, action: "mark-sent" }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "A megjelölés nem sikerült.");
      showToast("Megjelölve kiküldöttként.", "success");
      setPreview(null);
      router.refresh();
    } catch (e) {
      showToast((e as Error).message, "error");
      router.refresh();
    } finally { setSending(false); }
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
          const awaitingSend = !!it.code && !it.code_sent_at;
          return (
            <div key={it.id} className="twx-card p-4"
              style={awaitingSend ? { borderColor: "var(--twx-coral)" } : undefined}>
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
                  {/* Kiküldés állapota — ez a lépés könnyen elfelejthető, ezért kiemelt. */}
                  {it.code && (
                    it.code_sent_at
                      ? <p className="mt-1 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                          ✉️ Kiküldve: {new Date(it.code_sent_at).toLocaleString("hu-HU")}
                          {it.code_sent_by_email ? ` · ${it.code_sent_by_email}` : ""}
                        </p>
                      : <p className="mt-1 text-[11px] font-semibold" style={{ color: "#c0392b" }}>
                          ⚠️ A kód még NINCS kiküldve a jelentkezőnek.
                        </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap gap-1.5">
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
                        title={full ? "A kampány kerete betelt." : "Kód generálása (a levél még nem megy ki)"}
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
                  {!readOnly && it.code && (
                    <button type="button" disabled={busy}
                      onClick={() => void openPreview(it.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs disabled:opacity-40 ${awaitingSend ? "font-semibold text-white" : "font-medium"}`}
                      style={awaitingSend
                        ? { background: "var(--twx-coral)" }
                        : { border: "1px solid var(--twx-line)", background: "#fff" }}>
                      {awaitingSend ? "Átnézem és kiküldöm" : "Levél újraküldése"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ------------------- Levél-előnézet ablak ------------------- */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(18,16,14,0.6)" }}
          onClick={() => { if (!sending) setPreview(null); }}>
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white"
            onClick={(e) => e.stopPropagation()}>
            {/* Fejléc: kinek, honnan, milyen tárggyal megy ki */}
            <div className="border-b p-5" style={{ borderColor: "var(--twx-line)" }}>
              <p className="font-display text-lg font-semibold">Kiküldés előtti ellenőrzés</p>
              <p className="mt-1 text-[12px]" style={{ color: "var(--twx-ink-muted)" }}>
                Pontosan ez a levél megy ki. Nézd át az adatokat, mielőtt elküldöd.
              </p>
              <dl className="mt-3 space-y-1 text-[13px]">
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0" style={{ color: "var(--twx-ink-muted)" }}>Címzett</dt>
                  <dd className="font-semibold">{preview.toName} &lt;{preview.to}&gt;</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0" style={{ color: "var(--twx-ink-muted)" }}>Feladó</dt>
                  <dd>{preview.from}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0" style={{ color: "var(--twx-ink-muted)" }}>Tárgy</dt>
                  <dd>{preview.subject}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0" style={{ color: "var(--twx-ink-muted)" }}>Kód</dt>
                  <dd className="font-bold tracking-wider" style={{ color: "var(--twx-coral)" }}>{preview.code}</dd>
                </div>
              </dl>
              {preview.sentAt && (
                <p className="mt-2 rounded-lg px-3 py-2 text-[12px]"
                  style={{ background: "var(--twx-cream)", color: "var(--twx-ink-muted)" }}>
                  Ez a levél már kiment egyszer ({new Date(preview.sentAt).toLocaleString("hu-HU")}). Az újraküldéssel ugyanezt a kódot kapja meg még egyszer.
                </p>
              )}
            </div>

            {/* Maga a levél, ahogy a partner látni fogja */}
            <div className="min-h-0 flex-1 overflow-auto" style={{ background: "var(--twx-cream)" }}>
              <iframe title="Levél előnézete" srcDoc={preview.html}
                className="h-[46vh] w-full border-0" sandbox="" />
            </div>

            <div className="space-y-3 border-t p-4" style={{ borderColor: "var(--twx-line)" }}>
              {/* KÉZI KIKÜLDÉS — amíg a saját domain hitelesítése nincs kész, a
                  levelet a kolléga a saját (office@) postafiókjából küldi ki. */}
              <div className="rounded-xl p-3" style={{ background: "var(--twx-cream)", border: "1px solid var(--twx-line)" }}>
                <p className="text-xs font-semibold">Kézi kiküldés a saját postafiókodból</p>
                <p className="mt-0.5 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                  Másold be a levelet egy új üzenetbe, címzett: <strong>{preview.to}</strong>, tárgy: <strong>{preview.subject}</strong>
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => void copyRich()}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                    style={{ background: "var(--twx-coral)", color: "#1c1005" }}>
                    Levél másolása
                  </button>
                  <button type="button"
                    onClick={() => downloadFile(`twinx-ajandekkod-${slug(preview.toName)}.txt`, preview.text, "text/plain")}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium"
                    style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
                    Szöveg letöltése
                  </button>
                  {!preview.sentAt && (
                    <button type="button" disabled={sending} onClick={() => void markSent()}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                      style={{ border: "1px solid #2f9e5f", color: "#2f9e5f", background: "#fff" }}>
                      ✓ Kézzel kiküldtem
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button type="button" disabled={sending} onClick={() => setPreview(null)}
                  className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
                  style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
                  Bezárás
                </button>
                <button type="button" disabled={sending} onClick={() => void sendNow()}
                  title="A rendszer küldi ki a TWINX feladó címéről"
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: "var(--twx-coral)" }}>
                  {sending ? "Küldés…" : "Kiküldés a rendszerből"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
