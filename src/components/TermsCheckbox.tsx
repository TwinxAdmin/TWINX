// TermsCheckbox — kötelező „Elfogadom az ÁSZF-et" jelölőnégyzet a regisztrációnál (felugró ablak + /register oldal).
// Az ÁSZF új lapon nyílik, hogy a kitöltött űrlap ne vesszen el.
"use client";

export default function TermsCheckbox({ checked, onChange, error }: { checked: boolean; onChange: (v: boolean) => void; error?: string }) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-snug">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-none" style={{ accentColor: "var(--twx-coral)" }} aria-required="true" />
        <span>
          Elfogadom az{" "}
          <a href="/aszf" target="_blank" rel="noopener" className="font-semibold underline" style={{ color: "var(--twx-coral)" }}>
            Általános Szerződési Feltételeket (ÁSZF)
          </a>
          .
        </span>
      </label>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
