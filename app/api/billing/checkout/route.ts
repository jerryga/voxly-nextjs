import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceRateLimit, enforceSameOrigin } from "@/lib/api/security";
import { billingCheckoutSchema } from "@/lib/api/validation";
import {
  buildAbsoluteUrl,
  getBillingPlan,
  getCreditPack,
  getOrCreateStripeCustomer,
} from "@/lib/billing";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "paused",
]);

export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    const rateLimitError = enforceRateLimit(request, "billing-checkout", {
      limit: 10,
      windowMs: 60_000,
    });
    if (rateLimitError) return rateLimitError;

    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase().trim();
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { subscription: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = billingCheckoutSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const customerId = await getOrCreateStripeCustomer({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const stripe = getStripe();

    if (
      parsed.data.purchaseType === "subscription" &&
      user.subscription?.status &&
      ACTIVE_SUBSCRIPTION_STATUSES.has(user.subscription.status)
    ) {
      return NextResponse.json(
        { error: "An active subscription already exists. Use the billing portal to manage it." },
        { status: 409 },
      );
    }

    if (parsed.data.purchaseType === "subscription") {
      const plan = getBillingPlan(parsed.data.plan);
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        success_url: buildAbsoluteUrl(
          `${parsed.data.successPath || "/dashboard?checkout=success"}${parsed.data.successPath?.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
          request,
        ),
        cancel_url: buildAbsoluteUrl(parsed.data.cancelPath || "/#pricing", request),
        line_items: [
          {
            price: plan.priceId,
            quantity: 1,
          },
        ],
        client_reference_id: user.id,
        metadata: {
          userId: user.id,
          purchaseType: "subscription",
          plan: plan.plan,
        },
        subscription_data: {
          metadata: {
            userId: user.id,
            plan: plan.plan,
          },
        },
        allow_promotion_codes: true,
      });

      return NextResponse.json({ ok: true, url: checkoutSession.url });
    }

    const creditPack = getCreditPack(parsed.data.creditPack);
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      success_url: buildAbsoluteUrl(
        `${parsed.data.successPath || "/dashboard?checkout=success"}${parsed.data.successPath?.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
        request,
      ),
      cancel_url: buildAbsoluteUrl(parsed.data.cancelPath || "/#pricing", request),
      line_items: [
        {
          price: creditPack.priceId,
          quantity: 1,
        },
      ],
      client_reference_id: user.id,
      metadata: {
        userId: user.id,
        purchaseType: "topup",
        creditPack: creditPack.key,
      },
    });

    return NextResponse.json({ ok: true, url: checkoutSession.url });
  } catch (error) {
    return NextResponse.json(
      { error: getApiErrorMessage(error) },
      { status: getApiErrorStatus(error) },
    );
  }
}
