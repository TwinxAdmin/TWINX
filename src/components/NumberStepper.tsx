// Kis darabszám-választó: billentyűzetről is beírható, és +/− gombbal is
// állítható. Azért nem `type="number"`, mert a natív nyíl-gombok böngészőnként
// máshogy néznek ki és mobilon szinte használhatatlanok — így viszont minden
// eszközön ugyanaz a méret és a kattintható felület.
"use client";

export default function NumberStepper({
  label, value, onChange, min = 0, max = 20, hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  hint?: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const btn = "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg font-semibold transition-colors disabled:opacity-35";

  return (
    <div className="min-w-0">
      {/* Fix magasságú címke: így a több oszlopban egymás mellett álló
          számlálók akkor sem csúsznak el, ha az egyik felirat két sorba tör. */}
      <p className="flex min-h-[2.2em] items-end text-xs font-medium leading-tight" style={{ color: "var(--twx-ink-muted)" }}>
        {label}
      </p>
      <div className="mt-1.5 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= min}
          aria-label={`${label} csökkentése`}
          className={btn}
          style={{ border: "1px solid var(--twx-line)", background: "#fff" }}
        >
          −
        </button>

        <input
          type="text"
          inputMode="numeric"
          value={String(value)}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            onChange(digits === "" ? min : clamp(Number(digits)));
          }}
          onFocus={(e) => e.currentTarget.select()}
          aria-label={label}
          className="h-10 w-full min-w-0 flex-1 rounded-lg text-center text-base font-semibold outline-none"
          style={{ border: "1px solid var(--twx-line)", background: "#fff", color: "var(--twx-ink)" }}
        />

        <button
          type="button"
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          aria-label={`${label} növelése`}
          className={btn}
          style={{ border: "1px solid var(--twx-coral)", background: "var(--twx-coral-soft)", color: "#7a2e17" }}
        >
          +
        </button>

        {hint && (
          <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{hint}</span>
        )}
      </div>
    </div>
  );
}
