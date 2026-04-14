import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import { publishSessionToNotion } from "@/lib/notion";
import { requireWorkspaceContext } from "@/lib/workspaces";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function formatTranscriptionMarkdown(transcription: {
  fileName: string;
  template?: string | null;
  createdAt: Date;
  decisions?: unknown;
  keyPoints?: unknown;
  nextSteps?: unknown;
  actionItems?: unknown;
}) {
  const decisions = Array.isArray(transcription.decisions) ? (transcription.decisions as string[]) : [];
  const keyPoints = Array.isArray(transcription.keyPoints) ? (transcription.keyPoints as string[]) : [];
  const nextSteps = Array.isArray(transcription.nextSteps) ? (transcription.nextSteps as string[]) : [];
  const actionItems = Array.isArray(transcription.actionItems)
    ? (transcription.actionItems as Array<{ text?: string; priority?: string; assignee?: string }>)
    : [];

  const bullets = (items: string[]) =>
    items.length ? items.map((i) => `- ${i}`).join("\n") : "- None";

  const formattedActionItems = actionItems.length
    ? actionItems
        .map((item) => {
          const text = item.text?.trim();
          if (!text) return null;
          const priority = item.priority?.trim() || "MEDIUM";
          const assignee = item.assignee?.trim() || "Unassigned";
          return `- [ ] ${text} [${priority}] @${assignee}`;
        })
        .filter(Boolean)
        .join("\n")
    : "- None";

  return [
    `# ${transcription.fileName}`,
    "",
    `- Created: ${transcription.createdAt.toISOString()}`,
    `- Template: ${transcription.template || "default"}`,
    "",
    "## Key Points",
    bullets(keyPoints),
    "",
    "## Decisions",
    bullets(decisions),
    "",
    "## Next Steps",
    bullets(nextSteps),
    "",
    "## Action Items",
    formattedActionItems,
    "",
  ].join("\n");
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    const workspaceContext = await requireWorkspaceContext();
    if (!workspaceContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const transcription = await prisma.transcription.findFirst({
      where: {
        id,
        workspaceId: workspaceContext.activeWorkspace.id,
      },
      select: {
        id: true,
        fileName: true,
        template: true,
        createdAt: true,
        decisions: true,
        keyPoints: true,
        nextSteps: true,
        actionItems: true,
        status: true,
      },
    });

    if (!transcription) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (transcription.status !== "done") {
      return NextResponse.json(
        { error: "Transcription has not finished processing." },
        { status: 400 },
      );
    }

    const markdown = formatTranscriptionMarkdown(transcription);

    // publishSessionToNotion only requires the connection to exist (token + parent page),
    // not the workspace-level `enabled` toggle — this is an explicit manual action.
    const result = await publishSessionToNotion({
      workspaceId: workspaceContext.activeWorkspace.id,
      title: transcription.fileName,
      markdown,
      actorUserId: workspaceContext.user.id,
      actorName: workspaceContext.user.name?.trim() || workspaceContext.user.email,
    });

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[/api/transcriptions/[id]/notion]", err);
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
