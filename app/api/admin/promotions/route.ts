import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceRateLimit, enforceSameOrigin } from "@/lib/api/security";
import {
  adminPromotionCreateSchema,
  adminPromotionStatusSchema,
} from "@/lib/api/validation";
import { isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";

async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase().trim();

  if (!email || !isAdminEmail(email)) {
    return null;
  }

  return { email };
}

export async function GET() {
  try {
    const admin = await requireAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const promotions = await prisma.promotion.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { redemptions: true },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      promotions: promotions.map((promotion) => ({
        id: promotion.id,
        code: promotion.code,
        status: promotion.status,
        creditsAmount: promotion.creditsAmount,
        startsAt: promotion.startsAt.toISOString(),
        endsAt: promotion.endsAt.toISOString(),
        maxRedemptions: promotion.maxRedemptions,
        newUsersOnly: promotion.newUsersOnly,
        redemptionCount: promotion._count.redemptions,
        createdAt: promotion.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: getApiErrorMessage(error) },
      { status: getApiErrorStatus(error) },
    );
  }
}

export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    const rateLimitError = enforceRateLimit(request, "admin-promotions", {
      limit: 20,
      windowMs: 60_000,
    });
    if (rateLimitError) return rateLimitError;

    const admin = await requireAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = adminPromotionCreateSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      const flattened = parsed.error.flatten();
      const fieldErrors = Object.fromEntries(
        Object.entries(flattened.fieldErrors).map(([key, value]) => [
          key,
          value?.[0],
        ]),
      );

      return NextResponse.json(
        {
          error:
            fieldErrors.startsAt ||
            fieldErrors.endsAt ||
            fieldErrors.code ||
            fieldErrors.creditsAmount ||
            flattened.formErrors[0] ||
            "Invalid promotion details.",
          fieldErrors,
        },
        { status: 400 },
      );
    }

    if (parsed.data.endsAt <= parsed.data.startsAt) {
      return NextResponse.json(
        { error: "End date must be later than the start date." },
        { status: 400 },
      );
    }

    const promotion = await prisma.promotion.create({
      data: {
        code: parsed.data.code,
        creditsAmount: parsed.data.creditsAmount,
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt,
        maxRedemptions: parsed.data.maxRedemptions,
        newUsersOnly: parsed.data.newUsersOnly,
        status: "active",
      },
    });

    return NextResponse.json({
      ok: true,
      promotion: {
        id: promotion.id,
        code: promotion.code,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: getApiErrorMessage(error) },
      { status: getApiErrorStatus(error) },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    const admin = await requireAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = adminPromotionStatusSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid promotion update request." },
        { status: 400 },
      );
    }

    await prisma.promotion.update({
      where: { id: parsed.data.promotionId },
      data: { status: parsed.data.status },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: getApiErrorMessage(error) },
      { status: getApiErrorStatus(error) },
    );
  }
}
