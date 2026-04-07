import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function formatActionItems(actionItems: Array<{
  text?: string;
  priority?: string;
  assignee?: string;
}> = []) {
  return actionItems
    .map((item) => {
      const text = item.text?.trim();
      if (!text) {
        return null;
      }

      const priority = item.priority?.trim() || "MEDIUM";
      const assignee = item.assignee?.trim() || "Unassigned";
      return `- ${text} [${priority}] @${assignee}`;
    })
    .filter(Boolean)
    .join("\n");
}

function formatSummaryMarkdown(transcription: {
  fileName: string;
  template?: string | null;
  createdAt: Date;
  transcript?: string | null;
  decisions?: unknown;
  keyPoints?: unknown;
  nextSteps?: unknown;
  actionItems?: unknown;
}) {
  const decisions = Array.isArray(transcription.decisions)
    ? transcription.decisions
    : [];
  const keyPoints = Array.isArray(transcription.keyPoints)
    ? transcription.keyPoints
    : [];
  const nextSteps = Array.isArray(transcription.nextSteps)
    ? transcription.nextSteps
    : [];
  const actionItems = Array.isArray(transcription.actionItems)
    ? transcription.actionItems
    : [];

  const renderBullets = (items: string[]) =>
    items.length ? items.map((item) => `- ${item}`).join("\n") : "- None";

  return [
    `# ${transcription.fileName}`,
    "",
    `- Created: ${transcription.createdAt.toISOString()}`,
    `- Template: ${transcription.template || "default"}`,
    "",
    "## Decisions",
    renderBullets(decisions as string[]),
    "",
    "## Key Points",
    renderBullets(keyPoints as string[]),
    "",
    "## Next Steps",
    renderBullets(nextSteps as string[]),
    "",
    "## Action Items",
    formatActionItems(actionItems as Array<{
      text?: string;
      priority?: string;
      assignee?: string;
    }>) || "- None",
    "",
    "## Transcript",
    transcription.transcript?.trim() || "No transcript available.",
    "",
  ].join("\n");
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase().trim();
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const format = new URL(request.url).searchParams.get("format")?.trim() || "md";

    const transcription = await prisma.transcription.findFirst({
      where: { id, userId: user.id },
      select: {
        fileName: true,
        template: true,
        createdAt: true,
        transcript: true,
        decisions: true,
        keyPoints: true,
        nextSteps: true,
        actionItems: true,
      },
    });

    if (!transcription) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const safeBaseName = transcription.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

    if (format === "txt") {
      const text = formatSummaryMarkdown(transcription).replace(/^# /m, "");
      return new NextResponse(text, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safeBaseName}.txt"`,
        },
      });
    }

    const markdown = formatSummaryMarkdown(transcription);
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
