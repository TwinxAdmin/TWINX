// NewsletterCheckbox — NEM kötelező, ALAPBÓL ÜRES hírlevél-pipa a regisztrációnál (felugró ablak + /register oldal).
// Bejelölve a fiók „kér hírlevelet" (profiles.newsletter + időpont), és felkerül a Brevo „Hírlevél" listájára.
// Megerősítő e-mail nincs; a Fiók beállításoknál bármikor kikapcsolható.
"use client";

export default function NewsletterCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-snug">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 flex-none" style={{ accentColor: "var(--twx-coral)" }} />
      <span>Kérek hírlevelet a TWINX újdonságairól és akcióiról.</span>
    </label>
  );
}
