/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import {
  projectInsightDeleteSchema,
  projectInsightUpdateSchema,
} from "@/lib/api/validation";
import { requireWorkspaceContext } from "@/lib/workspaces";

export const runtime = "nodejs";

const projectInsightDelegate = (prisma as typeof prisma & {
  projectInsight: {
    findFirst: (...args: any[]) => Promise<any>;
    deleteMany: (...args: any[]) => Promise<{ count: number }>;
    update: (...args: any[]) => Promise<any>;
  };
}).projectInsight;

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

    const params = await context.params;
    const parsed = projectInsightUpdateSchema.safeParse({
      ...(await request.json().catch(() => ({}))),
      id: params.id,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const insight = await projectInsightDelegate.findFirst({
      where: {
        id: parsed.data.id,
        workspaceId: workspaceContext.activeWorkspace.id,
      } as any,
      select: {
        id: true,
      },
    });

    if (!insight) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await projectInsightDelegate.update({
      where: { id: parsed.data.id },
      data: {
        ...(typeof parsed.data.isPinned === "boolean"
          ? { isPinned: parsed.data.isPinned }
          : {}),
        ...(typeof parsed.data.archived === "boolean"
          ? { archivedAt: parsed.data.archived ? new Date() : null }
          : {}),
      } as any,
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ ok: true, insight: updated });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) {
      return originError;
    }

    const workspaceContext = await requireWorkspaceContext();
    if (!workspaceContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const parsed = projectInsightDeleteSchema.safeParse({ id: params.id });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const insight = await projectInsightDelegate.findFirst({
      where: {
        id: parsed.data.id,
        workspaceId: workspaceContext.activeWorkspace.id,
      } as any,
      select: {
        id: true,
        createdById: true,
      },
    });

    if (!insight) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (
      insight.createdById !== workspaceContext.user.id &&
      workspaceContext.role !== "owner" &&
      workspaceContext.role !== "admin"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await projectInsightDelegate.deleteMany({
      where: {
        id: parsed.data.id,
        workspaceId: workspaceContext.activeWorkspace.id,
      } as any,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
