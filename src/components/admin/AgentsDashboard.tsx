// Admin → AI-ügynökök: egy helyen az ügynökök állapota, mai munkája, naplója, a levelekre érkezett válaszok és a heti jelentések.
// A fülek és a blokkok mérete tartalomváltáskor nem ugrik: a hosszú listák a blokkon belül görögnek.
"use client";

import { useState } from "react";
import SelectField from "@/components/SelectField";
import ActivationFeedbackList, { type FeedbackRow, type ReportRow } from "@/components/admin/ActivationFeedbackList";
import { ACTIVATION_STATE_LABEL } from "@/lib/activation-shared";
import {
  AGENT_ERROR_KINDS, AGENT_EVENTS_KEEP_DAYS, AGENT_EVENT_LABEL, AGENT_INFO, AGENT_OFFLINE_MINUTES, OUTBOX_STATUSES,
  type AgentEventRow, type AgentLetter, type AgentStatusRow,
} from "@/lib/agents-shared";

export type AgentTab = "attekintes" | "naplo" | "visszajelzesek";

const TAB_LABELS: { id: AgentTab; label: string }[] = [
  { id: "attekintes", label: "Áttekintés" },
  { id: "naplo", label: "Napló" },
  { id: "visszajelzesek", label: "Visszajelzések és jelentések" },
];

const TIME_ZONE = "Europe/Budapest";
const GREEN = "#2f8f5b";

// A szerver és a böngésző ugyanazt írja ki: az időzóna rögzített.
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: TIME_ZONE });
const clockOf = (iso: string) => new Date(iso).toLocaleTimeString("hu-HU", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const dateTimeOf = (iso: string) => new Date(iso).toLocaleString("hu-HU", { timeZone: TIME_ZONE, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>{children}</p>;
}

function Migration({ file }: { file: string }) {
  return <div className="twx-card p-6 text-sm">A megjelenítéshez futtasd le a <strong>{file}</strong> migrációt.</div>;
}

function AgentCard({ status, letters, lastError, nowIso }: { status: AgentStatusRow; letters: AgentLetter[]; lastError?: AgentEventRow; nowIso: string }) {
  const info = AGENT_INFO[status.agent] ?? { name: status.agent, description: "" };
  const summary = status.summary;
  const today = dayOf(nowIso);
  const isToday = summary?.day === today;
  const todays = isToday ? letters : [];
  const online = Date.parse(nowIso) - Date.parse(status.last_seen_at) < AGENT_OFFLINE_MINUTES * 60_000;
  const states = Object.entries(ACTIVATION_STATE_LABEL);

  return (
    <article className="twx-card space-y-5 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">{info.name}</h2>
          <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>{info.description}</p>
        </div>
        <span className="rounded-full px-3 py-1 text-xs font-semibold" style={status.dry_run
          ? { background: "rgba(239,122,90,0.14)", color: "#b4502f" }
          : { background: "rgba(47,143,91,0.14)", color: GREEN }}>
          {status.dry_run ? "Próbamód: levél nem megy ki" : "Éles: levelet küld"}
        </span>
      </header>

      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-xl p-3" style={{ border: "1px solid var(--twx-line)" }}>
          <dt className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>Állapot</dt>
          <dd className="mt-1 font-semibold" style={{ color: online ? GREEN : "#b4502f" }}>{online ? "Működik" : "Nem jelentkezik"}</dd>
          {!online && <dd className="mt-0.5 text-xs" style={{ color: "var(--twx-ink-muted)" }}>A Macen fut: ha a gép alszik vagy ki van kapcsolva, áll.</dd>}
        </div>
        <div className="rounded-xl p-3" style={{ border: "1px solid var(--twx-line)" }}>
          <dt className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>Utolsó jelzés</dt>
          <dd className="mt-1 font-semibold">{dateTimeOf(status.last_seen_at)}</dd>
        </div>
        <div className="rounded-xl p-3" style={{ border: "1px solid var(--twx-line)" }}>
          <dt className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>Utolsó hiba</dt>
          <dd className="mt-1 font-semibold">{lastError ? dateTimeOf(lastError.created_at) : "Nincs"}</dd>
          {lastError?.message && <dd className="mt-0.5 line-clamp-2 break-words text-xs" title={lastError.message} style={{ color: "var(--twx-ink-muted)" }}>{lastError.message}</dd>}
        </div>
      </dl>

      <section>
        <h3 className="font-display font-medium">Mai levelek</h3>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {OUTBOX_STATUSES.map((s) => (
            <div key={s} className="rounded-xl p-3 text-center" style={{ border: "1px solid var(--twx-line)" }}>
              <p className="font-display text-xl font-semibold">{todays.filter((l) => l.status === s).length}</p>
              <p className="text-xs first-letter:uppercase" style={{ color: "var(--twx-ink-muted)" }}>{s}</p>
            </div>
          ))}
        </div>
        {status.dry_run && <p className="mt-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>Próbamódban az „elküldve” azt jelenti, hogy kimenne: valódi levél nem indul.</p>}
        <div className="mt-3 h-56 overflow-auto rounded-xl" style={{ border: "1px solid var(--twx-line)" }}>
          {todays.length === 0 ? (
            <Empty>{isToday ? "Ma nincs kiküldendő levél." : "A mai terv reggel 8 után jelenik meg."}</Empty>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead style={{ color: "var(--twx-ink-muted)" }}>
                <tr className="text-xs">{["Felhasználó", "Levél", "Besorolás", "Státusz", "Időpont"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {todays.map((l, i) => (
                  <tr key={`${l.user_id}-${i}`} style={{ borderTop: "1px solid var(--twx-line)" }}>
                    <td className="px-3 py-2">{l.name}</td>
                    <td className="px-3 py-2">{l.letter}</td>
                    <td className="whitespace-nowrap px-3 py-2">{ACTIVATION_STATE_LABEL[l.state] ?? l.state}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-medium first-letter:uppercase">{l.status}</td>
                    <td className="whitespace-nowrap px-3 py-2">{l.at ? clockOf(l.at) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <h3 className="font-display font-medium">Felhasználók besorolás szerint</h3>
          {summary?.states ? (
            <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {states.map(([key, label]) => (
                <li key={key} className="flex justify-between py-0.5">
                  <span style={{ color: "var(--twx-ink-muted)" }}>{label}</span>
                  <span className="font-semibold">{summary.states?.[key] ?? 0}</span>
                </li>
              ))}
            </ul>
          ) : <Empty>Az első napi besorolás után jelenik meg.</Empty>}
        </section>
        <section>
          <h3 className="font-display font-medium">Napi rend</h3>
          {summary?.schedule?.length ? (
            <ul className="mt-2 space-y-1 text-sm">
              {summary.schedule.map((s) => (
                <li key={s.label} className="flex gap-3">
                  <span className="w-28 shrink-0 font-semibold">{s.at}</span>
                  <span style={{ color: "var(--twx-ink-muted)" }}>{s.label}</span>
                </li>
              ))}
            </ul>
          ) : <Empty>Az ügynök első jelzése után jelenik meg.</Empty>}
        </section>
      </div>
    </article>
  );
}

function EventLog({ events }: { events: AgentEventRow[] }) {
  const [filter, setFilter] = useState("all");
  const visible = filter === "errors" ? events.filter((e) => AGENT_ERROR_KINDS.includes(e.kind)) : events;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display font-medium">Napló ({visible.length})</h2>
        <div className="w-56">
          <SelectField value={filter} onChange={setFilter} options={[{ value: "all", label: "Minden esemény" }, { value: "errors", label: "Csak a hibák" }]} />
        </div>
      </div>
      <div className="twx-card mt-3 h-[520px] overflow-auto">
        {visible.length === 0 ? (
          <Empty>{events.length === 0 ? "Még nincs esemény. Az ügynök 5 percenként jelent." : "Nincs hiba a naplóban."}</Empty>
        ) : (
          <ul>
            {visible.map((e, i) => {
              const isError = AGENT_ERROR_KINDS.includes(e.kind);
              return (
                <li key={e.id} className="grid gap-x-4 gap-y-0.5 px-4 py-2.5 text-sm sm:grid-cols-[7.5rem_11rem_1fr]" style={i ? { borderTop: "1px solid var(--twx-line)" } : undefined}>
                  <span className="whitespace-nowrap text-xs sm:text-sm" style={{ color: "var(--twx-ink-muted)" }}>{dateTimeOf(e.created_at)}</span>
                  <span className="font-medium" style={isError ? { color: "#b4502f" } : undefined}>
                    {AGENT_EVENT_LABEL[e.kind] ?? e.kind}
                    {e.dry_run && <span className="ml-1.5 text-[11px] font-normal" style={{ color: "var(--twx-ink-muted)" }}>próba</span>}
                  </span>
                  <span className="break-words">{e.message || "–"}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="mt-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>A legutóbbi 200 eseményt mutatjuk; {AGENT_EVENTS_KEEP_DAYS} nap után automatikusan törlődnek.</p>
    </section>
  );
}

export default function AgentsDashboard({
  initialTab, nowIso, statuses, lettersByAgent, events, monitorMissing, feedback, reports, feedbackMissing,
}: {
  initialTab: AgentTab;
  nowIso: string;
  statuses: AgentStatusRow[];
  lettersByAgent: Record<string, AgentLetter[]>;
  events: AgentEventRow[];
  monitorMissing: string | null;
  feedback: FeedbackRow[];
  reports: ReportRow[];
  feedbackMissing: string | null;
}) {
  const [tab, setTab] = useState<AgentTab>(initialTab);

  return (
    <>
      <div role="tablist" className="flex flex-wrap gap-1.5">
        {TAB_LABELS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className="rounded-lg px-3.5 py-2 text-sm font-medium transition-colors"
            style={tab === t.id
              ? { background: "var(--twx-coral)", color: "#1c1005" }
              : { background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", color: "var(--twx-ink)" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "attekintes" && (monitorMissing ? <Migration file={monitorMissing} /> : statuses.length === 0 ? (
        <div className="twx-card p-8 text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          Az ügynök még nem jelentkezett. Amint elküldi az első jelzését, itt megjelenik az állapota és a mai munkája.
        </div>
      ) : (
        <div className="space-y-5">
          {statuses.map((s) => (
            <AgentCard key={s.agent} status={s} letters={lettersByAgent[s.agent] ?? []} nowIso={nowIso}
              lastError={events.find((e) => e.agent === s.agent && AGENT_ERROR_KINDS.includes(e.kind))} />
          ))}
        </div>
      ))}

      {tab === "naplo" && (monitorMissing ? <Migration file={monitorMissing} /> : <EventLog events={events} />)}

      {tab === "visszajelzesek" && (feedbackMissing ? <Migration file={feedbackMissing} /> : <ActivationFeedbackList rows={feedback} reports={reports} />)}
    </>
  );
}
