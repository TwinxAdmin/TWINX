// Admin-előnézet sáv az új nyilvános oldalak tetején (D51). Megmutatja, hogy az oldal még nem él,
// és válthatsz a felső sáv két állapota között (belépve / kijelentkezve), kilépés nélkül.
export default function PreviewBar({ path, loggedOut }: { path: string; loggedOut: boolean }) {
  const pill = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-semibold ${active ? "" : "opacity-70 hover:opacity-100"}`;
  return (
    <div className="flex h-10 items-center justify-center gap-3 px-4 text-xs"
      style={{ background: "#2a1d0e", color: "#F3D9A4", borderBottom: "1px solid rgba(212,170,92,0.3)" }}>
      <span className="hidden sm:inline">Előnézet — csak adminnak látszik, az élő oldal nem változott.</span>
      <span className="sm:hidden">Admin-előnézet</span>
      <span aria-hidden>·</span>
      <span>Felső sáv:</span>
      <a href={path} className={pill(!loggedOut)} style={!loggedOut ? { background: "#D4AA5C", color: "#2a1d0e" } : undefined}>Belépve</a>
      <a href={`${path}?nezet=kint`} className={pill(loggedOut)} style={loggedOut ? { background: "#D4AA5C", color: "#2a1d0e" } : undefined}>Kijelentkezve</a>
    </div>
  );
}
