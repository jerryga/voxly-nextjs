import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import { summaryTemplateUpdateSchema } from "@/lib/api/validation";
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

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) {
      return originError;
    }

    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const parsed = summaryTemplateUpdateSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const existing = await prisma.summaryTemplate.findFirst({
      where: { id, userId: user.id },
      select: { id: true, name: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const nextName = parsed.data.name ?? existing.name;
    const slugBase = slugifyTemplateName(nextName) || "template";
    let slug = slugBase;
    let suffix = 1;
    while (
      await prisma.summaryTemplate.findFirst({
        where: {
          userId: user.id,
          slug,
          NOT: { id },
        },
        select: { id: true },
      })
    ) {
      suffix += 1;
      slug = `${slugBase}-${suffix}`;
    }

    const template = await prisma.summaryTemplate.update({
      where: { id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name, slug } : {}),
        ...(parsed.data.baseTemplate
          ? { baseTemplate: parsed.data.baseTemplate }
          : {}),
        ...(parsed.data.promptInstructions
          ? { promptInstructions: parsed.data.promptInstructions }
          : {}),
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

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const deleted = await prisma.summaryTemplate.deleteMany({
      where: { id, userId: user.id },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
