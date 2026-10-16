// A 3D-modul gépi tesztjeinek futtatója (bejárás + szerkesztő-műveletek): a projekteket letölti (service role), a lib fájlokat ideiglenes mappába másolja, lefordítja, futtatja.
// Használat: node --env-file=.env.local scripts/floorplan3d-tests/run.mjs <projekt-id> [<projekt-id> ...]
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readFileSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
const ids = process.argv.slice(2);
if (!ids.length) { console.error("Adj meg legalább egy projekt-azonosítót."); process.exit(1); }
const root = resolve(import.meta.dirname, "..", "..");
const T = join(root, ".fp-test");
rmSync(T, { recursive: true, force: true }); mkdirSync(join(T, "src"), { recursive: true });
for (const f of ["plan", "geometry", "scene", "furniture", "camera", "walk", "catalog", "edit"]) {
  writeFileSync(join(T, "src", `${f}.ts`), readFileSync(join(root, "src/lib/floorplan3d", `${f}.ts`), "utf8").replaceAll("@/lib/floorplan3d/", "./"));
}
// a sablonok (.ts.tpl) — a projekt tsc-je ne fordítsa őket
const TESTS = ["walk-check", "edit-check"];
for (const t of TESTS) copyFileSync(join(import.meta.dirname, `${t}.ts.tpl`), join(T, `${t}.ts`));
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const rows = [];
for (const id of ids) { const { data, error } = await s.from("floorplan_projects").select("id, plan, furnishing").eq("id", id).single(); if (error) { console.error(id, error.message); process.exit(1); } rows.push(data); }
writeFileSync(join(T, "data.json"), JSON.stringify(rows));
try {
  execSync(`npx tsc ${TESTS.map((t) => `${t}.ts`).join(" ")} --outDir out --module commonjs --target es2020 --esModuleInterop --skipLibCheck`, { cwd: T, stdio: "inherit" });
  for (const t of TESTS) { console.log(`— ${t}`); execSync(`node out/${t}.js data.json`, { cwd: T, stdio: "inherit" }); }
} catch { process.exitCode = 1; } finally { rmSync(T, { recursive: true, force: true }); }
