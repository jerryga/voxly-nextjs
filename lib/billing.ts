import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export type BillingPlanKey = "starter" | "pro" | "team";
export type CreditPackKey = "pack_100" | "pack_500";

type BillingPlanConfig = {
  plan: BillingPlanKey;
  priceEnv: string;
  displayPrice: string;
  monthlyCredits: number;
  billingInterval: "monthly";
};

type CreditPackConfig = {
  key: CreditPackKey;
  priceEnv: string;
  displayPrice: string;
  credits: number;
};

type PublicBillingPlan = {
  plan: BillingPlanKey;
  displayPrice: string;
  monthlyCredits: number;
  billingInterval: "monthly";
  configured: boolean;
};

type PublicCreditPack = {
  key: CreditPackKey;
  displayPrice: string;
  credits: number;
  configured: boolean;
};

export type BillingHistoryEntry = {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  monthlyAfter: number | null;
  topUpAfter: number | null;
  note: string | null;
  transcriptionId: string | null;
  stripeInvoiceId: string | null;
  stripeSessionId: string | null;
  createdAt: string;
};

function createBillingError(message: string, statusCode = 400) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}

const BILLING_PLANS: Record<BillingPlanKey, BillingPlanConfig> = {
  starter: {
    plan: "starter",
    priceEnv: "STRIPE_PRICE_STARTER_MONTHLY",
    displayPrice: "$19",
    monthlyCredits: 300,
    billingInterval: "monthly",
  },
  pro: {
    plan: "pro",
    priceEnv: "STRIPE_PRICE_PRO_MONTHLY",
    displayPrice: "$49",
    monthlyCredits: 1200,
    billingInterval: "monthly",
  },
  team: {
    plan: "team",
    priceEnv: "STRIPE_PRICE_TEAM_MONTHLY",
    displayPrice: "$149",
    monthlyCredits: 4000,
    billingInterval: "monthly",
  },
};

const CREDIT_PACKS: Record<CreditPackKey, CreditPackConfig> = {
  pack_100: {
    key: "pack_100",
    priceEnv: "STRIPE_PRICE_TOPUP_100",
    displayPrice: "$9",
    credits: 100,
  },
  pack_500: {
    key: "pack_500",
    priceEnv: "STRIPE_PRICE_TOPUP_500",
    displayPrice: "$39",
    credits: 500,
  },
};

function createConfigError(message: string) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = 503;
  return error;
}

export function getAppBaseUrl(request?: Request) {
  const envBaseUrl = process.env.NEXTAUTH_URL?.trim();
  if (envBaseUrl) {
    return envBaseUrl.replace(/\/+$/, "");
  }

  if (request?.url) {
    return new URL(request.url).origin;
  }

  throw createConfigError(
    "Billing is not configured yet. Set NEXTAUTH_URL or access billing through the app.",
  );
}

export function buildAbsoluteUrl(path: string, request?: Request) {
  return new URL(path, `${getAppBaseUrl(request)}/`).toString();
}

export function getBillingPlan(plan: BillingPlanKey) {
  const config = BILLING_PLANS[plan];
  const priceId = process.env[config.priceEnv]?.trim();
  if (!priceId) {
    throw createConfigError(
      `Billing is not configured yet. Missing ${config.priceEnv}.`,
    );
  }

  return {
    ...config,
    priceId,
  };
}

export function getCreditPack(pack: CreditPackKey) {
  const config = CREDIT_PACKS[pack];
  const priceId = process.env[config.priceEnv]?.trim();
  if (!priceId) {
    throw createConfigError(
      `Billing is not configured yet. Missing ${config.priceEnv}.`,
    );
  }

  return {
    ...config,
    priceId,
  };
}

export function getPublicBillingPlans(): PublicBillingPlan[] {
  return Object.values(BILLING_PLANS).map((plan) => ({
    plan: plan.plan,
    displayPrice: plan.displayPrice,
    monthlyCredits: plan.monthlyCredits,
    billingInterval: plan.billingInterval,
    configured: Boolean(process.env[plan.priceEnv]?.trim()),
  }));
}

export function getPublicCreditPacks(): PublicCreditPack[] {
  return Object.values(CREDIT_PACKS).map((pack) => ({
    key: pack.key,
    displayPrice: pack.displayPrice,
    credits: pack.credits,
    configured: Boolean(process.env[pack.priceEnv]?.trim()),
  }));
}

export function findBillingPlanByPriceId(priceId?: string | null) {
  if (!priceId) return null;

  for (const plan of Object.values(BILLING_PLANS)) {
    if (process.env[plan.priceEnv]?.trim() === priceId) {
      return {
        ...plan,
        priceId,
      };
    }
  }

  return null;
}

function extractSubscriptionId(
  subscription: string | Stripe.Subscription | null | undefined,
) {
  if (!subscription) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
}

export async function getOrCreateStripeCustomer({
  userId,
  email,
  name,
}: {
  userId: string;
  email: string;
  name?: string | null;
}) {
  const existingSubscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { id: true, stripeCustomerId: true },
  });

  if (existingSubscription?.stripeCustomerId) {
    return existingSubscription.stripeCustomerId;
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: { userId },
  });

  await prisma.subscription.upsert({
    where: { userId },
    update: {
      stripeCustomerId: customer.id,
    },
    create: {
      userId,
      stripeCustomerId: customer.id,
    },
  });

  return customer.id;
}

export function calculateAggregateCredits({
  monthlyCreditsRemaining,
  monthlyCreditsTotal,
  topUpCreditsRemaining,
}: {
  monthlyCreditsRemaining: number;
  monthlyCreditsTotal: number;
  topUpCreditsRemaining: number;
}) {
  return {
    creditsRemaining: monthlyCreditsRemaining + topUpCreditsRemaining,
    creditsTotal: monthlyCreditsTotal + topUpCreditsRemaining,
  };
}

export function getBillableCreditsForDuration(durationSeconds?: number | null) {
  if (!durationSeconds || durationSeconds <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(durationSeconds / 60));
}

async function hasPaidBillingHistory(userId: string) {
  const [subscription, paidCreditTransaction] = await prisma.$transaction([
    prisma.subscription.findUnique({
      where: { userId },
      select: {
        stripeSubscriptionId: true,
        stripeCustomerId: true,
        plan: true,
        status: true,
      },
    }),
    prisma.creditTransaction.findFirst({
      where: {
        userId,
        OR: [{ type: "top_up" }, { type: "monthly_refill" }],
      },
      select: { id: true },
    }),
  ]);

  return Boolean(
    paidCreditTransaction ||
      subscription?.stripeSubscriptionId ||
      (subscription?.stripeCustomerId &&
        subscription.plan !== "free" &&
        subscription.status !== "free"),
  );
}

async function findUserByStripeCustomerId(stripeCustomerId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: { stripeCustomerId },
    select: { userId: true },
  });

  return subscription?.userId || null;
}

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status) {
  switch (status) {
    case "trialing":
    case "active":
    case "past_due":
    case "unpaid":
    case "canceled":
    case "paused":
      return status;
    case "incomplete":
    case "incomplete_expired":
      return "incomplete";
    default:
      return "free";
  }
}

export async function syncSubscriptionFromStripeSubscription(
  stripeSubscription: Stripe.Subscription,
) {
  const stripeCustomerId =
    typeof stripeSubscription.customer === "string"
      ? stripeSubscription.customer
      : stripeSubscription.customer.id;

  const userId =
    stripeSubscription.metadata.userId ||
    (await findUserByStripeCustomerId(stripeCustomerId));

  if (!userId) {
    throw new Error("Unable to map Stripe subscription to a Voxly user");
  }

  const lineItem = stripeSubscription.items.data[0];
  const priceId = lineItem?.price?.id || null;
  const planConfig = findBillingPlanByPriceId(priceId);
  const currentPeriodEnd = lineItem?.current_period_end
    ? new Date(lineItem.current_period_end * 1000)
    : null;

  await prisma.subscription.upsert({
    where: { userId },
    update: {
      stripeCustomerId,
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId: priceId,
      stripeCurrentPeriodEnd: currentPeriodEnd,
      status: mapStripeSubscriptionStatus(stripeSubscription.status),
      plan: planConfig?.plan || "free",
      billingInterval: planConfig?.billingInterval || "monthly",
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    },
    create: {
      userId,
      stripeCustomerId,
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId: priceId,
      stripeCurrentPeriodEnd: currentPeriodEnd,
      status: mapStripeSubscriptionStatus(stripeSubscription.status),
      plan: planConfig?.plan || "free",
      billingInterval: planConfig?.billingInterval || "monthly",
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    },
  });

  return { userId, planConfig };
}

export async function markWebhookEventProcessing(
  stripeEventId: string,
  eventType: string,
) {
  const existing = await prisma.stripeWebhookEvent.findUnique({
    where: { stripeEventId },
  });

  if (existing?.status === "processed") {
    return { alreadyProcessed: true as const };
  }

  if (existing) {
    await prisma.stripeWebhookEvent.update({
      where: { stripeEventId },
      data: {
        eventType,
        status: "processing",
        error: null,
      },
    });

    return { alreadyProcessed: false as const };
  }

  await prisma.stripeWebhookEvent.create({
    data: {
      stripeEventId,
      eventType,
      status: "processing",
    },
  });

  return { alreadyProcessed: false as const };
}

export async function markWebhookEventProcessed(stripeEventId: string) {
  await prisma.stripeWebhookEvent.update({
    where: { stripeEventId },
    data: {
      status: "processed",
      error: null,
    },
  });
}

export async function markWebhookEventFailed(
  stripeEventId: string,
  error: unknown,
) {
  const message = error instanceof Error ? error.message : String(error);
  await prisma.stripeWebhookEvent.update({
    where: { stripeEventId },
    data: {
      status: "failed",
      error: message.slice(0, 500),
    },
  });
}

export async function grantMonthlyCreditsFromInvoice({
  invoice,
  stripeEventId,
}: {
  invoice: Stripe.Invoice;
  stripeEventId: string;
}) {
  const stripe = getStripe();
  const stripeSubscriptionDetails = invoice.parent?.subscription_details;
  const stripeSubscriptionId = extractSubscriptionId(
    stripeSubscriptionDetails?.subscription,
  );

  if (!stripeSubscriptionId) {
    return;
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(
    stripeSubscriptionId,
  );
  const { userId, planConfig } =
    await syncSubscriptionFromStripeSubscription(stripeSubscription);

  if (!planConfig) {
    return;
  }

  const currentSubscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!currentSubscription) {
    throw new Error("Subscription record not found after Stripe sync");
  }

  const nextMonthlyRemaining = planConfig.monthlyCredits;
  const nextTopUpRemaining = currentSubscription.topUpCreditsRemaining;
  const aggregates = calculateAggregateCredits({
    monthlyCreditsRemaining: nextMonthlyRemaining,
    monthlyCreditsTotal: planConfig.monthlyCredits,
    topUpCreditsRemaining: nextTopUpRemaining,
  });

  const netChange = aggregates.creditsRemaining - currentSubscription.creditsRemaining;

  await prisma.$transaction([
    prisma.subscription.update({
      where: { userId },
      data: {
        status: "active",
        plan: planConfig.plan,
        billingInterval: planConfig.billingInterval,
        lastCreditRefreshAt: new Date(),
        monthlyCreditsRemaining: nextMonthlyRemaining,
        monthlyCreditsTotal: planConfig.monthlyCredits,
        creditsRemaining: aggregates.creditsRemaining,
        creditsTotal: aggregates.creditsTotal,
      },
    }),
    prisma.creditTransaction.create({
      data: {
        userId,
        type: "monthly_refill",
        amount: netChange,
        balanceAfter: aggregates.creditsRemaining,
        monthlyAfter: nextMonthlyRemaining,
        topUpAfter: nextTopUpRemaining,
        stripeEventId,
        stripeInvoiceId: invoice.id,
        note: `Monthly credits refreshed for ${planConfig.plan}`,
      },
    }),
  ]);
}

export async function grantTopUpCreditsFromCheckout({
  session,
  stripeEventId,
}: {
  session: Stripe.Checkout.Session;
  stripeEventId: string;
}) {
  const creditPackKey = session.metadata?.creditPack as CreditPackKey | undefined;
  const userId = session.metadata?.userId;

  if (!creditPackKey || !userId) {
    throw new Error("Missing top-up metadata");
  }

  const creditPack = CREDIT_PACKS[creditPackKey];
  if (!creditPack) {
    throw new Error("Unknown credit pack");
  }

  const currentSubscription = await prisma.subscription.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  const nextTopUpRemaining =
    currentSubscription.topUpCreditsRemaining + creditPack.credits;
  const aggregates = calculateAggregateCredits({
    monthlyCreditsRemaining: currentSubscription.monthlyCreditsRemaining,
    monthlyCreditsTotal: currentSubscription.monthlyCreditsTotal,
    topUpCreditsRemaining: nextTopUpRemaining,
  });

  await prisma.$transaction([
    prisma.subscription.update({
      where: { userId },
      data: {
        topUpCreditsRemaining: nextTopUpRemaining,
        creditsRemaining: aggregates.creditsRemaining,
        creditsTotal: aggregates.creditsTotal,
      },
    }),
    prisma.creditTransaction.create({
      data: {
        userId,
        type: "top_up",
        amount: creditPack.credits,
        balanceAfter: aggregates.creditsRemaining,
        monthlyAfter: currentSubscription.monthlyCreditsRemaining,
        topUpAfter: nextTopUpRemaining,
        stripeEventId,
        stripeSessionId: session.id,
        note: `Purchased ${creditPack.credits} top-up credits`,
      },
    }),
  ]);
}

export async function getBillingSnapshotForUser(userId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });
  const canRedeemPromoCredits = !(await hasPaidBillingHistory(userId));

  return {
    plan: subscription?.plan || "free",
    status: subscription?.status || "free",
    billingInterval: subscription?.billingInterval || "monthly",
    creditsRemaining: subscription?.creditsRemaining || 0,
    creditsTotal: subscription?.creditsTotal || 0,
    monthlyCreditsRemaining: subscription?.monthlyCreditsRemaining || 0,
    monthlyCreditsTotal: subscription?.monthlyCreditsTotal || 0,
    topUpCreditsRemaining: subscription?.topUpCreditsRemaining || 0,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
    stripeCurrentPeriodEnd: subscription?.stripeCurrentPeriodEnd?.toISOString() || null,
    hasBillingProfile: Boolean(subscription?.stripeCustomerId),
    hasActiveSubscription: Boolean(
      subscription?.stripeSubscriptionId &&
        ["trialing", "active", "past_due", "unpaid", "paused"].includes(
          subscription.status,
        ),
    ),
    availablePlans: getPublicBillingPlans(),
    availableCreditPacks: getPublicCreditPacks(),
    canRedeemPromoCredits,
  };
}

export async function getBillingHistoryForUser(
  userId: string,
  limit = 25,
): Promise<BillingHistoryEntry[]> {
  const items = await prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      amount: true,
      balanceAfter: true,
      monthlyAfter: true,
      topUpAfter: true,
      note: true,
      transcriptionId: true,
      stripeInvoiceId: true,
      stripeSessionId: true,
      createdAt: true,
    },
  });

  return items.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
  }));
}

export async function ensureCreditsAvailableForProcessing(userId: string) {
  return ensureCreditsAvailableForExpectedProcessing(userId, 60);
}

export async function redeemPromotionCode({
  userId,
  code,
  ipHash,
  userAgentHash,
}: {
  userId: string;
  code: string;
  ipHash?: string | null;
  userAgentHash?: string | null;
}) {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) {
    throw createBillingError("Enter a promotion code.");
  }

  const now = new Date();
  const promotion = await prisma.promotion.findUnique({
    where: { code: normalizedCode },
    include: {
      _count: {
        select: { redemptions: true },
      },
    },
  });

  if (!promotion || promotion.status !== "active") {
    throw createBillingError("This promotion code is not valid.", 404);
  }

  if (promotion.startsAt > now) {
    throw createBillingError("This promotion code is not active yet.");
  }

  if (promotion.endsAt < now) {
    throw createBillingError("This promotion code has expired.");
  }

  if (
    typeof promotion.maxRedemptions === "number" &&
    promotion._count.redemptions >= promotion.maxRedemptions
  ) {
    throw createBillingError("This promotion code has reached its redemption limit.");
  }

  const paidHistory = promotion.newUsersOnly
    ? await hasPaidBillingHistory(userId)
    : false;

  if (paidHistory) {
    throw createBillingError(
      "This promotion code is only available to accounts without prior purchases.",
      403,
    );
  }

  const existingRedemption = await prisma.promotionRedemption.findUnique({
    where: {
      promotionId_userId: {
        promotionId: promotion.id,
        userId,
      },
    },
    select: { id: true },
  });

  if (existingRedemption) {
    throw createBillingError("You have already used this promotion code.", 409);
  }

  const currentSubscription = await prisma.subscription.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  const nextTopUpRemaining =
    currentSubscription.topUpCreditsRemaining + promotion.creditsAmount;
  const aggregates = calculateAggregateCredits({
    monthlyCreditsRemaining: currentSubscription.monthlyCreditsRemaining,
    monthlyCreditsTotal: currentSubscription.monthlyCreditsTotal,
    topUpCreditsRemaining: nextTopUpRemaining,
  });

  await prisma.$transaction([
    prisma.subscription.update({
      where: { userId },
      data: {
        topUpCreditsRemaining: nextTopUpRemaining,
        creditsRemaining: aggregates.creditsRemaining,
        creditsTotal: aggregates.creditsTotal,
      },
    }),
    prisma.creditTransaction.create({
      data: {
        userId,
        type: "promo_credit",
        amount: promotion.creditsAmount,
        balanceAfter: aggregates.creditsRemaining,
        monthlyAfter: currentSubscription.monthlyCreditsRemaining,
        topUpAfter: nextTopUpRemaining,
        note: `Promotion code ${promotion.code} redeemed`,
      },
    }),
    prisma.promotionRedemption.create({
      data: {
        promotionId: promotion.id,
        userId,
        creditsGranted: promotion.creditsAmount,
        ipHash: ipHash || null,
        userAgentHash: userAgentHash || null,
      },
    }),
  ]);

  return {
    code: promotion.code,
    creditsGranted: promotion.creditsAmount,
  };
}

export async function ensureCreditsAvailableForExpectedProcessing(
  userId: string,
  durationSeconds?: number | null,
) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { creditsRemaining: true },
  });

  const requiredCredits = getBillableCreditsForDuration(durationSeconds);

  if (!subscription || subscription.creditsRemaining < requiredCredits) {
    const error = new Error(
      `You need ${requiredCredits} credits for this recording, but your account does not have enough remaining credits.`,
    );
    (error as Error & { statusCode?: number }).statusCode = 402;
    throw error;
  }
}

export async function hasUsageCreditsApplied(transcriptionId: string) {
  const usageTransaction = await prisma.creditTransaction.findFirst({
    where: {
      transcriptionId,
      type: "usage",
    },
    select: { id: true },
  });

  return Boolean(usageTransaction);
}

export async function applyUsageCredits({
  userId,
  transcriptionId,
  durationSeconds,
}: {
  userId: string;
  transcriptionId: string;
  durationSeconds?: number | null;
}) {
  const existingUsage = await prisma.creditTransaction.findFirst({
    where: {
      userId,
      transcriptionId,
      type: "usage",
    },
  });

  if (existingUsage) {
    return {
      amountCharged: Math.abs(existingUsage.amount),
      duplicate: true,
    };
  }

  const amountToCharge = getBillableCreditsForDuration(durationSeconds);

  return prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.findUnique({
      where: { userId },
    });

    if (!subscription || subscription.creditsRemaining < amountToCharge) {
      const error = new Error(
        `This recording requires ${amountToCharge} credits, but your account does not have enough remaining credits.`,
      );
      (error as Error & { statusCode?: number }).statusCode = 402;
      throw error;
    }

    const consumeMonthly = Math.min(
      subscription.monthlyCreditsRemaining,
      amountToCharge,
    );
    const consumeTopUp = amountToCharge - consumeMonthly;
    const nextMonthlyRemaining =
      subscription.monthlyCreditsRemaining - consumeMonthly;
    const nextTopUpRemaining =
      subscription.topUpCreditsRemaining - consumeTopUp;
    const aggregates = calculateAggregateCredits({
      monthlyCreditsRemaining: nextMonthlyRemaining,
      monthlyCreditsTotal: subscription.monthlyCreditsTotal,
      topUpCreditsRemaining: nextTopUpRemaining,
    });

    await tx.subscription.update({
      where: { userId },
      data: {
        monthlyCreditsRemaining: nextMonthlyRemaining,
        topUpCreditsRemaining: nextTopUpRemaining,
        creditsRemaining: aggregates.creditsRemaining,
        creditsTotal: aggregates.creditsTotal,
      },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        transcriptionId,
        type: "usage",
        amount: -amountToCharge,
        balanceAfter: aggregates.creditsRemaining,
        monthlyAfter: nextMonthlyRemaining,
        topUpAfter: nextTopUpRemaining,
        note: `Usage charged for transcription ${transcriptionId}`,
      },
    });

    return {
      amountCharged: amountToCharge,
      duplicate: false,
    };
  });
}

export async function refundUsageCredits({
  userId,
  transcriptionId,
  reason,
}: {
  userId: string;
  transcriptionId: string;
  reason: string;
}) {
  const usageTransaction = await prisma.creditTransaction.findFirst({
    where: {
      userId,
      transcriptionId,
      type: "usage",
    },
  });

  if (!usageTransaction) {
    return { refunded: false, amount: 0 };
  }

  const existingRefund = await prisma.creditTransaction.findFirst({
    where: {
      userId,
      transcriptionId,
      type: "usage_refund",
    },
  });

  if (existingRefund) {
    return { refunded: false, amount: existingRefund.amount };
  }

  const amountToRestore = Math.abs(usageTransaction.amount);

  return prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new Error("Subscription record not found for refund");
    }

    const nextTopUpRemaining =
      subscription.topUpCreditsRemaining + amountToRestore;
    const aggregates = calculateAggregateCredits({
      monthlyCreditsRemaining: subscription.monthlyCreditsRemaining,
      monthlyCreditsTotal: subscription.monthlyCreditsTotal,
      topUpCreditsRemaining: nextTopUpRemaining,
    });

    await tx.subscription.update({
      where: { userId },
      data: {
        topUpCreditsRemaining: nextTopUpRemaining,
        creditsRemaining: aggregates.creditsRemaining,
        creditsTotal: aggregates.creditsTotal,
      },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        transcriptionId,
        type: "usage_refund",
        amount: amountToRestore,
        balanceAfter: aggregates.creditsRemaining,
        monthlyAfter: subscription.monthlyCreditsRemaining,
        topUpAfter: nextTopUpRemaining,
        note: reason,
      },
    });

    return { refunded: true, amount: amountToRestore };
  });
}
