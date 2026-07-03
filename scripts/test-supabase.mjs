// Supabase kapcsolat + séma teszt.
// Futtatás a projekt gyökeréből:  node --env-file=.env.local scripts/test-supabase.mjs

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("❌ Hiányzó env: NEXT_PUBLIC_SUPABASE_URL vagy NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };
const tables = ["profiles", "services", "company_access", "user_credits", "usage_history"];

console.log(`🔗 Projekt: ${url}\n`);

// 1) Elérhetőség
try {
  const res = await fetch(`${url}/auth/v1/health`, { headers });
  console.log(res.ok ? "✅ Auth health OK" : `⚠️  Auth health HTTP ${res.status}`);
} catch (e) {
  console.error("❌ Nem érhető el a Supabase:", e.message);
  process.exit(1);
}

// 2) Táblák léteznek-e (RLS miatt anon kulccsal üres tömb a jó válasz)
console.log("\n📦 Séma (táblák) ellenőrzése:");
for (const t of tables) {
  try {
    const res = await fetch(`${url}/rest/v1/${t}?select=*&limit=1`, { headers });
    if (res.ok) {
      console.log(`  ✅ ${t.padEnd(16)} létezik (RLS aktív)`);
    } else if (res.status === 404) {
      console.log(`  ❌ ${t.padEnd(16)} NEM létezik — futtasd le a schema.sql-t`);
    } else {
      const body = await res.text();
      console.log(`  ⚠️  ${t.padEnd(16)} HTTP ${res.status} — ${body.slice(0, 120)}`);
    }
  } catch (e) {
    console.log(`  ❌ ${t.padEnd(16)} hiba: ${e.message}`);
  }
}
console.log("\nKész.");
