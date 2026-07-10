// Fájl-segédfüggvények. A Supabase publikus URL-hez a `download` query paraméter
// kényszerített letöltést (attachment) ad a böngészőben, nem megnyitást.
export function toDownloadUrl(url: string): string {
  if (!url) return url;
  return url + (url.includes("?") ? "&" : "?") + "download";
}
