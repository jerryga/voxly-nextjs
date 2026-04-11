/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import { workspaceOwnerTransferSchema } from "@/lib/api/validation";
import { createWorkspaceAuditLog } from "@/lib/workspace-audit";
import {
  canTransferWorkspaceOwnership,
  requireWorkspaceContext,
} from "@/lib/workspaces";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) {
      return originError;
    }

    const workspaceContext = await requireWorkspaceContext();
    if (!workspaceContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canTransferWorkspaceOwnership(workspaceContext.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (workspaceContext.activeWorkspace.isPersonal) {
      return NextResponse.json(
        { error: "Personal workspace ownership cannot be transferred." },
        { status: 409 },
      );
    }

    const parsed = workspaceOwnerTransferSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const targetMember = await prisma.workspaceMember.findFirst({
      where: {
        id: parsed.data.memberId,
        workspaceId: workspaceContext.activeWorkspace.id,
        status: "active",
      } as any,
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    if (targetMember.userId === workspaceContext.user.id) {
      return NextResponse.json(
        { error: "Choose a different member to transfer ownership." },
        { status: 409 },
      );
    }

    await prisma.$transaction([
      prisma.workspace.update({
        where: { id: workspaceContext.activeWorkspace.id },
        data: { ownerUserId: targetMember.userId } as any,
      }),
      prisma.workspaceMember.updateMany({
        where: {
          workspaceId: workspaceContext.activeWorkspace.id,
          userId: workspaceContext.user.id,
          status: "active",
        } as any,
        data: { role: "admin" } as any,
      }),
      prisma.workspaceMember.update({
        where: { id: targetMember.id },
        data: { role: "owner" } as any,
      }),
    ]);

    await createWorkspaceAuditLog({
      workspaceId: workspaceContext.activeWorkspace.id,
      actorUserId: workspaceContext.user.id,
      action: "workspace.owner.transferred",
      targetType: "workspace_member",
      targetId: targetMember.id,
      summary: `${workspaceContext.user.name?.trim() || workspaceContext.user.email} transferred workspace ownership to ${targetMember.user.name?.trim() || targetMember.user.email}.`,
      metadata: {
        previousOwnerUserId: workspaceContext.user.id,
        newOwnerUserId: targetMember.userId,
        newOwnerEmail: targetMember.user.email,
      },
    });

    return NextResponse.json({ ok: true, ownerMemberId: targetMember.id });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
