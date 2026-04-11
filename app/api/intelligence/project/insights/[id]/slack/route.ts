/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import { insightSlackShareSchema } from "@/lib/api/validation";
import { shareInsightToSlack } from "@/lib/slack";
import { requireWorkspaceContext } from "@/lib/workspaces";

export const runtime = "nodejs";

const projectInsightDelegate = (prisma as typeof prisma & {
  projectInsight: {
    findFirst: (...args: any[]) => Promise<any>;
  };
}).projectInsight;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
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
    const parsed = insightSlackShareSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const insight = await projectInsightDelegate.findFirst({
      where: {
        id: params.id,
        workspaceId: workspaceContext.activeWorkspace.id,
      } as any,
      select: {
        id: true,
        title: true,
        question: true,
        answer: true,
        sources: true,
        project: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!insight) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await shareInsightToSlack({
      workspaceId: workspaceContext.activeWorkspace.id,
      title: insight.title,
      question: insight.question,
      answer: insight.answer,
      sourceCount: Array.isArray(insight.sources) ? insight.sources.length : 0,
      actorUserId: workspaceContext.user.id,
      actorName: workspaceContext.user.name?.trim() || workspaceContext.user.email,
      scopeLabel: `Project: ${insight.project?.name || "Unknown project"}`,
      note: parsed.data.note,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
