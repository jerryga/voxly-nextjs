import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  grantMonthlyCreditsFromInvoice,
  grantTopUpCreditsFromCheckout,
  markWebhookEventFailed,
  markWebhookEventProcessed,
  markWebhookEventProcessing,
  syncSubscriptionFromStripeSubscription,
} from "@/lib/billing";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";

export const runtime = "nodejs";

function extractSubscriptionId(
  subscription: string | Stripe.Subscription | null | undefined,
) {
  if (!subscription) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
}

async function handleEvent(event: Stripe.Event) {
  const stripe = getStripe();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (
        session.mode === "payment" &&
        session.payment_status === "paid" &&
        session.metadata?.purchaseType === "topup"
      ) {
        await grantTopUpCreditsFromCheckout({
          session,
          stripeEventId: event.id,
        });
      }
      return;
    }
    case "invoice.paid": {
      await grantMonthlyCreditsFromInvoice({
        invoice: event.data.object,
        stripeEventId: event.id,
      });
      return;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const stripeSubscriptionDetails = invoice.parent?.subscription_details;
      const stripeSubscriptionId = extractSubscriptionId(
        stripeSubscriptionDetails?.subscription,
      );
      if (!stripeSubscriptionId) return;

      const stripeSubscription = await stripe.subscriptions.retrieve(
        stripeSubscriptionId,
      );
      await syncSubscriptionFromStripeSubscription(stripeSubscription);
      return;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscriptionFromStripeSubscription(event.data.object);
      return;
    }
    default:
      return;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      getStripeWebhookSecret(),
    );

    const state = await markWebhookEventProcessing(event.id, event.type);
    if (state.alreadyProcessed) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    try {
      await handleEvent(event);
      await markWebhookEventProcessed(event.id);
      return NextResponse.json({ ok: true });
    } catch (error) {
      await markWebhookEventFailed(event.id, error);
      throw error;
    }
  } catch (error) {
    return NextResponse.json(
      { error: getApiErrorMessage(error) },
      { status: 400 },
    );
  }
}
