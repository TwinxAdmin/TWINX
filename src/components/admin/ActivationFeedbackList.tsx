// Admin → Visszajelzések: a levelekből érkezett válaszok listája, kategóriaszűrővel, + a heti jelentések.
"use client";

import { useMemo, useState } from "react";
import SelectField from "@/components/SelectField";
import { ACTIVATION_STATE_LABEL, feedbackLabels } from "@/lib/activation-shared";

export type FeedbackRow = {
  id: string;
  created_at: string;
  name: string;
  user_state: string | null;
  question_id: string;
  category: string;
  free_text: string | null;
};

export type ReportRow = { week_start: string; summary: string };

export default function ActivationFeedbackList({ rows, reports }: { rows: FeedbackRow[]; reports: ReportRow[] }) {
  const [filter, setFilter] = useState("all");

  const options = useMemo(() => {
    const answers = [...new Set(rows.map((r) => feedbackLabels(r.question_id, r.category).answer))].sort((a, b) => a.localeCompare(b, "hu"));
    return [{ value: "all", label: "Minden kategória" }, ...answers.map((a) => ({ value: a, label: a }))];
  }, [rows]);

  const visible = filter === "all" ? rows : rows.filter((r) => feedbackLabels(r.question_id, r.category).answer === filter);

  return (
    <>
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display font-medium">Válaszok ({visible.length})</h2>
          <div className="w-64"><SelectField value={filter} onChange={setFilter} options={options} /></div>
        </div>
        {visible.length === 0 ? (
          <div className="twx-card mt-3 p-8 text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            {rows.length === 0 ? "Még nem érkezett visszajelzés. Amint valaki válaszol egy levélre, itt megjelenik." : "Ebben a kategóriában nincs válasz."}
          </div>
        ) : (
          <div className="twx-card mt-3 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead style={{ color: "var(--twx-ink-muted)" }}>
                <tr className="text-xs">
                  {["Dátum", "Felhasználó", "Állapot", "Kérdés", "Válasz", "Szabad szöveg"].map((h) => <th key={h} className="px-3 py-2.5 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const labels = feedbackLabels(r.question_id, r.category);
                  return (
                    <tr key={r.id} className="align-top" style={{ borderTop: "1px solid var(--twx-line)" }}>
                      <td className="whitespace-nowrap px-3 py-2.5">{new Date(r.created_at).toLocaleDateString("hu-HU")}</td>
                      <td className="px-3 py-2.5">{r.name}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{r.user_state ? ACTIVATION_STATE_LABEL[r.user_state] ?? r.user_state : "–"}</td>
                      <td className="px-3 py-2.5">{labels.question}</td>
                      <td className="px-3 py-2.5 font-medium">{labels.answer}</td>
                      <td className="max-w-xs whitespace-pre-wrap px-3 py-2.5">{r.free_text || "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-display font-medium">Heti jelentések</h2>
        {reports.length === 0 ? (
          <div className="twx-card mt-3 p-8 text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>Az első jelentés az ügynök élesítése utáni hétfőn érkezik.</div>
        ) : (
          <ul className="mt-3 space-y-2">
            {reports.map((r) => (
              <li key={r.week_start} className="twx-card p-4 text-sm">
                <p className="text-xs font-semibold" style={{ color: "var(--twx-ink-muted)" }}>{r.week_start} hete</p>
                <p className="mt-1 max-h-72 overflow-y-auto whitespace-pre-wrap">{r.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
