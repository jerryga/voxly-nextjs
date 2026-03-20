import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import {
  enforceRateLimit,
  enforceRateLimitForValue,
  enforceSameOrigin,
  getClientIp,
} from "@/lib/api/security";
import { signupSchema } from "@/lib/api/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) {
      return originError;
    }

    const rateLimitError = enforceRateLimit(request, "signup", {
      limit: 5,
      windowMs: 60_000,
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    const ipAddress = getClientIp(request);
    if (ipAddress !== "unknown") {
      const dailyIpLimitError = enforceRateLimitForValue(
        ipAddress,
        "signup-daily",
        {
          limit: 3,
          windowMs: 86_400_000,
        },
      );
      if (dailyIpLimitError) {
        return NextResponse.json(
          {
            error:
              "Too many new accounts have been created from this network today. Please try again later.",
          },
          {
            status: 429,
            headers: dailyIpLimitError.headers,
          },
        );
      }
    }

    const parsed = signupSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      const flattened = parsed.error.flatten();
      const fieldErrors = Object.fromEntries(
        Object.entries(flattened.fieldErrors).map(([key, value]) => [
          key,
          value?.[0],
        ]),
      );

      const preferredMessage =
        fieldErrors.password ||
        fieldErrors.email ||
        fieldErrors.name ||
        flattened.formErrors[0] ||
        "Please check your signup details and try again.";

      return NextResponse.json(
        {
          error: preferredMessage,
          fieldErrors,
        },
        { status: 400 },
      );
    }

    const { email, password, name } = parsed.data;
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 409 },
      );
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name: name || null,
      },
      select: { id: true, email: true },
    });

    return NextResponse.json({ ok: true, user });
  } catch (error) {
    console.error("Signup error", error);
    return NextResponse.json(
      { error: getApiErrorMessage(error) },
      { status: getApiErrorStatus(error) },
    );
  }
}
