import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import {
  enforceRateLimit,
  enforceRateLimitForValue,
  enforceSameOrigin,
  getClientIp,
  getRequestSecurityFingerprints,
} from "@/lib/api/security";
import { billingPromoRedeemSchema } from "@/lib/api/validation";
import { redeemPromotionCode } from "@/lib/billing";
import { isEmailVerified } from "@/lib/email-verification";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    const rateLimitError = enforceRateLimit(request, "billing-promo-redeem", {
      limit: 10,
      windowMs: 60_000,
    });
    if (rateLimitError) return rateLimitError;

    const ipAddress = getClientIp(request);
    if (ipAddress !== "unknown") {
      const dailyPromoLimitError = enforceRateLimitForValue(
        ipAddress,
        "promo-redeem-daily",
        {
          limit: 2,
          windowMs: 86_400_000,
        },
      );
      if (dailyPromoLimitError) {
        return NextResponse.json(
          {
            error:
              "Too many promotion code redemptions have been attempted from this network today. Please try again later.",
          },
          {
            status: 429,
            headers: dailyPromoLimitError.headers,
          },
        );
      }
    }

    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase().trim();
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const verified = await isEmailVerified(email);
    if (!verified) {
      return NextResponse.json(
        {
          error:
            "Please verify your email before redeeming a promotion code.",
        },
        { status: 403 },
      );
    }

    const parsed = billingPromoRedeemSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return NextResponse.json(
        {
          error:
            fieldErrors.code?.[0] ||
            parsed.error.flatten().formErrors[0] ||
            "Invalid promotion code.",
        },
        { status: 400 },
      );
    }

    const result = await redeemPromotionCode({
      userId: user.id,
      code: parsed.data.code,
      ...getRequestSecurityFingerprints(request),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: getApiErrorMessage(error) },
      { status: getApiErrorStatus(error) },
    );
  }
}
