/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import { summaryTemplateCreateSchema } from "@/lib/api/validation";
import { slugifyTemplateName } from "@/lib/templates";
import { requireWorkspaceContext } from "@/lib/workspaces";

export const runtime = "nodejs";

export async function GET() {
  try {
    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const templates = await prisma.summaryTemplate.findMany({
      where: {
        OR: [
          { workspaceId: context.activeWorkspace.id },
          { workspaceId: null, userId: context.user.id },
        ],
      } as any,
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

    const context = await requireWorkspaceContext();
    if (!context) {
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
        where: {
          slug,
          OR: [
            { workspaceId: context.activeWorkspace.id },
            { workspaceId: null, userId: context.user.id },
          ],
        } as any,
        select: { id: true },
      })
    ) {
      suffix += 1;
      slug = `${slugBase}-${suffix}`;
    }

    const template = await prisma.summaryTemplate.create({
      data: {
        userId: context.user.id,
        workspaceId: context.activeWorkspace.id,
        name,
        slug,
        baseTemplate,
        promptInstructions,
      } as any,
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
