// TWINX szöveges logó (wordmark): "TWIN" + korall "X".
// A méret/szín a szülő class-ából öröklődik; csak az X kap korall akcentet.
export default function Wordmark({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className={className} style={style}>
      TWIN<span style={{ color: "var(--twx-coral)" }}>X</span>
    </span>
  );
}
