// Skeleton — csillámló helykitöltő a „Betöltés…" helyett.
export default function Skeleton({
  className,
  rounded = "rounded-xl",
}: {
  className?: string;
  rounded?: string;
}) {
  return <div className={`twx-skeleton ${rounded} ${className ?? ""}`} aria-hidden />;
}
