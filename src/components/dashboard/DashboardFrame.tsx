// A dashboard tartalmi kerete. Az ÚJ felület kezdőlapja (/dashboard) a B arculat szélesebb, 1200 px-es rácsát kapja
// (terv 29 / 5., minta: docs/terv/design/B-kezdolap.dc.html); a modulok és a régi felület a megszokott kereten maradnak.
"use client";

import { usePathname } from "next/navigation";

export default function DashboardFrame({ newUi, children }: { newUi: boolean; children: React.ReactNode }) {
  const home = usePathname() === "/dashboard";
  return (
    <div className={newUi && home ? "mx-auto max-w-[1200px] px-4 pb-16 pt-6 sm:px-8" : "mx-auto max-w-5xl px-6 py-10 pb-28"}>
      {children}
    </div>
  );
}
