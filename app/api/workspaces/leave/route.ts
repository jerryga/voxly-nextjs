/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import { createWorkspaceAuditLog } from "@/lib/workspace-audit";
import {
  ACTIVE_WORKSPACE_COOKIE,
  requireWorkspaceContext,
} from "@/lib/workspaces";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) {
      return originError;
    }

    const workspaceContext = await requireWorkspaceContext();
    if (!workspaceContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (workspaceContext.activeWorkspace.isPersonal) {
      return NextResponse.json(
        { error: "You cannot leave your personal workspace." },
        { status: 409 },
      );
    }
    if (workspaceContext.role === "owner") {
      return NextResponse.json(
        { error: "Transfer ownership before leaving this workspace." },
        { status: 409 },
      );
    }

    await prisma.workspaceMember.updateMany({
      where: {
        workspaceId: workspaceContext.activeWorkspace.id,
        userId: workspaceContext.user.id,
        status: "active",
      } as any,
      data: { status: "removed" } as any,
    });

    await createWorkspaceAuditLog({
      workspaceId: workspaceContext.activeWorkspace.id,
      actorUserId: workspaceContext.user.id,
      action: "workspace.member.left",
      targetType: "workspace_member",
      targetId: workspaceContext.user.id,
      summary: `${workspaceContext.user.name?.trim() || workspaceContext.user.email} left the workspace.`,
      metadata: {
        userId: workspaceContext.user.id,
        email: workspaceContext.user.email,
        role: workspaceContext.role,
      },
    });

    const cookieStore = await cookies();
    cookieStore.delete(ACTIVE_WORKSPACE_COOKIE);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
