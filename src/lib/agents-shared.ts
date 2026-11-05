// Admin → AI-ügynökök: közös nevek és címkék. Kliensen is használható (nincs benne titok).
// Új ügynök: egy sor az AGENT_INFO-ba; a többi automatikusan jön abból, amit az ügynök a monitor végpontra küld.
export const AGENT_MONITOR_MIGRATION = "20261105180000_agent-monitor.sql";

/** Ennyi perc csend után számít úgy, hogy az ügynök nem jelentkezik (5 percenként jelent). */
export const AGENT_OFFLINE_MINUTES = 15;
export const AGENT_EVENTS_KEEP_DAYS = 90;

export const AGENT_INFO: Record<string, { name: string; description: string }> = {
  activation: {
    name: "Aktiváló ügynök",
    description: "Besorolja a felhasználókat, levelet javasol nekik, és a jóváhagyásod után kiküldi.",
  },
};

export const AGENT_EVENT_LABEL: Record<string, string> = {
  classify: "Napi besorolás",
  propose: "Javaslat Telegramra",
  approve_one: "Jóváhagyva",
  approve_all: "Mind jóváhagyva",
  skip_one: "Kihagyva",
  skip_day: "Ma ne",
  deadline: "Lejárt a határidő",
  dry_send: "Próbaküldés",
  sent: "Levél elküldve",
  send_skip: "Küldés előtt kihagyva",
  send_error: "Küldési hiba",
  feedback_text: "Visszajelzés",
  weekly: "Heti jelentés",
  telegram_denied: "Idegen jóváhagyási kísérlet",
  error: "Hiba",
};

/** Ezek számítanak hibának: az „Utolsó hiba” és a napló szűrője ezekből dolgozik. */
export const AGENT_ERROR_KINDS = ["error", "send_error", "telegram_denied"];

export const OUTBOX_STATUSES = ["javasolt", "jóváhagyva", "elküldve", "kihagyva", "elcsúszott", "hiba"] as const;

export type AgentLetter = { user_id: string; name: string; letter: string; state: string; status: string; at: string | null };
export type AgentSummary = {
  day?: string;
  letters?: Omit<AgentLetter, "name">[];
  states?: Record<string, number> | null;
  schedule?: { at: string; label: string }[];
};
export type AgentStatusRow = { agent: string; dry_run: boolean; last_seen_at: string; summary: AgentSummary | null };
export type AgentEventRow = { id: number; agent: string; dry_run: boolean; kind: string; message: string | null; created_at: string };
