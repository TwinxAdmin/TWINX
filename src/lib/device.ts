// Eszköz felismerése a User-Agentből (szerveroldalon) — mobile / tablet / desktop.
// A mérésekhez (modul-események, „Mi hiányzik?") — nem személyes adat, csak a böngésző típusa.
export type Device = "mobile" | "tablet" | "desktop";

export function deviceOf(ua: string): Device {
  if (/iPad|Tablet|Nexus 7|Nexus 10|SM-T|Kindle|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "tablet";
  if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) return "mobile";
  return "desktop";
}
