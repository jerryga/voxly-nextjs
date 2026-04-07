import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import { actionTaskCreateSchema } from "@/lib/api/validation";

export const runtime = "nodejs";

const actionTaskDelegate = (prisma as typeof prisma & {
  actionTask: {
    findMany: typeof prisma.$queryRaw;
    create: typeof prisma.$queryRaw;
  };
}).actionTask;

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase().trim();

    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const transcriptionId = searchParams.get("transcriptionId")?.trim();

    if (!transcriptionId) {
      return NextResponse.json(
        { error: "transcriptionId is required" },
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

    const tasks = await actionTaskDelegate.findMany({
      where: { userId: user.id, transcriptionId },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ ok: true, tasks });
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

    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase().trim();

    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = actionTaskCreateSchema.safeParse(
      await request.json().catch(() => ({})),
    );

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const {
      transcriptionId,
      title,
      priority,
      assignee,
      dueDate,
      sourceActionIndex,
    } = parsed.data;

    const transcription = await prisma.transcription.findFirst({
      where: { id: transcriptionId, userId: user.id },
      select: { id: true },
    });

    if (!transcription) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const task = await actionTaskDelegate.create({
      data: {
        userId: user.id,
        transcriptionId,
        title,
        priority: priority || "MEDIUM",
        assignee: assignee || null,
        dueDate: dueDate instanceof Date ? dueDate : null,
        sourceActionIndex:
          typeof sourceActionIndex === "number" ? sourceActionIndex : null,
      },
    });

    return NextResponse.json({ ok: true, task });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
