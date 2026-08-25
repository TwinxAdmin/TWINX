// Sablon-előnézet a videó-varázsló Sablon lépéséhez.
// A választott ARÁNYBAN (9:16 / 1:1) kirajzolja a kész videó felépítését,
// három mini-kockával: Nyitókártya → Fotó felirat-sávval → Összegző záró kép.
// Nem generál videót és nem fogyaszt kreditet — csak vizuális mock, ami a sablon
// színeivel/betűjével azonnal frissül. (Presentational; kliensben is biztonságos.)
import type { VideoDesign, VideoAspect } from "@/lib/video-templates";

// A záró kép a példában: rövid, jól olvasható összegzés az ingatlanról.
const SAMPLE = {
  introTitle: "Eladó panellakás",
  introSub: "Budapest, XIII. kerület",
  introPrice: "59,9 M Ft",
  photoCaption: "Nappali · déli fekvés",
  closingSummary: "3 szoba · 74 m² · felújított · 59,9 M Ft",
  contact: "Nagy Anna · +36 30 123 4567",
};

function ratioValue(aspect: VideoAspect): string {
  return aspect === "9:16" ? "9 / 16" : "1 / 1";
}

/** Fotó-hatású háttér (nem valódi kép — csak jelzés). */
function photoBg(dark = false): React.CSSProperties {
  return dark
    ? { background: "linear-gradient(135deg, #2a2a2e 0%, #45454c 55%, #26262a 100%)" }
    : { background: "linear-gradient(135deg, #c9cdd4 0%, #e6e9ee 50%, #b9bec7 100%)" };
}

export default function VideoTemplatePreview({
  design,
  aspect,
  accent,
  font,
}: {
  design: VideoDesign;
  aspect: VideoAspect;
  accent?: string;
  font?: string;
}) {
  // A kiemelőszín: profil-accent, ha a sablon azt használja; különben a sabloné.
  const ac = design.useProfileAccent && accent ? accent : design.accent;
  const ink = design.preview.ink;
  const ratio = ratioValue(aspect);
  const fam = font || design.font || undefined;

  const frameBase: React.CSSProperties = {
    aspectRatio: ratio,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
    border: "1px solid var(--twx-line)",
    fontFamily: fam,
  };

  return (
    <div>
      <div className="flex items-stretch gap-2">
        {/* 1) NYITÓKÁRTYA — arculati kártya főcímmel */}
        <figure className="flex-1" style={{ margin: 0 }}>
          <div
            style={{
              ...frameBase,
              background: `linear-gradient(135deg, ${design.preview.from}, ${design.preview.to})`,
              color: ink,
            }}
          >
            <div className="absolute inset-0 flex flex-col justify-center px-2 text-center">
              <div style={{ height: 3, width: 22, background: ac, borderRadius: 2, margin: "0 auto 5px" }} />
              <div className="font-semibold leading-tight" style={{ fontSize: "clamp(8px, 2.3vw, 12px)" }}>
                {SAMPLE.introTitle}
              </div>
              <div style={{ fontSize: "clamp(6px, 1.7vw, 9px)", opacity: 0.85, marginTop: 2 }}>
                {SAMPLE.introSub}
              </div>
              <div
                className="mx-auto mt-1.5 inline-block rounded px-1.5 py-0.5"
                style={{ background: ac, color: "#1c1005", fontSize: "clamp(6px, 1.7vw, 9px)", fontWeight: 700 }}
              >
                {SAMPLE.introPrice}
              </div>
            </div>
          </div>
          <figcaption className="mt-1 text-center text-[10px]" style={{ color: "var(--twx-ink-muted)" }}>
            Nyitókártya
          </figcaption>
        </figure>

        {/* 2) FOTÓ FELIRAT-SÁVVAL */}
        <figure className="flex-1" style={{ margin: 0 }}>
          <div style={{ ...frameBase, ...photoBg(false) }}>
            <div className="absolute inset-x-0 bottom-0">
              <div
                className="truncate px-1.5 py-1 font-semibold"
                style={{ background: ac, color: "#1c1005", fontSize: "clamp(6px, 1.7vw, 9px)" }}
              >
                {SAMPLE.photoCaption}
              </div>
            </div>
          </div>
          <figcaption className="mt-1 text-center text-[10px]" style={{ color: "var(--twx-ink-muted)" }}>
            Fotó + felirat
          </figcaption>
        </figure>

        {/* 3) ÖSSZEGZŐ ZÁRÓ KÉP — nagy, jól olvasható szöveg fotón */}
        <figure className="flex-1" style={{ margin: 0 }}>
          <div style={{ ...frameBase, ...photoBg(true), color: "#fff" }}>
            {/* Sötétítő scrim az olvashatóságért */}
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.7))" }} />
            <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
              <div className="font-bold leading-tight" style={{ fontSize: "clamp(7px, 2vw, 11px)", textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
                {SAMPLE.closingSummary}
              </div>
              <div className="mt-1" style={{ height: 2, width: 26, background: ac, borderRadius: 2 }} />
              <div style={{ fontSize: "clamp(5px, 1.5vw, 8px)", opacity: 0.9, marginTop: 4 }}>
                {SAMPLE.contact}
              </div>
            </div>
          </div>
          <figcaption className="mt-1 text-center text-[10px]" style={{ color: "var(--twx-ink-muted)" }}>
            Összegző záró kép
          </figcaption>
        </figure>
      </div>

      <p className="mt-2 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
        Így épül fel a kész videó ebben a méretben ({aspect}). A fotókra a következő
        lépésben írhatsz saját feliratot, a záró képre pedig egy jól látható összegzőt.
      </p>
    </div>
  );
}
