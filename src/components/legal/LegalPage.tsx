// Közös keret a jogi oldalakhoz (/aszf, /adatkezeles — D74): B arculat, felső sáv + lábléc, cím, változat és
// hatálybalépés, tartalomjegyzék, a dokumentum, és opcionálisan a „Korábbi változatok".
import type { ReactNode } from "react";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import LegalDoc, { LegalToc } from "@/components/legal/LegalDoc";
import { getSiteViewer } from "@/lib/site-preview";
import { LEGAL_EFFECTIVE } from "@/lib/legal";

export default async function LegalPage({ title, version, md, after }: { title: string; version: string; md: string; after?: ReactNode }) {
  const viewer = await getSiteViewer();
  return (
    <main className="min-h-screen bg-b-bg font-sans text-b-ink">
      <SiteHeader viewer={viewer} />
      <article className="mx-auto max-w-[860px] px-4 pb-20 pt-12 sm:px-8 sm:pt-16">
        <header className="mb-8">
          <p className="b-eyebrow mb-3">TWINX</p>
          <h1 className="font-display text-[34px] font-bold leading-[1.08] tracking-[-0.8px] sm:text-[44px]">{title}</h1>
          <p className="mt-3 text-[15px] text-b-ink-2">
            Változat: <b className="text-b-ink">{version}</b> · Hatályos: <b className="text-b-ink">{LEGAL_EFFECTIVE}</b>
          </p>
        </header>
        <LegalToc md={md} />
        <div className="mt-6"><LegalDoc md={md} /></div>
        {after}
      </article>
      <SiteFooter />
    </main>
  );
}
