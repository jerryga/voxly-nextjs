/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import { actionTaskCreateSchema } from "@/lib/api/validation";
import {
  activeWorkspaceResourceWhere,
  requireWorkspaceContext,
} from "@/lib/workspaces";

export const runtime = "nodejs";

const actionTaskDelegate = (prisma as typeof prisma & {
  actionTask: {
    findMany: (...args: any[]) => Promise<any[]>;
    create: (...args: any[]) => Promise<any>;
  };
}).actionTask;

type WorkspaceContext = NonNullable<
  Awaited<ReturnType<typeof requireWorkspaceContext>>
>;

function getWorkspaceTaskWhere(context: WorkspaceContext) {
  return activeWorkspaceResourceWhere(context);
}

export async function GET(request: Request) {
  try {
    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const transcriptionId = searchParams.get("transcriptionId")?.trim();
    const status = searchParams.get("status")?.trim();
    const assignee = searchParams.get("assignee")?.trim();

    const taskWhere = {
      ...getWorkspaceTaskWhere(context),
      ...(status && status !== "all" ? { status } : {}),
      ...(assignee ? { assignee } : {}),
    } as any;

    if (transcriptionId) {
      const transcription = await prisma.transcription.findFirst({
        where: {
          id: transcriptionId,
          ...activeWorkspaceResourceWhere(context),
        } as any,
        select: { id: true },
      });

      if (!transcription) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      taskWhere.transcriptionId = transcriptionId;
    }

    const tasks = await actionTaskDelegate.findMany({
      where: taskWhere,
      include: {
        transcription: {
          select: {
            id: true,
            fileName: true,
            status: true,
          },
        },
      },
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

    const context = await requireWorkspaceContext();
    if (!context) {
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
      where: {
        id: transcriptionId,
        ...activeWorkspaceResourceWhere(context),
      } as any,
      select: { id: true },
    });

    if (!transcription) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const task = await actionTaskDelegate.create({
      data: {
        userId: context.user.id,
        workspaceId: context.activeWorkspace.id,
        transcriptionId,
        title,
        priority: priority || "MEDIUM",
        assignee: assignee || null,
        dueDate: dueDate instanceof Date ? dueDate : null,
        sourceActionIndex:
          typeof sourceActionIndex === "number" ? sourceActionIndex : null,
      } as any,
    });

    return NextResponse.json({ ok: true, task });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
