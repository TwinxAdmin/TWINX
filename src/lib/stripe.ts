// Szerveroldali Stripe kliens. Csak API route-okban használjuk.
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
