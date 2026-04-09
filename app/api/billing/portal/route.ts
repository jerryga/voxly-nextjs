import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceRateLimit, enforceSameOrigin } from "@/lib/api/security";
import { billingPortalSchema } from "@/lib/api/validation";
import { buildAbsoluteUrl } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";
import { requireWorkspaceBillingContext } from "@/lib/workspace-billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    const rateLimitError = enforceRateLimit(request, "billing-portal", {
      limit: 20,
      windowMs: 60_000,
    });
    if (rateLimitError) return rateLimitError;

    const billingContext = await requireWorkspaceBillingContext();
    if (!billingContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!billingContext.canManageBilling) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ownerSubscription = await prisma.subscription.findUnique({
      where: { userId: billingContext.billingUserId },
      select: { stripeCustomerId: true },
    });

    const stripeCustomerId = ownerSubscription?.stripeCustomerId;
    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing profile found for this workspace" },
        { status: 404 },
      );
    }

    const parsed = billingPortalSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const stripe = getStripe();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: buildAbsoluteUrl(
        parsed.data.returnPath || "/dashboard",
        request,
      ),
      configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID?.trim() || undefined,
    });

    return NextResponse.json({ ok: true, url: portalSession.url });
  } catch (error) {
    return NextResponse.json(
      { error: getApiErrorMessage(error) },
      { status: getApiErrorStatus(error) },
    );
  }
}
