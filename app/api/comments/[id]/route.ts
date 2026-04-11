/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import {
  commentDeleteSchema,
  commentUpdateSchema,
} from "@/lib/api/validation";
import {
  extractCommentMentions,
  getWorkspaceMentionableMembers,
} from "@/lib/comments";
import { sendCommentMentionNotifications } from "@/lib/comment-notifications";
import {
  canManageWorkspace,
  requireWorkspaceContext,
} from "@/lib/workspaces";

export const runtime = "nodejs";

const workspaceCommentDelegate = (prisma as typeof prisma & {
  workspaceComment: {
    findFirst: (...args: any[]) => Promise<any>;
    update: (...args: any[]) => Promise<any>;
    delete: (...args: any[]) => Promise<any>;
  };
}).workspaceComment;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function canManageComment(actorRole: string, actorUserId: string, commentUserId: string) {
  return actorUserId === commentUserId || canManageWorkspace(actorRole as any);
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) {
      return originError;
    }

    const workspaceContext = await requireWorkspaceContext();
    if (!workspaceContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const parsed = commentUpdateSchema.safeParse({
      ...(await request.json().catch(() => ({}))),
      id: params.id,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const existing = await workspaceCommentDelegate.findFirst({
      where: {
        id: parsed.data.id,
        workspaceId: workspaceContext.activeWorkspace.id,
      } as any,
      select: {
        id: true,
        userId: true,
        mentions: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!canManageComment(workspaceContext.role, workspaceContext.user.id, existing.userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const members = await getWorkspaceMentionableMembers(workspaceContext.activeWorkspace.id);
    const mentions = extractCommentMentions(parsed.data.content, members);

    const comment = await workspaceCommentDelegate.update({
      where: { id: existing.id },
      data: {
        content: parsed.data.content,
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

    const previousMentionEmails = new Set(
      (((existing.mentions as Array<{ email: string }> | null) || []).map((mention) =>
        mention.email.trim().toLowerCase(),
      )),
    );
    const nextMentions =
      ((comment.mentions as Array<{ email: string; name?: string | null }>) || []).filter(
        (mention) => !previousMentionEmails.has(mention.email.trim().toLowerCase()),
      );

    await sendCommentMentionNotifications({
      workspaceId: workspaceContext.activeWorkspace.id,
      commentId: comment.id,
      commentContent: comment.content,
      actor: workspaceContext.user,
      mentions: nextMentions,
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

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) {
      return originError;
    }

    const workspaceContext = await requireWorkspaceContext();
    if (!workspaceContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const parsed = commentDeleteSchema.safeParse({ id: params.id });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const existing = await workspaceCommentDelegate.findFirst({
      where: {
        id: parsed.data.id,
        workspaceId: workspaceContext.activeWorkspace.id,
      } as any,
      select: {
        id: true,
        userId: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!canManageComment(workspaceContext.role, workspaceContext.user.id, existing.userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await workspaceCommentDelegate.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
