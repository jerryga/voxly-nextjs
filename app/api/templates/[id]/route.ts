/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import { summaryTemplateUpdateSchema } from "@/lib/api/validation";
import { slugifyTemplateName } from "@/lib/templates";
import { requireWorkspaceContext } from "@/lib/workspaces";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) {
      return originError;
    }

    const workspaceContext = await requireWorkspaceContext();
    if (!workspaceContext) {
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
      where: {
        id,
        OR: [
          { workspaceId: workspaceContext.activeWorkspace.id },
          { workspaceId: null, userId: workspaceContext.user.id },
        ],
      } as any,
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
          slug,
          OR: [
            { workspaceId: workspaceContext.activeWorkspace.id },
            { workspaceId: null, userId: workspaceContext.user.id },
          ],
          NOT: { id },
        } as any,
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
    const workspaceContext = await requireWorkspaceContext();
    if (!workspaceContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const deleted = await prisma.summaryTemplate.deleteMany({
      where: {
        id,
        OR: [
          { workspaceId: workspaceContext.activeWorkspace.id },
          { workspaceId: null, userId: workspaceContext.user.id },
        ],
      } as any,
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
