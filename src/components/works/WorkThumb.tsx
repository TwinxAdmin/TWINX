// WorkThumb — egységes bélyegkép egy munkához (kép / videó első képkockája / PDF / egyéb).
"use client";

import { workKind } from "@/components/works/WorkViewer";

export default function WorkThumb({ url, title }: { url: string | null; title?: string }) {
  const k = workKind(url);
  if (k === "image" && url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" loading="lazy" className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]" />;
  }
  if (k === "video" && url) {
    return (
      <span className="relative block h-full w-full" style={{ background: "#121110" }}>
        {/* az első képkocka mint borító — csak metaadatot tölt, nem a teljes videót */}
        <video src={`${url}#t=0.5`} muted playsInline preload="metadata" className="h-full w-full object-cover opacity-90" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110"
            style={{ background: "rgba(240,138,104,0.92)", color: "#1C1A17", boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5.5v13l11-6.5-11-6.5Z" /></svg>
          </span>
        </span>
      </span>
    );
  }
  if (k === "pdf") {
    // dokumentum-lap: fehér „papír" a cím első soraival — a PDF-ek így ránézésre is megkülönböztethetők
    return (
      <span className="flex h-full w-full items-end justify-center overflow-hidden pt-5" style={{ background: "linear-gradient(160deg, #EFE7DD, #E4D8CA)" }}>
        <span className="relative flex h-[92%] w-[62%] flex-col gap-1.5 rounded-t-md bg-white px-3 pt-3 shadow-[0_6px_20px_rgba(28,24,21,0.18)] transition-transform duration-500 group-hover:-translate-y-1">
          <span className="h-1.5 w-8 rounded-full" style={{ background: "#F08A68" }} />
          <span className="line-clamp-3 text-[9px] font-bold leading-[12px]" style={{ color: "#1C1A17" }}>{title ?? "Dokumentum"}</span>
          {[90, 100, 75, 95, 60].map((w, i) => (
            <span key={i} className="h-[3px] rounded-full" style={{ width: `${w}%`, background: "#EAE2D8" }} />
          ))}
          <span className="absolute bottom-2 right-2 rounded px-1 text-[8px] font-bold" style={{ background: "#FBE1D6", color: "#A8411F" }}>PDF</span>
        </span>
      </span>
    );
  }
  return (
    <span className="flex h-full w-full items-center justify-center" style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
      <span className="text-sm font-bold">FÁJL</span>
    </span>
  );
}
