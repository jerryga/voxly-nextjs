/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import { workspaceInsightCreateSchema } from "@/lib/api/validation";
import { requireWorkspaceContext } from "@/lib/workspaces";

export const runtime = "nodejs";

const workspaceInsightDelegate = (prisma as typeof prisma & {
  workspaceInsight: {
    findMany: (...args: any[]) => Promise<any[]>;
    create: (...args: any[]) => Promise<any>;
  };
}).workspaceInsight;

export async function GET() {
  try {
    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const insights = await workspaceInsightDelegate.findMany({
      where: {
        workspaceId: context.activeWorkspace.id,
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
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ ok: true, insights });
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

    const parsed = workspaceInsightCreateSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const insight = await workspaceInsightDelegate.create({
      data: {
        workspaceId: context.activeWorkspace.id,
        createdById: context.user.id,
        title: parsed.data.title,
        question: parsed.data.question,
        answer: parsed.data.answer,
        confidenceNote: parsed.data.confidenceNote || null,
        isPinned: false,
        archivedAt: null,
        projectIds: parsed.data.projectIds || [],
        sources: parsed.data.sources,
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

    return NextResponse.json({ ok: true, insight });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
