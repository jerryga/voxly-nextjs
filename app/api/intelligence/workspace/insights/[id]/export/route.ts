/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { formatInsightMarkdownForNotion } from "@/lib/insight-export";
import { requireWorkspaceContext } from "@/lib/workspaces";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const workspaceInsightDelegate = (prisma as typeof prisma & {
  workspaceInsight: {
    findFirst: (...args: any[]) => Promise<any>;
  };
}).workspaceInsight;

export async function GET(_request: Request, context: RouteContext) {
  try {
    const workspaceContext = await requireWorkspaceContext();
    if (!workspaceContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const insight = await workspaceInsightDelegate.findFirst({
      where: {
        id: params.id,
        workspaceId: workspaceContext.activeWorkspace.id,
      } as any,
      select: {
        id: true,
        title: true,
        question: true,
        answer: true,
        confidenceNote: true,
        createdAt: true,
        sources: true,
      },
    });

    if (!insight) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const markdown = formatInsightMarkdownForNotion({
      title: insight.title,
      scopeLabel: "Workspace",
      question: insight.question,
      answer: insight.answer,
      confidenceNote: insight.confidenceNote || null,
      createdAt: insight.createdAt,
      sources: Array.isArray(insight.sources) ? insight.sources : [],
      sourceCount: Array.isArray(insight.sources) ? insight.sources.length : 0,
    });

    const safeBaseName =
      insight.title.replace(/[^a-zA-Z0-9._-]/g, "_") || "workspace_insight";
    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeBaseName}.md"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
