// TWINX szöveges logó (wordmark): "TWIN" + korall "X".
// A méret/szín a szülő class-ából öröklődik; csak az X kap korall akcentet.
export default function Wordmark({
  className,
  style,
  accent = "var(--twx-coral)",
}: {
  className?: string;
  style?: React.CSSProperties;
  /** Az „X" színe. A világos B arculaton a sötétebb korall (kontraszt): var(--color-b-accent). */
  accent?: string;
}) {
  return (
    <span className={className} style={style}>
      TWIN<span style={{ color: accent }}>X</span>
    </span>
  );
}
