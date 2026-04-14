import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyAssistantChat } from "@/lib/llm/agent";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceRateLimit, enforceSameOrigin } from "@/lib/api/security";
import { assistantChatSchema } from "@/lib/api/validation";
import { requireWorkspaceContext, activeWorkspaceResourceWhere } from "@/lib/workspaces";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const transcriptionId = new URL(request.url).searchParams
      .get("transcriptionId")
      ?.trim();
    if (!transcriptionId) {
      return NextResponse.json(
        { error: "Missing transcriptionId" },
        { status: 400 },
      );
    }

    const where = activeWorkspaceResourceWhere(context);
    const transcription = await prisma.transcription.findFirst({
      where: { id: transcriptionId, ...where },
      select: { id: true },
    });
    if (!transcription) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Return messages stored by any member of the workspace for this transcription,
    // ordered chronologically so the full conversation is visible to collaborators.
    const messages = await prisma.assistantMessage.findMany({
      where: { transcriptionId },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true },
    });

    return NextResponse.json({ ok: true, messages });
  } catch (error) {
    return NextResponse.json(
      { error: getApiErrorMessage(error) },
      { status: getApiErrorStatus(error) },
    );
  }
}

export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) {
      return originError;
    }

    const rateLimitError = enforceRateLimit(request, "assistant-chat", {
      limit: 30,
      windowMs: 60_000,
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = assistantChatSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { transcriptionId, messages, summary, provider, model } = parsed.data;
    const where = activeWorkspaceResourceWhere(context);
    const transcription = await prisma.transcription.findFirst({
      where: { id: transcriptionId, ...where },
      select: { id: true },
    });
    if (!transcription) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const message = await applyAssistantChat({
      messages,
      summary,
      provider,
      model,
    });

    const lastUserMessage = [...messages].reverse().find((item) => item.role === "user");
    await prisma.$transaction([
      ...(lastUserMessage
        ? [
            prisma.assistantMessage.create({
              data: {
                userId: context.user.id,
                transcriptionId,
                role: "user",
                content: lastUserMessage.content,
              },
            }),
          ]
        : []),
      prisma.assistantMessage.create({
        data: {
          userId: context.user.id,
          transcriptionId,
          role: "assistant",
          content: message,
        },
      }),
    ]);

    return NextResponse.json({ ok: true, message });
  } catch (error) {
    return NextResponse.json(
      { error: getApiErrorMessage(error) },
      { status: getApiErrorStatus(error) },
    );
  }
}
