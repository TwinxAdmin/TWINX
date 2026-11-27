// twinx.hu/aszf — Általános Szerződési Feltételek, 2026-12-v1 (D74, 9. lépés; szöveg: src/content/legal/aszf-2026-12-v1.ts,
// forrás: docs/terv/31-aszf.md). A korábbi (kredites) 1.1-es változat archívban: /aszf/1-1.
import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";
import ASZF_MD from "@/content/legal/aszf-2026-12-v1";
import { ASZF_ARCHIVE, ASZF_VERSION } from "@/lib/legal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Általános Szerződési Feltételek — TWINX",
  description: "A TWINX szolgáltatás általános szerződési feltételei.",
};

export default function AszfPage() {
  return (
    <LegalPage title="Általános Szerződési Feltételek" version={ASZF_VERSION} md={ASZF_MD}
      after={
        <section className="mt-12 border-t border-b-line pt-6">
          <h2 className="text-[15px] font-semibold text-b-ink">Korábbi változatok</h2>
          <ul className="mt-2 space-y-1 text-[15px] text-b-ink-2">
            {ASZF_ARCHIVE.map((a) => (
              <li key={a.version}>
                <a href={a.href} className="text-b-accent-ink underline underline-offset-2">ÁSZF {a.version}</a> — hatályos volt: {a.effective}-től ({a.note})
              </li>
            ))}
          </ul>
        </section>
      } />
  );
}
