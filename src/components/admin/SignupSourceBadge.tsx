// Admin: honnan regisztrált a felhasználó — kis címke a listákon és a részletező ablakban. A LinkedInről érkezők saját logót kapnak.
import { LINKEDIN_SIGNUP_SOURCE, SIGNUP_SOURCE_LABEL } from "@/lib/onboarding";

export const LINKEDIN_BLUE = "#0A66C2";

function LinkedinLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3 flex-none" aria-hidden>
      <rect width="24" height="24" rx="4" fill={LINKEDIN_BLUE} />
      <path fill="#fff" d="M7.1 9.6H4.6V19h2.5V9.6ZM5.9 5a1.45 1.45 0 1 0 0 2.9 1.45 1.45 0 0 0 0-2.9Zm13.5 8.6c0-2.8-1.5-4.2-3.5-4.2-1.6 0-2.3.9-2.7 1.5V9.6h-2.5V19h2.5v-5.1c0-1.3.6-2.2 1.8-2.2 1.2 0 1.8.9 1.8 2.2V19h2.6v-5.4Z" />
    </svg>
  );
}

export default function SignupSourceBadge({ source, fallback, className = "" }: {
  source: string | null | undefined;
  /** Ismeretlen forráskódnál ezt írjuk ki (ha nincs, a címke elmarad). */
  fallback?: string | null;
  className?: string;
}) {
  const label = source ? SIGNUP_SOURCE_LABEL[source] ?? fallback : null;
  if (!label) return null;
  const linkedin = source === LINKEDIN_SIGNUP_SOURCE;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${className}`}
      style={linkedin ? { background: "#E3EEF9", color: "#084f96" } : { background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
      {linkedin ? <LinkedinLogo /> : <span aria-hidden>🎁</span>} {label}
    </span>
  );
}
