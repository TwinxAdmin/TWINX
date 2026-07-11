// Szerveroldali Stripe kliens. Csak API route-okban használjuk.
// FONTOS: lazy inicializálás — a kulcsot csak az első tényleges híváskor kérjük,
// NEM modul betöltéskor (különben a build "page data" fázisa elbukna kulcs nélkül).
import Stripe from "stripe";

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("Hiányzó STRIPE_SECRET_KEY.");
    _stripe = new Stripe(key);
  }
  return _stripe;
}

// A meglévő `import { stripe }` hívások változatlanul működnek: a Proxy csak akkor
// hozza létre a valódi klienst, amikor először hozzáférünk egy tulajdonságához.
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const client = getStripe();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (client as any)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
