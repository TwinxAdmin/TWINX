// Nav-link, ami helyben megnyitja a felhasználói bontás ablakot (open-users esemény).
"use client";

export default function UsersModalTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("open-users"))}
      style={{ color: "var(--twx-coral)" }}
    >
      Felhasználók
    </button>
  );
}
