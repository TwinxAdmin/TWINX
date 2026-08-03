// ReportPaper — az értékbecslés PRÉMIUM megjelenése.
// UGYANEZ a komponens adja a szerkeszthető előnézetet és a PDF tartalmát is,
// ezért minden méret fix pixelben van (A4 szélesség = 794 px @96dpi).
// A szerkesztő csak "ráül" erre a dizájnra (editable prop), a kinézet nem változik.
"use client";

import { useEffect, useRef } from "react";
import type { ReportDoc, ReportSection } from "@/lib/valuation-report";
import { reportHighlights } from "@/lib/valuation-report";

export const PAPER_WIDTH = 794; // A4 szélesség 96 dpi-n
export const PAPER_PAD = 56; // belső margó

const C = {
  dark: "#12100e",
  cream: "#fdfbf6",
  ink: "#1c1815",
  muted: "#6e655c",
  line: "#e8e1d6",
  coral: "#ef7a5a",
  coralSoft: "#f9c9b6",
  onDark: "#f4efe7",
  onDarkMuted: "#a79f94",
};

// --- sorközi formázás: **félkövér** -------------------------------------------
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} style={{ fontWeight: 700, color: C.ink }}>
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

/** A szakasz nyers szövegéből bekezdések és listák. */
function Body({ text, compact }: { text: string; compact?: boolean }) {
  const lines = text.split(/\n/);
  const blocks: { type: "p" | "ul"; items: string[] }[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const isLi = /^[-•]\s+/.test(line);
    const last = blocks[blocks.length - 1];
    if (isLi) {
      const item = line.replace(/^[-•]\s+/, "");
      if (last && last.type === "ul") last.items.push(item);
      else blocks.push({ type: "ul", items: [item] });
    } else {
      blocks.push({ type: "p", items: [line] });
    }
  }

  return (
    <>
      {blocks.map((b, i) =>
        b.type === "ul" ? (
          <ul key={i} style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
            {b.items.map((it, j) => (
              <li
                key={j}
                style={{
                  position: "relative",
                  paddingLeft: 18,
                  marginTop: j === 0 ? 0 : 6,
                  fontSize: compact ? 12.5 : 13.5,
                  lineHeight: 1.55,
                  color: C.ink,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: 2,
                    top: 7,
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: C.coral,
                  }}
                />
                <Inline text={it} />
              </li>
            ))}
          </ul>
        ) : (
          <p
            key={i}
            style={{
              margin: i === 0 ? 0 : "8px 0 0",
              fontSize: compact ? 12.5 : 13.5,
              lineHeight: 1.6,
              color: C.ink,
            }}
          >
            <Inline text={b.items[0]} />
          </p>
        )
      )}
    </>
  );
}

/** Magától növekvő szövegdoboz — szerkesztés közben nem kell görgetni. */
function AutoTextarea({
  value,
  onChange,
  minRows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        resize: "none",
        border: `1px solid ${C.coralSoft}`,
        borderRadius: 10,
        padding: "10px 12px",
        fontSize: 13.5,
        lineHeight: 1.6,
        color: C.ink,
        background: "#fff",
        outline: "none",
        fontFamily: "inherit",
      }}
    />
  );
}

// --- fejléc -------------------------------------------------------------------
function Cover({ doc, dateLabel }: { doc: ReportDoc; dateLabel: string }) {
  return (
    <div
      style={{
        background: C.dark,
        color: C.onDark,
        margin: `-${PAPER_PAD}px -${PAPER_PAD}px 0`,
        padding: `${PAPER_PAD - 8}px ${PAPER_PAD}px ${PAPER_PAD - 12}px`,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 4,
          background: `linear-gradient(90deg, ${C.coral}, ${C.coralSoft})`,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: C.onDarkMuted,
        }}
      >
        <span style={{ color: C.coral, fontWeight: 700 }}>TWINX</span>
        <span>Ingatlan értékbecslés</span>
      </div>

      <h1
        style={{
          margin: "22px 0 0",
          fontSize: 30,
          lineHeight: 1.18,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          color: "#fff",
        }}
      >
        {doc.title}
      </h1>
      {doc.subtitle && (
        <p style={{ margin: "8px 0 0", fontSize: 13.5, color: C.onDarkMuted }}>{doc.subtitle}</p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 18 }}>
        {doc.meta.map((m) => (
          <span
            key={m.label}
            style={{
              borderRadius: 999,
              border: `1px solid rgba(244,239,231,0.22)`,
              padding: "5px 11px",
              fontSize: 11.5,
              color: C.onDark,
            }}
          >
            <span style={{ color: C.onDarkMuted }}>{m.label}: </span>
            {m.value}
          </span>
        ))}
        <span
          style={{
            borderRadius: 999,
            border: `1px solid rgba(244,239,231,0.22)`,
            padding: "5px 11px",
            fontSize: 11.5,
            color: C.onDark,
          }}
        >
          <span style={{ color: C.onDarkMuted }}>Készült: </span>
          {dateLabel}
        </span>
      </div>
    </div>
  );
}

function Highlights({ doc }: { doc: ReportDoc }) {
  const items = reportHighlights(doc);
  if (!items.length) return null;
  const main = items.find((i) => i.accent);
  const rest = items.filter((i) => !i.accent);

  return (
    <div style={{ marginTop: 24 }}>
      {main && (
        <div
          style={{
            borderRadius: 14,
            background: `linear-gradient(120deg, ${C.coral}, #f2946f)`,
            padding: "18px 22px",
            color: "#1c1005",
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              opacity: 0.75,
            }}
          >
            {main.label}
          </div>
          <div style={{ fontSize: 27, fontWeight: 700, marginTop: 4, letterSpacing: "-0.01em" }}>
            {main.value}
          </div>
        </div>
      )}
      {rest.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          {rest.map((h) => (
            <div
              key={h.label}
              style={{
                flex: 1,
                borderRadius: 12,
                border: `1px solid ${C.line}`,
                background: C.cream,
                padding: "12px 14px",
              }}
            >
              <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.12em", color: C.muted }}>
                {h.label}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4, color: C.ink }}>
                {h.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- szakasz ------------------------------------------------------------------
export type SectionTools = {
  onChange: (id: string, patch: Partial<Omit<ReportSection, "id">>) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
  onAdd: (afterId: string) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
};

function ToolButton({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius: 999,
        border: `1px solid ${danger ? "#f0c2b6" : C.line}`,
        background: "#fff",
        color: danger ? "#b4462c" : C.muted,
        fontSize: 11,
        padding: "3px 9px",
        lineHeight: 1.6,
      }}
    >
      {label}
    </button>
  );
}

function Section({
  section,
  index,
  tools,
  highlight,
}: {
  section: ReportSection;
  index: number;
  tools?: SectionTools;
  highlight?: boolean;
}) {
  const editing = tools?.editingId === section.id;
  const dim = section.hidden;

  return (
    <section
      data-flow="1"
      style={{
        marginTop: 22,
        opacity: dim ? 0.4 : 1,
        borderRadius: highlight ? 14 : 0,
        border: highlight ? `1px solid ${C.coralSoft}` : undefined,
        background: highlight ? "#fdf3ee" : undefined,
        padding: highlight ? "16px 18px" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.coral,
            minWidth: 18,
            letterSpacing: "0.04em",
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        {editing ? (
          <input
            value={section.heading}
            onChange={(e) => tools?.onChange(section.id, { heading: e.target.value })}
            style={{
              flex: 1,
              fontSize: 15.5,
              fontWeight: 700,
              color: C.ink,
              border: `1px solid ${C.coralSoft}`,
              borderRadius: 8,
              padding: "4px 8px",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
        ) : (
          <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: C.ink, flex: 1 }}>
            {section.heading}
          </h2>
        )}
        {tools && (
          <span style={{ display: "flex", gap: 4 }}>
            <ToolButton
              label={editing ? "Kész" : "Szerkeszt"}
              onClick={() => tools.setEditingId(editing ? null : section.id)}
            />
            <ToolButton label="↑" onClick={() => tools.onMove(section.id, -1)} />
            <ToolButton label="↓" onClick={() => tools.onMove(section.id, 1)} />
            <ToolButton
              label={dim ? "Vissza" : "Elrejt"}
              onClick={() => tools.onChange(section.id, { hidden: !dim })}
            />
            <ToolButton label="+" onClick={() => tools.onAdd(section.id)} />
            <ToolButton label="Törlés" danger onClick={() => tools.onRemove(section.id)} />
          </span>
        )}
      </div>

      <div
        style={{
          height: 1,
          background: highlight ? C.coralSoft : C.line,
          margin: "10px 0 10px 28px",
        }}
      />

      <div style={{ paddingLeft: 28 }}>
        {editing ? (
          <AutoTextarea
            value={section.body}
            onChange={(v) => tools?.onChange(section.id, { body: v })}
          />
        ) : section.body.trim() ? (
          <Body text={section.body} />
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: C.muted, fontStyle: "italic" }}>
            (üres szakasz)
          </p>
        )}
      </div>
    </section>
  );
}

// --- a teljes lap -------------------------------------------------------------
export default function ReportPaper({
  doc,
  dateLabel,
  tools,
  forPdf,
}: {
  doc: ReportDoc;
  dateLabel: string;
  tools?: SectionTools;
  forPdf?: boolean;
}) {
  const visible = forPdf ? doc.sections.filter((s) => !s.hidden) : doc.sections;
  const editingIntro = tools?.editingId === "__intro";

  return (
    <div
      style={{
        width: PAPER_WIDTH,
        background: "#fff",
        color: C.ink,
        padding: PAPER_PAD,
        boxSizing: "border-box",
        fontFamily:
          "var(--font-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
      }}
    >
      <div data-flow="1">
        <Cover doc={doc} dateLabel={dateLabel} />
      </div>

      <div data-flow="1">
        <Highlights doc={doc} />
      </div>

      {(doc.intro.trim() || tools) && (
        <div data-flow="1" style={{ marginTop: 24 }}>
          <div
            style={{
              borderLeft: `3px solid ${C.coral}`,
              paddingLeft: 14,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: C.muted,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              Rövid összefoglaló
              {tools && (
                <ToolButton
                  label={editingIntro ? "Kész" : "Szerkeszt"}
                  onClick={() => tools.setEditingId(editingIntro ? null : "__intro")}
                />
              )}
            </div>
            <div style={{ marginTop: 8 }}>
              {editingIntro ? (
                <AutoTextarea
                  value={doc.intro}
                  onChange={(v) => tools?.onChange("__intro", { body: v })}
                />
              ) : doc.intro.trim() ? (
                <Body text={doc.intro} />
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: C.muted, fontStyle: "italic" }}>
                  (nincs összefoglaló)
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {visible.map((s, i) => (
        <Section
          key={s.id}
          section={s}
          index={i}
          tools={tools}
          highlight={/lokáci/i.test(s.heading)}
        />
      ))}

      <div
        data-flow="1"
        style={{
          marginTop: 30,
          paddingTop: 14,
          borderTop: `1px solid ${C.line}`,
          fontSize: 10.5,
          lineHeight: 1.6,
          color: C.muted,
        }}
      >
        {doc.closing}
        <br />
        Készítette a TWINX AI Portál · twinx.hu
      </div>
    </div>
  );
}
