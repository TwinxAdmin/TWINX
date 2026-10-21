// dashboard/page.tsx — Portál Központ.
// Server Component: kreditblokk + kategória-áttekintés + a legutóbbi
// 50 tevékenység (usage_history, LIMIT 50). Az RLS csak a saját sorokat adja vissza.
import { createClient } from "@/lib/supabase/server";
import { visibleCategories, visibleModules } from "@/lib/catalog";
import RecentActivity from "@/components/RecentActivity";
import { activityTitle, featureLabel } from "@/lib/activity";
import { officeNonePreview, resolveViewContext } from "@/lib/view-as";
import { premium3dStatus } from "@/lib/premium3d";
import WelcomeHero from "@/components/dashboard/WelcomeHero";
import CreditBlock from "@/components/dashboard/CreditBlock";
import { loadDockState } from "@/lib/office-dock";
import { WELCOME_CREDITS } from "@/lib/onboarding";

type HistoryRow = {
  id: string;
  feature_used: string;
  input_data: Record<string, unknown> | null;
  output_file_url: string | null;
  created_at: string;
  services: { name: string } | null;
};

export default async function DashboardHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: me } = user
    ? await supabase.from("profiles").select("role, full_name, invite_code").eq("id", user.id).single()
    : { data: null };
  // Adminként előnézetbe lehet váltani (lásd lib/view-as.ts) — a megjelenítés
  // ilyenkor a választott szerepkört követi, a jogosultságok nem változnak.
  const view = await resolveViewContext(me?.role as string | undefined);
  const role = view.role;
  const isAdmin = role === "admin"; // korlátlan, prezentációs mód (nincs kreditlevonás)
  const catalogView = { isAdmin, premium3d: (await premium3dStatus()).status };
  const isSales = role === "sales"; // az admin által biztosított keretet fogyasztja

  // Időszakok a folyamat-számláláshoz (hét = hétfőtől, hónap = 1-jétől).
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const sinceMonday = (now.getDay() + 6) % 7;
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - sinceMonday).toISOString();

  // FONTOS: az admin RLS-ben minden sort lát, ezért mindenhol EXPLICIT a saját user-re szűrünk,
  // hogy a személyes dashboard (előzmény + folyamat-számláló) tényleg a sajátot mutassa.
  const uid = user?.id ?? "__none__";

  const [{ data: wallet }, { data: history }, weekRes, monthRes] = await Promise.all([
    user
      ? supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("usage_history")
      .select("id, feature_used, input_data, output_file_url, created_at, services(name)")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(50),
    isAdmin
      ? supabase.from("usage_history").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", startOfWeek)
      : Promise.resolve({ count: 0 }),
    isAdmin
      ? supabase.from("usage_history").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", startOfMonth)
      : Promise.resolve({ count: 0 }),
  ]);

  const balance = (wallet?.balance as number | undefined) ?? 0;

  // Irodai módban dolgozó tag: a kreditblokk az irodai keretét mutatja (mint a lenti kredit-sáv),
  // különben 0 saját kreditnél tévesen feltöltésre hívnánk. A „Nincs iroda" előnézet ezt is kikapcsolja.
  const dock = user && !isAdmin && !isSales ? await loadDockState(user.id) : null;
  const officeNone = dock?.isManager ? await officeNonePreview() : false;
  const officeAllowance = dock && !officeNone && dock.mode === "office" ? dock.allowance : undefined;
  const weekCount = (weekRes as { count: number | null }).count ?? 0;
  const monthCount = (monthRes as { count: number | null }).count ?? 0;
  const historyList = (history ?? []) as unknown as HistoryRow[];

  // Ha még semmit nem használt, és az egyenlege pont az induló keret, akkor
  // érintetlen próbakredit van nála — ezt érdemes kiemelni.
  const hasWelcomeCredits = historyList.length === 0 && balance > 0 && balance <= WELCOME_CREDITS;

  // A legtöbbet használt modul — a „Folytasd" sáv fejlécében jelenik meg.
  const featureCounts = new Map<string, number>();
  for (const h of historyList) {
    featureCounts.set(h.feature_used, (featureCounts.get(h.feature_used) ?? 0) + 1);
  }
  const topFeatureKey = [...featureCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const topFeature = topFeatureKey ? featureLabel(topFeatureKey) : null;
  const firstName = String(me?.full_name ?? "").trim().split(/\s+/).filter(Boolean).slice(-1)[0] ?? "";

  return (
    <main className="space-y-10">
      {/* A lap címe a képernyőolvasóknak; látványban a kreditblokk nyit (design/portal-vegleges.html). */}
      <h1 className="sr-only">Portál Központ</h1>

      {/* 1) Kreditblokk — mindenkinek ugyanaz a felépítés, a tartalom a szerepkörhöz igazodik. */}
      {isAdmin ? (
        <CreditBlock mode="admin" weekCount={weekCount} monthCount={monthCount} />
      ) : isSales ? (
        <CreditBlock mode="sales" balance={balance} />
      ) : officeAllowance !== undefined ? (
        <CreditBlock mode="office" allowance={officeAllowance} />
      ) : (
        <CreditBlock mode="user" balance={balance} canRedeem={!me?.invite_code} />
      )}

      {/* Vizuális nyitány: üdvözlés + első lépések + modul-vitrin.
          A user kérése szerint a fekete sáv ALATT, a tevékenység-lista FÖLÖTT. */}
      <WelcomeHero
        firstName={firstName}
        balance={balance}
        hasWelcomeCredits={hasWelcomeCredits}
      />

      {/* „Folytasd, ahol abbahagytad" — a saját munkák bélyegképes sávja.
          Előrébb került a kategóriáknál: a visszatérő partnert a SAJÁT anyaga
          érdekli, nem a kínálat leírása. */}
      <RecentActivity
        topFeature={topFeature}
        items={historyList.map((h) => ({
          id: h.id,
          title: activityTitle(h.feature_used, h.input_data, h.created_at),
          typeLabel: featureLabel(h.feature_used),
          output_file_url: h.output_file_url,
          created_at: h.created_at,
        }))}
      />

      {/* Csoportok — a lap aljára, áttekintésnek. Folyamat szerint (nem iparág
          szerint), és a kártyáról egy kattintással el lehet érni a modulokat. */}
      <section>
        <h2 className="font-display text-xl font-medium">Mit szeretnél csinálni?</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visibleCategories(catalogView).map((cat) => (
            <div key={cat.slug} className="twx-card flex flex-col p-5"
              style={cat.premium ? { background: "linear-gradient(150deg,#2a221b,#1a1612)", border: "1px solid rgba(212,170,92,0.35)", color: "#F4EFE7" } : undefined}>
              <h3 className="font-display text-lg font-medium" style={cat.premium ? { color: "#F3D9A4" } : undefined}>{cat.label}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: cat.premium ? "#CFC6BB" : "var(--twx-ink-muted)" }}>
                {cat.blurb}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {visibleModules(cat, false, catalogView).map((m) => (
                  <a
                    key={m.href}
                    href={m.href}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
                    style={cat.premium
                      ? { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(212,170,92,0.35)", color: "#F4EFE7" }
                      : { background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}
                  >
                    {m.label}
                    {m.badge && (
                      <span className="rounded-full px-1.5 py-px text-[10px] font-extrabold"
                        style={m.badge === "Hamarosan" ? { background: "linear-gradient(135deg,#F3D9A4,#D4AA5C)", color: "#2a1d0e" } : { background: "var(--twx-coral)", color: "#1c1005" }}>{m.badge}</span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

    </main>
  );
}
