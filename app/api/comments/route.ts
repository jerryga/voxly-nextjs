/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import { commentCreateSchema } from "@/lib/api/validation";
import {
  extractCommentMentions,
  getWorkspaceMentionableMembers,
} from "@/lib/comments";
import { sendCommentMentionNotifications } from "@/lib/comment-notifications";
import { requireWorkspaceContext } from "@/lib/workspaces";

export const runtime = "nodejs";

const workspaceCommentDelegate = (prisma as typeof prisma & {
  workspaceComment: {
    findMany: (...args: any[]) => Promise<any[]>;
    create: (...args: any[]) => Promise<any>;
  };
}).workspaceComment;

export async function GET(request: Request) {
  try {
    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const transcriptionId = searchParams.get("transcriptionId")?.trim();
    const taskId = searchParams.get("taskId")?.trim();
    const projectInsightId = searchParams.get("projectInsightId")?.trim();
    const workspaceInsightId = searchParams.get("workspaceInsightId")?.trim();

    if (!transcriptionId && !taskId && !projectInsightId && !workspaceInsightId) {
      return NextResponse.json(
        {
          error:
            "transcriptionId, taskId, projectInsightId, or workspaceInsightId is required",
        },
        { status: 400 },
      );
    }

    if (transcriptionId) {
      const transcription = await prisma.transcription.findFirst({
        where: {
          id: transcriptionId,
          OR: [
            { workspaceId: context.activeWorkspace.id },
            { workspaceId: null, userId: context.user.id },
          ],
        } as any,
        select: { id: true },
      });

      if (!transcription) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    if (taskId) {
      const task = await prisma.actionTask.findFirst({
        where: {
          id: taskId,
          OR: [
            { workspaceId: context.activeWorkspace.id },
            { workspaceId: null, userId: context.user.id },
          ],
        } as any,
        select: { id: true },
      });

      if (!task) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    if (projectInsightId) {
      const insight = await prisma.projectInsight.findFirst({
        where: {
          id: projectInsightId,
          workspaceId: context.activeWorkspace.id,
        } as any,
        select: { id: true },
      });

      if (!insight) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    if (workspaceInsightId) {
      const insight = await prisma.workspaceInsight.findFirst({
        where: {
          id: workspaceInsightId,
          workspaceId: context.activeWorkspace.id,
        } as any,
        select: { id: true },
      });

      if (!insight) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    const comments = await workspaceCommentDelegate.findMany({
      where: {
        workspaceId: context.activeWorkspace.id,
        ...(transcriptionId ? { transcriptionId } : {}),
        ...(taskId ? { actionTaskId: taskId } : {}),
        ...(projectInsightId ? { projectInsightId } : {}),
        ...(workspaceInsightId ? { workspaceInsightId } : {}),
      } as any,
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true,
        content: true,
        mentions: true,
        transcriptionId: true,
        actionTaskId: true,
        projectInsightId: true,
        workspaceInsightId: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ ok: true, comments });
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

    const parsed = commentCreateSchema.safeParse(
      await request.json().catch(() => ({})),
    );

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { content, transcriptionId, taskId, projectInsightId, workspaceInsightId } =
      parsed.data;

    if (!transcriptionId && !taskId && !projectInsightId && !workspaceInsightId) {
      return NextResponse.json(
        {
          error:
            "transcriptionId, taskId, projectInsightId, or workspaceInsightId is required",
        },
        { status: 400 },
      );
    }

    if (transcriptionId) {
      const transcription = await prisma.transcription.findFirst({
        where: {
          id: transcriptionId,
          OR: [
            { workspaceId: context.activeWorkspace.id },
            { workspaceId: null, userId: context.user.id },
          ],
        } as any,
        select: { id: true },
      });

      if (!transcription) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    if (taskId) {
      const task = await prisma.actionTask.findFirst({
        where: {
          id: taskId,
          OR: [
            { workspaceId: context.activeWorkspace.id },
            { workspaceId: null, userId: context.user.id },
          ],
        } as any,
        select: { id: true },
      });

      if (!task) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    if (projectInsightId) {
      const insight = await prisma.projectInsight.findFirst({
        where: {
          id: projectInsightId,
          workspaceId: context.activeWorkspace.id,
        } as any,
        select: { id: true },
      });

      if (!insight) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    if (workspaceInsightId) {
      const insight = await prisma.workspaceInsight.findFirst({
        where: {
          id: workspaceInsightId,
          workspaceId: context.activeWorkspace.id,
        } as any,
        select: { id: true },
      });

      if (!insight) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    const members = await getWorkspaceMentionableMembers(context.activeWorkspace.id);
    const mentions = extractCommentMentions(content, members);

    const comment = await workspaceCommentDelegate.create({
      data: {
        workspaceId: context.activeWorkspace.id,
        userId: context.user.id,
        transcriptionId: transcriptionId || null,
        actionTaskId: taskId || null,
        projectInsightId: projectInsightId || null,
        workspaceInsightId: workspaceInsightId || null,
        content,
        mentions,
      } as any,
      select: {
        id: true,
        content: true,
        mentions: true,
        transcriptionId: true,
        actionTaskId: true,
        projectInsightId: true,
        workspaceInsightId: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    await sendCommentMentionNotifications({
      workspaceId: context.activeWorkspace.id,
      commentId: comment.id,
      commentContent: comment.content,
      actor: context.user,
      mentions: (comment.mentions as Array<{ email: string; name?: string | null }>) || [],
      transcriptionId: comment.transcriptionId,
      actionTaskId: comment.actionTaskId,
      projectInsightId: comment.projectInsightId,
      workspaceInsightId: comment.workspaceInsightId,
    });

    return NextResponse.json({ ok: true, comment });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
