// Egyszeri, kézzel futtatott újraküldés: megerősítő levél a meg nem erősített, e-mailes fiókoknak (pl. egy kampány után).
//
// Futtatás a projekt gyökeréből (a kulcsok CSAK a .env.local-ból jönnek, a szkript nem írja ki őket):
//   node --env-file=.env.local scripts/resend-confirmations.mjs                → DRY-RUN: csak lista, nem küld
//   node --env-file=.env.local scripts/resend-confirmations.mjs --all          → DRY-RUN az összes meg nem erősített fiókra
//   node --env-file=.env.local scripts/resend-confirmations.mjs --send         → KÜLDÉS az ingatlan landinges fiókoknak
//   node --env-file=.env.local scripts/resend-confirmations.mjs --send --all   → KÜLDÉS az összes meg nem erősített fióknak
//
// A szkript csak olvas és levelet küld: felhasználót, kreditet, signup_source-t nem módosít (a kreditet a DB-trigger már
// a regisztrációkor megadta). Egy új levél érvényteleníti ugyanannak a címnek a korábbi megerősítő linkjét.
//
// A levél linkje: a landinges regisztráció sem ad meg emailRedirectTo-t, ezért itt sem (ugyanoda visz). A flowType azért
// pkce, mint a regisztrációnál, hogy a kattintás után ne kerüljön belépési token a címsorba; a címzett böngészőjében nincs
// meg a pár, ezért a megerősítés után maga lép be. A közös src/lib/auth-confirmation.ts itt szándékosan nincs használva: az
// a címenkénti korlátot kifelé sikernek veszi, itt viszont minden hibát ki kell írni.
import { createClient } from "@supabase/supabase-js";

const LANDING_SOURCE = "ingatlan-landing";
const PAUSE_MS = 2000;
const PER_PAGE = 200;
const KNOWN_FLAGS = new Set(["--send", "--all"]);

const flags = process.argv.slice(2);
const unknown = flags.filter((f) => !KNOWN_FLAGS.has(f));
if (unknown.length) {
  console.error(`Ismeretlen kapcsoló: ${unknown.join(", ")} (használható: --send, --all)`);
  process.exit(1);
}
const send = flags.includes("--send");
const includeAll = flags.includes("--all");

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
if (!url || !serviceKey) {
  console.error("Hiányzó környezeti változó. Így futtasd: node --env-file=.env.local scripts/resend-confirmations.mjs");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, flowType: "pkce" },
});

/** m***@gmail.com — a teljes cím soha nem kerül a kimenetre. */
function mask(email) {
  const [local, domain] = email.split("@");
  return `${(local ?? "").slice(0, 1)}***@${domain ?? "?"}`;
}

async function unconfirmedEmailUsers() {
  const found = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) throw new Error(`A felhasználók lekérése nem sikerült: ${error.message}`);
    for (const user of data.users) {
      if (!user.email_confirmed_at && user.email && user.app_metadata?.provider === "email") found.push(user);
    }
    if (data.users.length < PER_PAGE) return found;
  }
}

async function signupSources(ids) {
  const sources = new Map();
  for (let i = 0; i < ids.length; i += PER_PAGE) {
    const { data, error } = await supabase.from("profiles").select("id, signup_source").in("id", ids.slice(i, i + PER_PAGE));
    if (error) throw new Error(`A profilok lekérése nem sikerült: ${error.message}`);
    for (const row of data) sources.set(row.id, row.signup_source);
  }
  return sources;
}

async function main() {
  const users = await unconfirmedEmailUsers();
  const sources = await signupSources(users.map((u) => u.id));
  const rows = users
    .map((u) => ({ email: u.email, createdAt: u.created_at, source: sources.get(u.id) ?? null }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const recipients = includeAll ? rows : rows.filter((r) => r.source === LANDING_SOURCE);
  const left = rows.length - recipients.length;

  console.log(`Mód: ${send ? "KÜLDÉS" : "DRY-RUN (nem küld semmit)"} | Kör: ${includeAll ? "minden meg nem erősített fiók" : LANDING_SOURCE}`);
  console.log(`Címzettek: ${recipients.length}${left ? ` (további ${left} fiók csak --all kapcsolóval kerülne be)` : ""}\n`);
  for (const r of recipients) {
    console.log(`  ${mask(r.email).padEnd(36)} ${r.createdAt.slice(0, 10)}  ${r.source ?? "(nincs forrás)"}`);
  }

  if (!send) {
    console.log("\nNem ment ki levél. Küldéshez add hozzá a --send kapcsolót.");
    return;
  }

  console.log("");
  let sent = 0;
  let failed = 0;
  for (const [i, r] of recipients.entries()) {
    if (i > 0) await new Promise((done) => setTimeout(done, PAUSE_MS));
    const { error } = await supabase.auth.resend({ type: "signup", email: r.email });
    if (error) {
      failed++;
      console.log(`  HIBA    ${mask(r.email)}: ${error.message.replaceAll(r.email, mask(r.email))}`);
    } else {
      sent++;
      console.log(`  ELMENT  ${mask(r.email)}`);
    }
  }
  console.log(`\nÖsszesítés: ${sent} levél ment ki, ${failed} hibázott.`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
