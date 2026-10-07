// Gombok a „Saját moduljaim” oldalon: ismertető + igénylés (a modális ablakokat nyitják).
"use client";

export default function CustomModuleActions() {
  return (
    <div className="flex flex-wrap gap-2">
      <a href="/dashboard/egyedi-modul"
        className="rounded-full px-4 py-2 text-sm font-medium" style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
        Mi az egyedi modul?
      </a>
      <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("open-b2b"))}
        className="rounded-full px-4 py-2 text-sm font-semibold" style={{ background: "var(--twx-coral)", color: "#1c1005" }}>
        Egyedi modul igénylése
      </button>
    </div>
  );
}
