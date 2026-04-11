/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceRateLimit, enforceSameOrigin } from "@/lib/api/security";
import { createWorkspaceAuditLog } from "@/lib/workspace-audit";
import { canManageWorkspace, requireWorkspaceContext } from "@/lib/workspaces";
import {
  createWorkspaceInviteToken,
  getWorkspaceInviteExpiration,
  sendWorkspaceInviteEmail,
} from "@/lib/workspace-invites";

export const runtime = "nodejs";

const workspaceInviteDelegate = (prisma as typeof prisma & {
  workspaceInvite: {
    findFirst: (...args: any[]) => Promise<any>;
    update: (...args: any[]) => Promise<any>;
    updateMany: (...args: any[]) => Promise<{ count: number }>;
  };
}).workspaceInvite;

type RouteContext = {
  params: Promise<{ id: string }>;
};

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
    if (!canManageWorkspace(workspaceContext.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const invite = await workspaceInviteDelegate.findFirst({
      where: {
        id,
        workspaceId: workspaceContext.activeWorkspace.id,
        acceptedAt: null,
        revokedAt: null,
      } as any,
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!invite) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await workspaceInviteDelegate.updateMany({
      where: {
        id: invite.id,
        workspaceId: workspaceContext.activeWorkspace.id,
        acceptedAt: null,
        revokedAt: null,
      } as any,
      data: { revokedAt: new Date() },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await createWorkspaceAuditLog({
      workspaceId: workspaceContext.activeWorkspace.id,
      actorUserId: workspaceContext.user.id,
      action: "workspace.invite.revoked",
      targetType: "workspace_invite",
      targetId: invite.id,
      summary: `${workspaceContext.user.name?.trim() || workspaceContext.user.email} revoked the invite for ${invite.email}.`,
      metadata: {
        invitedEmail: invite.email,
        role: invite.role,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) {
      return originError;
    }

    const rateLimitError = enforceRateLimit(request, "workspace-invite-resend", {
      limit: 10,
      windowMs: 60_000,
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    const workspaceContext = await requireWorkspaceContext();
    if (!workspaceContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canManageWorkspace(workspaceContext.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const invite = await workspaceInviteDelegate.findFirst({
      where: {
        id,
        workspaceId: workspaceContext.activeWorkspace.id,
        acceptedAt: null,
        revokedAt: null,
      } as any,
      select: {
        id: true,
        email: true,
        role: true,
        token: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    if (!invite) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const token = createWorkspaceInviteToken();
    const expiresAt = getWorkspaceInviteExpiration();

    const updatedInvite = await workspaceInviteDelegate.update({
      where: { id: invite.id },
      data: {
        token,
        expiresAt,
        invitedByUserId: workspaceContext.user.id,
      } as any,
      select: {
        id: true,
        email: true,
        role: true,
        token: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await sendWorkspaceInviteEmail({
      to: updatedInvite.email,
      workspaceName: workspaceContext.activeWorkspace.name,
      invitedByName: workspaceContext.user.name?.trim() || workspaceContext.user.email,
      token,
    });

    await createWorkspaceAuditLog({
      workspaceId: workspaceContext.activeWorkspace.id,
      actorUserId: workspaceContext.user.id,
      action: "workspace.invite.resent",
      targetType: "workspace_invite",
      targetId: updatedInvite.id,
      summary: `${workspaceContext.user.name?.trim() || workspaceContext.user.email} resent the invite for ${updatedInvite.email}.`,
      metadata: {
        invitedEmail: updatedInvite.email,
        role: updatedInvite.role,
        previousExpiresAt: invite.expiresAt.toISOString(),
        nextExpiresAt: updatedInvite.expiresAt.toISOString(),
      },
    });

    return NextResponse.json({ ok: true, invite: updatedInvite });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
