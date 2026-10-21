// Sales hívásnapló — a kliens és a szerver KÖZÖS része (állapotok, típusok). Szerveroldali kód nincs benne.
export const CALL_NOTES_MIGRATION_NAME = "20261021120000_customer-call-notes.sql";

export const CALL_STATUSES = [
  { value: "talked", label: "Beszéltünk" },
  { value: "no_answer", label: "Nem vette fel" },
  { value: "callback", label: "Visszahívni" },
  { value: "interested", label: "Érdeklődik" },
  { value: "not_interested", label: "Nem érdekli" },
] as const;
export type CallStatus = (typeof CALL_STATUSES)[number]["value"];
export const callStatusLabel = (s: string) => CALL_STATUSES.find((x) => x.value === s)?.label ?? s;
export const isCallStatus = (s: unknown): s is CallStatus => CALL_STATUSES.some((x) => x.value === s);

export type CallNote = {
  id: string;
  status: CallStatus;
  note: string | null;
  callbackOn: string | null; // ÉÉÉÉ-HH-NN
  authorName: string | null;
  createdAt: string;
};
/** A listába: az utolsó bejegyzés ügyfelenként. */
export type LastCall = { status: CallStatus; at: string; callbackOn: string | null };

