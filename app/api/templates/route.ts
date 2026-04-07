import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import { summaryTemplateCreateSchema } from "@/lib/api/validation";
import { slugifyTemplateName } from "@/lib/templates";

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

    const templates = await prisma.summaryTemplate.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        baseTemplate: true,
        promptInstructions: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, templates });
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

    const parsed = summaryTemplateCreateSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { name, baseTemplate, promptInstructions } = parsed.data;
    const slugBase = slugifyTemplateName(name) || "template";

    let slug = slugBase;
    let suffix = 1;
    while (
      await prisma.summaryTemplate.findFirst({
        where: { userId: user.id, slug },
        select: { id: true },
      })
    ) {
      suffix += 1;
      slug = `${slugBase}-${suffix}`;
    }

    const template = await prisma.summaryTemplate.create({
      data: {
        userId: user.id,
        name,
        slug,
        baseTemplate,
        promptInstructions,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        baseTemplate: true,
        promptInstructions: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, template });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
