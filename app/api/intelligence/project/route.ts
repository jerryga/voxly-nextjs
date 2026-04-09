/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { answerProjectQuestion } from "@/lib/llm/agent";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceRateLimit, enforceSameOrigin } from "@/lib/api/security";
import { projectIntelligenceQuerySchema } from "@/lib/api/validation";
import { requireWorkspaceContext } from "@/lib/workspaces";
import {
  buildProjectContextChunks,
  buildProjectIntelligencePrompt,
} from "@/lib/intelligence/project-intelligence";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) {
      return originError;
    }

    const rateLimitError = enforceRateLimit(request, "project-intelligence", {
      limit: 12,
      windowMs: 60_000,
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = projectIntelligenceQuerySchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { projectId, transcriptionIds, question, provider, model } = parsed.data;

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { workspaceId: context.activeWorkspace.id },
          { workspaceId: null, userId: context.user.id },
        ],
      } as any,
      select: { id: true, name: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const allowedIds = transcriptionIds?.length ? transcriptionIds : undefined;
    const transcriptions = await prisma.transcription.findMany({
      where: {
        projectId,
        status: "done",
        transcript: { not: null },
        OR: [
          { workspaceId: context.activeWorkspace.id },
          { workspaceId: null, userId: context.user.id },
        ],
        ...(allowedIds ? { id: { in: allowedIds } } : {}),
      } as any,
      select: {
        id: true,
        fileName: true,
        transcript: true,
        decisions: true,
        keyPoints: true,
        nextSteps: true,
        actionItems: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    if (!transcriptions.length) {
      return NextResponse.json(
        { error: "No processed transcripts found in this project." },
        { status: 400 },
      );
    }

    const chunks = buildProjectContextChunks(transcriptions, question);
    if (!chunks.length) {
      return NextResponse.json(
        { error: "This project does not have enough transcript content yet." },
        { status: 400 },
      );
    }

    const prompt = buildProjectIntelligencePrompt({
      question,
      projectName: project.name,
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
          : "I could not form a grounded answer from the selected project context.",
      confidenceNote:
        typeof rawAnswer?.confidenceNote === "string" &&
        rawAnswer.confidenceNote.trim()
          ? rawAnswer.confidenceNote.trim()
          : undefined,
      sources,
      coverage: {
        transcriptCount: transcriptions.length,
        chunkCount: chunks.length,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
