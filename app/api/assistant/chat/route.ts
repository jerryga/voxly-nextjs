import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyAssistantChat } from "@/lib/llm/agent";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceRateLimit, enforceSameOrigin } from "@/lib/api/security";
import { assistantChatSchema } from "@/lib/api/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
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

    const transcription = await prisma.transcription.findFirst({
      where: { id: transcriptionId, userId: user.id },
      select: { id: true },
    });
    if (!transcription) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const messages = await prisma.assistantMessage.findMany({
      where: { userId: user.id, transcriptionId },
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

    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = assistantChatSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { transcriptionId, messages, summary, provider, model } = parsed.data;
    const transcription = await prisma.transcription.findFirst({
      where: { id: transcriptionId, userId: user.id },
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
                userId: user.id,
                transcriptionId,
                role: "user",
                content: lastUserMessage.content,
              },
            }),
          ]
        : []),
      prisma.assistantMessage.create({
        data: {
          userId: user.id,
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
