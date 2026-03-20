import Stripe from "stripe";

let cachedStripe: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    const error = new Error(
      "Billing is not configured yet. Missing STRIPE_SECRET_KEY.",
    ) as Error & { statusCode?: number };
    error.statusCode = 503;
    throw error;
  }

  cachedStripe ??= new Stripe(secretKey);
  return cachedStripe;
}

export function getStripeWebhookSecret() {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    const error = new Error(
      "Billing is not configured yet. Missing STRIPE_WEBHOOK_SECRET.",
    ) as Error & { statusCode?: number };
    error.statusCode = 503;
    throw error;
  }

  return webhookSecret;
}
