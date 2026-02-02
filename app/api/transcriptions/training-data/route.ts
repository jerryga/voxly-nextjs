import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import path from "node:path";
import fs from "node:fs/promises";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { summarizeTranscript } from "@/lib/llm/agent";
import { normalizeTemplate } from "@/lib/llm/promptBuilder";

export const runtime = "nodejs";

const templateAliases: Record<string, string> = {
  interview_notes: "interview",
  lecture_notes: "lecture",
  voice_memo: "voice-memo",
};

const trainingFiles: Record<string, string> = {
  default: "trainning-meeting.txt",
  brainstorm: "trainning-brainstorm.txt",
  interview: "trainning-interview.txt",
  lecture: "trainning-lecture.txt",
  "voice-memo": "trainning-voice-memo.txt",
};

function normalizeTemplateParam(value?: string | null) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  const lowered = trimmed.toLowerCase();
  const mapped = templateAliases[lowered] || lowered;
  return normalizeTemplate(mapped);
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const templateParam = searchParams.get("template");
  const template = normalizeTemplateParam(templateParam);
  const fileName = trainingFiles[template] || trainingFiles.default;
  const transcriptPath = path.join(process.cwd(), "data", fileName);

  const transcript = await fs.readFile(transcriptPath, "utf8");
  const summary = await summarizeTranscript(transcript, { template });

  const displayTemplate = templateParam ? String(templateParam) : template;
  const fileUrl = `test-data/${Date.now()}-${fileName}`;

  const transcription = await prisma.transcription.create({
    data: {
      userId: user.id,
      fileName: `Test Data (${displayTemplate})`,
      fileUrl,
      status: "done",
      template: templateParam || template,
      transcript,
      decisions: summary.decisions,
      keyPoints: summary.keyPoints,
      nextSteps: summary.nextSteps,
      actionItems: summary.actionItems,
    },
    select: { id: true },
  });

  return NextResponse.json({
    ok: true,
    transcriptionId: transcription.id,
    summary,
  });
}
