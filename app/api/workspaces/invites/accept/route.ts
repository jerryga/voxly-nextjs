/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import { createWorkspaceAuditLog } from "@/lib/workspace-audit";
import {
  ACTIVE_WORKSPACE_COOKIE,
  requireAuthenticatedUser,
} from "@/lib/workspaces";

export const runtime = "nodejs";

const workspaceInviteDelegate = (prisma as typeof prisma & {
  workspaceInvite: {
    findFirst: (...args: any[]) => Promise<any>;
    update: (...args: any[]) => Promise<any>;
  };
}).workspaceInvite;

const acceptInviteSchema = z.object({
  token: z.string().trim().min(1),
});

export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) {
      return originError;
    }

    const user = await requireAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = acceptInviteSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const invite = await workspaceInviteDelegate.findFirst({
      where: {
        token: parsed.data.token,
        acceptedAt: null,
        revokedAt: null,
      } as any,
      select: {
        id: true,
        workspaceId: true,
        email: true,
        role: true,
        expiresAt: true,
        workspace: {
          select: {
            id: true,
            name: true,
            isPersonal: true,
            owner: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }
    if (invite.email !== user.email) {
      return NextResponse.json(
        { error: "This invite belongs to a different email address." },
        { status: 403 },
      );
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "Invite expired" }, { status: 410 });
    }

    await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: invite.workspaceId,
          userId: user.id,
        },
      },
      update: {
        role: invite.role,
        status: "active",
        joinedAt: new Date(),
      } as any,
      create: {
        workspaceId: invite.workspaceId,
        userId: user.id,
        role: invite.role,
        status: "active",
        joinedAt: new Date(),
      } as any,
    });

    await workspaceInviteDelegate.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });

    await createWorkspaceAuditLog({
      workspaceId: invite.workspaceId,
      actorUserId: user.id,
      action: "workspace.invite.accepted",
      targetType: "workspace_invite",
      targetId: invite.id,
      summary: `${user.name?.trim() || user.email} joined the workspace as ${invite.role}.`,
      metadata: {
        email: user.email,
        role: invite.role,
      },
    });

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_WORKSPACE_COOKIE, invite.workspaceId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return NextResponse.json({
      ok: true,
      workspaceId: invite.workspaceId,
      workspace: {
        id: invite.workspace.id,
        name: invite.workspace.name,
        isPersonal: invite.workspace.isPersonal,
      },
      role: invite.role,
      billingOwner: {
        id: invite.workspace.owner.id,
        email: invite.workspace.owner.email,
        name: invite.workspace.owner.name,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
