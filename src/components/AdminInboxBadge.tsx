// Az „Admin" link melletti kis korall karika a fejlécben: hány elintézetlen
// megkeresés vár. CSAK akkor jelenik meg, ha van ilyen — nulla esetén semmi.
//
// Számol: nyitott (ki nem pipált) üzenetek + el nem bírált ajándékkód-jelentkezők
// + függő kredit-kérések. Forrás: /api/admin/inbox-counts (admin-only).
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function AdminInboxBadge({ className }: { className?: string }) {
  const [count, setCount] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/admin/inbox-counts")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (alive && d && typeof d.total === "number") setCount(d.total); })
        .catch(() => {});
    load();
    // Oldalváltáskor és 2 percenként frissül, hogy nyitva hagyott fülön se avuljon el.
    const t = setInterval(load, 120_000);
    return () => { alive = false; clearInterval(t); };
  }, [pathname]);

  if (count <= 0) return null;

  return (
    <span
      className={`inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-[18px] ${className ?? ""}`}
      style={{ background: "var(--twx-coral)", color: "#1c1005" }}
      title={`${count} elintézetlen megkeresés`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
