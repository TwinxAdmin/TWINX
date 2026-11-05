// Aktiváló levelek linkjeinek aláírt tokenje. Az ügynök állítja elő ugyanazzal a titokkal (ACTIVATION_TOKEN_SECRET), belépés nem kell hozzá.
// Formátum: v1.<base64url(JSON)>.<base64url(HMAC-SHA256)> — az ügynök src/activation/token.ts fájlja ugyanezt írja.
import { createHmac, timingSafeEqual } from "node:crypto";

export type FeedbackToken = { k: "f"; u: string; q: string; c: string; e: string; s?: string; x: number };
export type UnsubscribeToken = { k: "u"; u: string; m: string };
type AnyToken = FeedbackToken | UnsubscribeToken;

function sign(body: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(`v1.${body}`).digest();
}

function verify(token: string | null | undefined): AnyToken | null {
  const secret = (process.env.ACTIVATION_TOKEN_SECRET ?? "").trim();
  if (!secret || !token) return null;
  const [version, body, signature] = token.split(".");
  if (version !== "v1" || !body || !signature) return null;
  const got = Buffer.from(signature, "base64url");
  const want = sign(body, secret);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AnyToken;
  } catch {
    return null;
  }
}

/** Érvényes, le nem járt visszajelző token, különben null. */
export function verifyFeedbackToken(token: string | null | undefined): FeedbackToken | null {
  const t = verify(token);
  if (!t || t.k !== "f" || !t.u || !t.q || !t.c || !t.e) return null;
  return t.x * 1000 > Date.now() ? t : null;
}

/** Érvényes leiratkozó token, különben null. Nem jár le: a régi levél alján is működnie kell. */
export function verifyUnsubscribeToken(token: string | null | undefined): UnsubscribeToken | null {
  const t = verify(token);
  return t && t.k === "u" && t.u && t.m ? t : null;
}
