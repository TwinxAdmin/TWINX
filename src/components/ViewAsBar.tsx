// Lengő nézet-váltó sáv a JOBB alsó sarokban (középen a kredit-sáv van).
//   • Admin: Admin / Felhasználó / „Kit nézzek?" — „így látja Y felhasználó / X cég" (3f; terv 12 / 1.):
//     a kiválasztott személy valódi hozzáféréseivel; előnézetben a beküldés tiltott (middleware).
//   • Irodai létrehozó / vezető: Vezető / Kolléga / Ki — „így látja a kolléga", illetve
//     „Ki" = mintha egyetlen irodának sem lenne tagja (csak megjelenítés).
// Mindkettő CSAK megjelenítés: a jogosultságot és a kreditlevonást a szerver a valódi
// szerepkör / tagság alapján dönti el. Előnézet közben a sáv feltűnő (korall), hogy ne
// lehessen elfelejteni, miért látszik másképp a felület.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { showToast } from "@/components/Toast";

type View = "admin" | "user";
type Hit = { kind: "user" | "company"; id: string; userId: string | null; title: string; sub: string };

const ROLE_OPTIONS: { id: View; label: string }[] = [
  { id: "admin", label: "Admin" },
  { id: "user", label: "Felhasználó" },
];

type Props = {
  current: View | null;                     // null = nem admin (nincs szerepkör-váltó)
  /** Felhasználó szerinti előnézetben a megjelenített személy (3f). */
  asUser?: { name: string } | null;
  office?: { preview: boolean; none?: boolean } | null;   // null / hiány = nem irodai vezető (nincs irodai váltó)
};

export default function ViewAsBar({ current, asUser = null, office = null }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);

  // Kereső: cégek (→ a cégvezető vagy az első tag) és felhasználók.
  useEffect(() => {
    if (!picker) return;
    const t = setTimeout(() => {
      fetch(`/api/admin/view-as?q=${encodeURIComponent(q)}`).then((r) => r.json()).then((d) => setHits(d.hits ?? [])).catch(() => setHits([]));
    }, 200);
    return () => clearTimeout(t);
  }, [picker, q]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/view-as", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "A nézetváltás nem sikerült."); }
      setPicker(false);
      window.location.reload();
    } catch (e) {
      showToast((e as Error).message, "error");
      setBusy(false);
    }
  }

  async function pickRole(v: View) {
    if ((v === current && !asUser) || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/view-as", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ view: v === "admin" ? null : v }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "A nézetváltás nem sikerült.");
      }
      router.refresh();
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  type OfficeView = "manager" | "member" | "none";
  const officeView: OfficeView = office?.none ? "none" : office?.preview ? "member" : "manager";

  async function pickOffice(v: OfficeView) {
    if (!office || v === officeView || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/office/view-as", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ view: v === "manager" ? null : v }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "A nézetváltás nem sikerült.");
      }
      // Az irodai felület kliensoldalon tölt be — teljes újratöltéssel jön az új nézet.
      window.location.reload();
    } catch (e) {
      showToast((e as Error).message, "error");
      setBusy(false);
    }
  }

  const rolePreview = (current !== null && current !== "admin") || !!asUser;
  const officePreview = officeView !== "manager";
  const previewing = rolePreview || officePreview;

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="fixed bottom-20 right-0 z-40 flex justify-end px-4 lg:bottom-0 lg:pb-4"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="flex max-w-[calc(100vw-2rem)] flex-col gap-1.5 rounded-2xl px-3 py-2 shadow-lg"
        style={{
          pointerEvents: "auto",
          background: previewing ? "#7a2e17" : "var(--twx-dark)",
          color: "#fff",
          border: previewing ? "2px solid var(--twx-coral)" : "1px solid rgba(255,255,255,0.12)",
        }}
      >
        {current !== null && (
          <Row label={asUser ? "Így látja:" : rolePreview ? "Előnézet — partner:" : "Nézet:"}>
            {ROLE_OPTIONS.map((o) => (
              <Seg key={o.id} on={!asUser && o.id === current} dark={previewing} disabled={busy} onClick={() => void pickRole(o.id)}>{o.label}</Seg>
            ))}
            <Seg on={!!asUser} dark={previewing} disabled={busy} onClick={() => { setQ(""); setHits(null); setPicker((v) => !v); }}>
              <span className="inline-block max-w-[120px] truncate align-bottom">{asUser ? asUser.name : "Kit nézzek?"}</span>
            </Seg>
          </Row>
        )}
        {asUser && <p className="pl-1 text-[11px]" style={{ opacity: 0.85 }}>Előnézet — a beküldés le van tiltva.</p>}

        {picker && (
          <div className="mt-1 w-[320px] max-w-full rounded-xl p-2" style={{ background: "#1b1815", border: "1px solid rgba(255,255,255,0.12)" }}>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cég, név vagy e-mail"
              className="w-full rounded-lg px-3 py-2 text-xs outline-none" style={{ background: "#121110", border: "1px solid #3A322C", color: "#fff" }} />
            <ul className="mt-2 h-56 overflow-y-auto">
              {hits === null ? <li className="px-2 py-2 text-xs" style={{ opacity: 0.7 }}>Betöltés…</li>
                : hits.length === 0 ? <li className="px-2 py-2 text-xs" style={{ opacity: 0.7 }}>Nincs találat.</li>
                : hits.map((h) => (
                  <li key={`${h.kind}-${h.id}`}>
                    <button type="button" disabled={busy || !h.userId} onClick={() => h.userId && void post({ asUserId: h.userId })}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white/5 disabled:opacity-40">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{h.title}</span>
                        <span className="block truncate" style={{ opacity: 0.65 }}>{h.sub}</span>
                      </span>
                      <span className="flex-none rounded-full px-1.5 py-0.5 text-[10px]" style={{ background: "rgba(255,255,255,0.1)" }}>{h.kind === "company" ? "Cég" : "Felh."}</span>
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {office && (
          <Row label={officePreview ? "Előnézet — iroda:" : "Iroda:"}>
            <Seg on={officeView === "manager"} dark={previewing} disabled={busy} onClick={() => void pickOffice("manager")}>Vezető</Seg>
            <Seg on={officeView === "member"} dark={previewing} disabled={busy} onClick={() => void pickOffice("member")}>Kolléga</Seg>
            {/* „Ki": úgy látod az oldalt, mintha egyetlen irodának sem lennél tagja */}
            <Seg on={officeView === "none"} dark={previewing} disabled={busy} onClick={() => void pickOffice("none")}>Ki</Seg>
          </Row>
        )}
      </div>
    </motion.div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="w-[118px] flex-none pl-1 text-xs font-medium" style={{ opacity: 0.85 }}>{label}</span>
      <div className="flex gap-1">{children}</div>
    </div>
  );
}

function Seg({ on, dark, disabled, onClick, children }: {
  on: boolean; dark: boolean; disabled: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-pressed={on}
      className="rounded-xl px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
      style={on
        ? { background: "#fff", color: dark ? "#7a2e17" : "var(--twx-dark)" }
        : { background: "rgba(255,255,255,0.12)", color: "#fff" }}>
      {children}
    </button>
  );
}
