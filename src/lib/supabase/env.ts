// A Supabase URL és anon kulcs megtisztított beolvasása.
// A záró perjel(ek) és a felesleges szóköz/sortörés eltávolítása megakadályozza a
// gyakori "Invalid path specified in request URL" hibát, ha az env-érték elgépelt.
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

export const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
