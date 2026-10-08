// Lengő nézet-váltó sáv a JOBB alsó sarokban (középen a kredit-sáv van).
//   • Admin: Admin / Sales / Felhasználó — „így látja a partner" előnézet.
//   • Irodai létrehozó / vezető: Vezető / Kolléga / Ki — „így látja a kolléga", illetve
//     „Ki" = mintha egyetlen irodának sem lenne tagja (csak megjelenítés).
// Mindkettő CSAK megjelenítés: a jogosultságot és a kreditlevonást a szerver a valódi
// szerepkör / tagság alapján dönti el. Előnézet közben a sáv feltűnő (korall), hogy ne
// lehessen elfelejteni, miért látszik másképp a felület.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { showToast } from "@/components/Toast";

type View = "admin" | "user" | "sales";

const ROLE_OPTIONS: { id: View; label: string }[] = [
  { id: "admin", label: "Admin" },
  { id: "sales", label: "Sales" },
  { id: "user", label: "Felhasználó" },
];

type Props = {
  current: View | null;                     // null = nem admin (nincs szerepkör-váltó)
  office?: { preview: boolean; none?: boolean } | null;   // null / hiány = nem irodai vezető (nincs irodai váltó)
};

export default function ViewAsBar({ current, office = null }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function pickRole(v: View) {
    if (v === current || busy) return;
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

  const rolePreview = current !== null && current !== "admin";
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
          <Row label={rolePreview ? "Előnézet — partner:" : "Nézet:"}>
            {ROLE_OPTIONS.map((o) => (
              <Seg key={o.id} on={o.id === current} dark={previewing} disabled={busy} onClick={() => void pickRole(o.id)}>{o.label}</Seg>
            ))}
          </Row>
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
