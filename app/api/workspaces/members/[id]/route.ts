/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import { workspaceMemberUpdateSchema } from "@/lib/api/validation";
import { createWorkspaceAuditLog } from "@/lib/workspace-audit";
import {
  canEditWorkspaceMember,
  requireWorkspaceContext,
  WorkspaceRole,
} from "@/lib/workspaces";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

    const parsed = workspaceMemberUpdateSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { id } = await context.params;
    const target = await prisma.workspaceMember.findFirst({
      where: {
        id,
        workspaceId: workspaceContext.activeWorkspace.id,
        status: "active",
      } as any,
      select: {
        id: true,
        role: true,
        userId: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!target) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!canEditWorkspaceMember(workspaceContext.role, target.role as WorkspaceRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (target.userId === workspaceContext.user.id) {
      return NextResponse.json(
        { error: "Use a separate owner transfer flow before changing your own access." },
        { status: 409 },
      );
    }

    const member = await prisma.workspaceMember.update({
      where: { id: target.id },
      data: { role: parsed.data.role } as any,
      select: {
        id: true,
        role: true,
        status: true,
        joinedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    await createWorkspaceAuditLog({
      workspaceId: workspaceContext.activeWorkspace.id,
      actorUserId: workspaceContext.user.id,
      action: "workspace.member.role_updated",
      targetType: "workspace_member",
      targetId: target.id,
      summary: `${workspaceContext.user.name?.trim() || workspaceContext.user.email} changed ${target.user.name?.trim() || target.user.email} to ${parsed.data.role}.`,
      metadata: {
        memberUserId: target.userId,
        memberEmail: target.user.email,
        previousRole: target.role,
        nextRole: parsed.data.role,
      },
    });

    return NextResponse.json({ ok: true, member });
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

    const { id } = await context.params;
    const target = await prisma.workspaceMember.findFirst({
      where: {
        id,
        workspaceId: workspaceContext.activeWorkspace.id,
        status: "active",
      } as any,
      select: {
        id: true,
        role: true,
        userId: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!target) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (target.role === "owner") {
      return NextResponse.json(
        { error: "The owner cannot be removed from the workspace." },
        { status: 409 },
      );
    }
    if (!canEditWorkspaceMember(workspaceContext.role, target.role as WorkspaceRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (target.userId === workspaceContext.user.id) {
      return NextResponse.json(
        { error: "Leave workspace flow is not implemented yet." },
        { status: 409 },
      );
    }

    await prisma.workspaceMember.update({
      where: { id: target.id },
      data: { status: "removed" } as any,
    });

    await createWorkspaceAuditLog({
      workspaceId: workspaceContext.activeWorkspace.id,
      actorUserId: workspaceContext.user.id,
      action: "workspace.member.removed",
      targetType: "workspace_member",
      targetId: target.id,
      summary: `${workspaceContext.user.name?.trim() || workspaceContext.user.email} removed ${target.user.name?.trim() || target.user.email} from the workspace.`,
      metadata: {
        memberUserId: target.userId,
        memberEmail: target.user.email,
        role: target.role,
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
