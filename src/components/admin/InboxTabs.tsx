// /admin/megkeresesek — minden beérkező megkeresés EGY helyen, füleken.
//
// 1) „Kérések és üzenetek" — a `leads` táblába érkező megkeresések:
//    az /ingatlan landing „Bővebb tájékoztatást kérek" ablaka és a B2B űrlap.
// 2) „Ajándékkód-jelentkezők" — az `ingatlan_invites` kampány-lista, itt lehet
//    elfogadni/elutasítani (a művelet-gombok az InviteList komponensben vannak).
//
// Minden megkeresés KIPIPÁLHATÓ: amíg nincs lezárva, „Nyitott" jelzést kap, és
// beleszámít a fejléc-jelvénybe. Mindegyikhez tartozik egy BELSŐ JEGYZET is —
// az értékesítő ide írja, mit beszélt meg a megkeresővel; a megkereső ezt soha
// nem látja. (leads-handled.sql)
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/components/Toast";
import InviteList from "@/components/admin/InviteList";
import type { Invite } from "@/lib/invites";

export type Lead = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  message: string;
  created_at: string;
  handled_at: string | null;
  handled_email: string | null;
  note: string | null;
  note_updated_at: string | null;
  note_email: string | null;
};

/** A lead üzenetéből kiolvassuk, honnan jött — így ránézésre besorolható. */
function leadSource(message: string): { label: string; tone: "coral" | "muted" } {
  if (message.includes("Bővebb tájékoztatás")) return { label: "Tájékoztatás-kérés · /ingatlan", tone: "coral" };
  if (message.includes("TWINX Ingatlan landing")) return { label: "Ingatlan landing", tone: "coral" };
  return { label: "B2B ajánlatkérés", tone: "muted" };
}

function fmt(d: string): string {
  return new Date(d).toLocaleString("hu-HU", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function LeadRow({ lead }: { lead: Lead }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [handled, setHandled] = useState(Boolean(lead.handled_at));
  // Belső jegyzet: alapból ÖSSZECSUKVA — sok megkeresésnél így marad átlátható
  // a lista. Egy kattintás nyitja, egy kattintás zárja.
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(lead.note ?? "");
  const [savedNote, setSavedNote] = useState(lead.note ?? "");
  const [noteMeta, setNoteMeta] = useState<{ at: string | null; by: string | null }>({
    at: lead.note_updated_at, by: lead.note_email,
  });
  const [savingNote, setSavingNote] = useState(false);
  const dirty = note.trim() !== savedNote.trim();
  const src = leadSource(lead.message);
  const subject = encodeURIComponent("TWINX — válasz a megkeresésedre");
  const body = encodeURIComponent(`Kedves ${lead.name.split(" ").pop() || lead.name}!\n\n`);

  async function toggle() {
    const next = !handled;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, handled: next }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "A művelet nem sikerült.");
      setHandled(next);
      showToast(next ? "Lezárva." : "Újra nyitott.", next ? "success" : "info");
      router.refresh();
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally { setBusy(false); }
  }

  async function saveNote() {
    setSavingNote(true);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, note }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "A jegyzet mentése nem sikerült.");
      setSavedNote(note);
      setNoteMeta({ at: new Date().toISOString(), by: null });
      setNoteOpen(false); // mentés után visszacsukjuk, hogy a lista átlátható maradjon
      showToast("Jegyzet elmentve.", "success");
      router.refresh();
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally { setSavingNote(false); }
  }

  return (
    <li className="twx-card p-4 text-sm" style={handled ? { opacity: 0.62 } : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={
                src.tone === "coral"
                  ? { background: "rgba(239,122,90,0.16)", color: "var(--twx-coral)" }
                  : { background: "var(--twx-cream-card)", color: "var(--twx-ink-muted)" }
              }
            >
              {src.label}
            </span>
            {handled ? (
              <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: "rgba(47,158,95,0.14)", color: "#2f9e5f" }}>
                ✓ Lezárva{lead.handled_email ? ` · ${lead.handled_email}` : ""}
              </span>
            ) : (
              <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: "var(--twx-coral)", color: "#1c1005" }}>
                Nyitott — még nincs lezárva
              </span>
            )}
          </div>
          <p className="mt-2 font-display text-base font-semibold">{lead.name}</p>
          <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            {lead.email}
            {lead.company ? ` · ${lead.company}` : ""} · {fmt(lead.created_at)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={`mailto:${lead.email}?subject=${subject}&body=${body}`}
            className="twx-btn-outline rounded-lg px-3 py-1.5 text-xs"
          >
            Válasz e-mailben
          </a>
          <button
            type="button"
            onClick={toggle}
            disabled={busy}
            title={handled ? "Újranyitás" : "Megjelölés lezártként"}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
            style={handled
              ? { background: "var(--twx-cream-card)", color: "var(--twx-ink-muted)", border: "1px solid var(--twx-line)" }
              : { background: "#2f9e5f", color: "#fff" }}
          >
            <span aria-hidden>{handled ? "↺" : "✓"}</span>
            {handled ? "Újranyit" : "Kész"}
          </button>
        </div>
      </div>
      <pre className="mt-3 whitespace-pre-wrap rounded-xl px-3 py-2 font-sans text-[13px] leading-relaxed"
        style={{ background: "var(--twx-cream-card)", color: "var(--twx-ink)" }}>
        {lead.message}
      </pre>

      {/* Belső jegyzet — csukva egy kis sáv, nyitva a szerkesztő. */}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setNoteOpen((v) => !v)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors"
          style={savedNote
            ? { background: "rgba(239,122,90,0.10)", border: "1px solid rgba(239,122,90,0.35)", color: "var(--twx-ink)" }
            : { background: "var(--twx-cream-card)", border: "1px dashed var(--twx-line)", color: "var(--twx-ink-muted)" }}
        >
          <span aria-hidden style={{ color: savedNote ? "var(--twx-coral)" : "var(--twx-ink-muted)" }}>
            {savedNote ? "📝" : "+"}
          </span>
          <span className="font-semibold">
            {savedNote ? "Jegyzet hozzáadva" : "Jegyzet hozzáadása"}
          </span>
          {savedNote && (
            <>
              {/* Egysoros előnézet, hogy nyitás nélkül is legyen fogódzó. */}
              <span className="min-w-0 flex-1 truncate font-normal" style={{ color: "var(--twx-ink-muted)" }}>
                — {savedNote.replace(/\s+/g, " ")}
              </span>
              {noteMeta.at && (
                <span className="hidden shrink-0 sm:inline" style={{ color: "var(--twx-ink-muted)" }}>
                  {fmt(noteMeta.at)}
                </span>
              )}
            </>
          )}
          <span aria-hidden className="ml-auto shrink-0 pl-2 opacity-60">{noteOpen ? "▲" : "▼"}</span>
        </button>

        {noteOpen && (
          <div className="mt-2 rounded-xl p-3" style={{ background: "rgba(239,122,90,0.06)", border: "1px solid rgba(239,122,90,0.28)" }}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs font-semibold" style={{ color: "var(--twx-coral)" }}>
                Belső jegyzet <span className="font-normal" style={{ color: "var(--twx-ink-muted)" }}>— a megkereső nem látja</span>
              </p>
              {noteMeta.at && !dirty && (
                <p className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                  Mentve: {fmt(noteMeta.at)}{noteMeta.by ? ` · ${noteMeta.by}` : ""}
                </p>
              )}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="Pl. 09.09. telefon: 12 fős iroda, a videó és az értékbecslő érdekli. Jövő kedden visszahívom, addig küldök mintaanyagot."
              className="twx-input mt-2 w-full rounded-lg px-3 py-2 text-[13px] leading-relaxed outline-none"
              style={{ border: "1px solid var(--twx-line)" }}
            />
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={saveNote} disabled={savingNote || !dirty}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity disabled:opacity-40"
                style={{ background: "var(--twx-coral)", color: "#1c1005" }}>
                {savingNote ? "Mentés…" : dirty ? "Mentés" : "Elmentve"}
              </button>
              {dirty ? (
                <button type="button" onClick={() => setNote(savedNote)}
                  className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  Elvetés
                </button>
              ) : (
                <button type="button" onClick={() => setNoteOpen(false)}
                  className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  Bezárás
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

export default function InboxTabs({
  leads, invites, issued, limit, inviteReadOnly = false,
}: { leads: Lead[]; invites: Invite[]; issued: number; limit: number; inviteReadOnly?: boolean }) {
  const [tab, setTab] = useState<"leads" | "invites">("leads");
  const newInvites = invites.filter((i) => i.status === "uj").length;
  const openLeads = leads.filter((l) => !l.handled_at).length;
  // Típusonkénti bontás, hogy ránézésre látszódjon, MELYIK részre érkezett.
  const openConsult = leads.filter((l) => !l.handled_at && l.message.includes("Bővebb tájékoztatás")).length;
  const openB2B = openLeads - openConsult;

  const tabBtn = (id: "leads" | "invites", label: string, count: number) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className="rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
      style={
        tab === id
          ? { background: "var(--twx-coral)", color: "#1c1005" }
          : { background: "var(--twx-cream-card)", color: "var(--twx-ink-muted)", border: "1px solid var(--twx-line)" }
      }
    >
      {label}
      {count > 0 && (
        <span className="ml-2 rounded-full px-1.5 py-0.5 text-[11px]"
          style={tab === id ? { background: "rgba(0,0,0,0.14)" } : { background: "var(--twx-coral)", color: "#1c1005" }}>
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Bontás típusonként — mi vár elintézésre és melyik csatornán érkezett. */}
      <div className="twx-card flex flex-wrap items-center gap-x-5 gap-y-2 p-4 text-sm">
        <span className="font-semibold">Elintézésre vár:</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--twx-coral)" }} />
          Tájékoztatás-kérés <strong>{openConsult}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--twx-ink-muted)" }} />
          B2B ajánlatkérés <strong>{openB2B}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#2f9e5f" }} />
          Ajándékkód-jelentkező <strong>{newInvites}</strong>
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabBtn("leads", "Kérések és üzenetek", openLeads)}
        {tabBtn("invites", "Ajándékkód-jelentkezők", newInvites)}
      </div>

      {tab === "leads" ? (
        leads.length === 0 ? (
          <p className="twx-card p-6 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            Még nincs beérkezett megkeresés. Ide kerül minden, amit az /ingatlan oldal
            {" "}&bdquo;Bővebb tájékoztatást kérek&rdquo; ablakából vagy a B2B űrlapról küldenek.
          </p>
        ) : (
          <ul className="space-y-3">
            {leads.map((l) => <LeadRow key={l.id} lead={l} />)}
          </ul>
        )
      ) : (
        <InviteList invites={invites} issued={issued} limit={limit} readOnly={inviteReadOnly} />
      )}
    </div>
  );
}
