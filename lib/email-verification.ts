import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

const VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24;

function getVerificationBaseUrl() {
  return (process.env.NEXTAUTH_URL?.trim() || "http://localhost:3000").replace(
    /\/+$/,
    "",
  );
}

function createVerificationUrl(email: string, token: string) {
  const url = new URL("/auth/verify-email", getVerificationBaseUrl());
  url.searchParams.set("email", email);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function createEmailVerificationToken(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + VERIFICATION_TTL_MS);

  await prisma.verificationToken.deleteMany({
    where: { identifier: normalizedEmail },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: normalizedEmail,
      token,
      expires,
    },
  });

  return { token, expires };
}

export async function sendVerificationEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const { token } = await createEmailVerificationToken(normalizedEmail);
  const verificationUrl = createVerificationUrl(normalizedEmail, token);

  await sendEmail({
    to: normalizedEmail,
    subject: "Verify your Voxly email",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2 style="margin-bottom: 12px;">Verify your email</h2>
        <p>Thanks for creating your Voxly account.</p>
        <p>Click the button below to verify your email address:</p>
        <p style="margin: 24px 0;">
          <a href="${verificationUrl}" style="display: inline-block; background: #f97316; color: white; text-decoration: none; padding: 12px 18px; border-radius: 999px; font-weight: 600;">
            Verify email
          </a>
        </p>
        <p>If the button does not work, use this link:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p>This link expires in 24 hours.</p>
      </div>
    `,
    text: `Verify your Voxly email by visiting: ${verificationUrl}`,
  });

  return { verificationUrl };
}

export async function verifyEmailToken({
  email,
  token,
}: {
  email: string;
  token: string;
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedToken = token.trim();

  const verificationToken = await prisma.verificationToken.findUnique({
    where: {
      identifier_token: {
        identifier: normalizedEmail,
        token: normalizedToken,
      },
    },
  });

  if (!verificationToken) {
    const error = new Error("This verification link is invalid.") as Error & {
      statusCode?: number;
    };
    error.statusCode = 400;
    throw error;
  }

  if (verificationToken.expires < new Date()) {
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: normalizedEmail,
          token: normalizedToken,
        },
      },
    });

    const error = new Error("This verification link has expired.") as Error & {
      statusCode?: number;
    };
    error.statusCode = 400;
    throw error;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { email: normalizedEmail },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: normalizedEmail,
          token: normalizedToken,
        },
      },
    }),
  ]);
}

export async function isEmailVerified(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { emailVerified: true },
  });

  return Boolean(user?.emailVerified);
}
