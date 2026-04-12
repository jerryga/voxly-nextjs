/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { answerProjectQuestion } from "@/lib/llm/agent";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceRateLimit, enforceSameOrigin } from "@/lib/api/security";
import { workspaceIntelligenceQuerySchema } from "@/lib/api/validation";
import { requireWorkspaceContext } from "@/lib/workspaces";
import {
  buildProjectContextChunks,
  buildWorkspaceIntelligencePrompt,
} from "@/lib/intelligence/project-intelligence";

export const runtime = "nodejs";

function isWorkspaceGreeting(question: string) {
  return /^(hi|hello|hey|yo|good\s+(morning|afternoon|evening))[\s!.?]*$/i.test(
    question.trim(),
  );
}

export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) {
      return originError;
    }

    const rateLimitError = enforceRateLimit(request, "workspace-intelligence", {
      limit: 10,
      windowMs: 60_000,
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = workspaceIntelligenceQuerySchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { question, projectIds, provider, model } = parsed.data;

    if (isWorkspaceGreeting(question)) {
      return NextResponse.json({
        ok: true,
        answer:
          "Hello! Ask me anything about this workspace, such as open risks, project themes, action items, decisions, or what changed recently.",
        sources: [],
        coverage: {
          transcriptCount: 0,
          chunkCount: 0,
          projectCount: projectIds?.length || null,
        },
      });
    }

    const transcriptions = await prisma.transcription.findMany({
      where: {
        status: "done",
        transcript: { not: null },
        ...(projectIds?.length ? { projectId: { in: projectIds } } : {}),
        OR: [
          { workspaceId: context.activeWorkspace.id },
          { workspaceId: null, userId: context.user.id },
        ],
      } as any,
      select: {
        id: true,
        fileName: true,
        transcript: true,
        decisions: true,
        keyPoints: true,
        nextSteps: true,
        actionItems: true,
        projectId: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 24,
    });

    if (!transcriptions.length) {
      return NextResponse.json(
        { error: "No processed transcripts found in this workspace." },
        { status: 400 },
      );
    }

    const chunks = buildProjectContextChunks(transcriptions, question, {
      maxChunks: 16,
      maxTranscriptChunks: 2,
    });
    if (!chunks.length) {
      return NextResponse.json(
        { error: "This workspace does not have enough transcript content yet." },
        { status: 400 },
      );
    }

    const prompt = buildWorkspaceIntelligencePrompt({
      question,
      workspaceName: context.activeWorkspace.name,
      chunks,
    });

    const rawAnswer = (await answerProjectQuestion({
      prompt,
      provider,
      model,
    })) as {
      answer?: string;
      sourceIds?: string[];
      confidenceNote?: string;
    };

    const sourceIds = Array.isArray(rawAnswer?.sourceIds)
      ? rawAnswer.sourceIds.filter((value) => typeof value === "string")
      : [];

    const sources = chunks
      .filter((chunk) => sourceIds.includes(chunk.sourceId))
      .map((chunk) => ({
        sourceId: chunk.sourceId,
        transcriptionId: chunk.transcriptionId,
        fileName: chunk.fileName,
        excerpt: chunk.excerpt,
      }));

    return NextResponse.json({
      ok: true,
      answer:
        typeof rawAnswer?.answer === "string" && rawAnswer.answer.trim()
          ? rawAnswer.answer.trim()
          : "I could not form a grounded answer from the selected workspace context.",
      confidenceNote:
        typeof rawAnswer?.confidenceNote === "string" &&
        rawAnswer.confidenceNote.trim()
          ? rawAnswer.confidenceNote.trim()
          : undefined,
      sources,
      coverage: {
        transcriptCount: transcriptions.length,
        chunkCount: chunks.length,
        projectCount: projectIds?.length || null,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
