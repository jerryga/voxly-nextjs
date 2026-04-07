import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import { projectCreateSchema } from "@/lib/api/validation";

export const runtime = "nodejs";

async function requireUser() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase().trim();
  if (!email) {
    return null;
  }

  return prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
}

export async function GET() {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: "desc" }],
    });

    return NextResponse.json({ ok: true, projects });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}

export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) {
      return originError;
    }

    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = projectCreateSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        userId: user.id,
        name: parsed.data.name,
        description: parsed.data.description || null,
        color: parsed.data.color || null,
      },
    });

    return NextResponse.json({ ok: true, project });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
