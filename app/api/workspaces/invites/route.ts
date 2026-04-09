/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceRateLimit, enforceSameOrigin } from "@/lib/api/security";
import { workspaceInviteCreateSchema } from "@/lib/api/validation";
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
    findMany: (...args: any[]) => Promise<any[]>;
    findFirst: (...args: any[]) => Promise<any>;
    create: (...args: any[]) => Promise<any>;
  };
}).workspaceInvite;

export async function GET() {
  try {
    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invites = await workspaceInviteDelegate.findMany({
      where: {
        workspaceId: context.activeWorkspace.id,
        acceptedAt: null,
        revokedAt: null,
      } as any,
      orderBy: [{ createdAt: "desc" }],
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

    return NextResponse.json({ ok: true, invites });
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

    const rateLimitError = enforceRateLimit(request, "workspace-invite", {
      limit: 10,
      windowMs: 60_000,
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canManageWorkspace(context.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = workspaceInviteCreateSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { email, role } = parsed.data;
    const existingMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: context.activeWorkspace.id,
        status: "active",
        user: { email },
      } as any,
      select: { id: true },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "That user is already in the workspace." },
        { status: 409 },
      );
    }

    const existingInvite = await workspaceInviteDelegate.findFirst({
      where: {
        workspaceId: context.activeWorkspace.id,
        email,
        acceptedAt: null,
        revokedAt: null,
      } as any,
      select: {
        id: true,
        expiresAt: true,
      },
    });

    if (existingInvite) {
      const isExpired = existingInvite.expiresAt.getTime() < Date.now();

      return NextResponse.json(
        {
          error: isExpired
            ? "An expired invite already exists for that email. Resend it from the pending invites list."
            : "A pending invite already exists for that email. Resend or revoke it from the pending invites list.",
        },
        { status: 409 },
      );
    }

    const token = createWorkspaceInviteToken();
    const invite = await workspaceInviteDelegate.create({
      data: {
        workspaceId: context.activeWorkspace.id,
        email,
        role: role || "member",
        token,
        invitedByUserId: context.user.id,
        expiresAt: getWorkspaceInviteExpiration(),
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

    await sendWorkspaceInviteEmail({
      to: email,
      workspaceName: context.activeWorkspace.name,
      invitedByName: context.user.name?.trim() || context.user.email,
      token,
    });

    await createWorkspaceAuditLog({
      workspaceId: context.activeWorkspace.id,
      actorUserId: context.user.id,
      action: "workspace.invite.created",
      targetType: "workspace_invite",
      targetId: invite.id,
      summary: `${context.user.name?.trim() || context.user.email} invited ${email} as ${invite.role}.`,
      metadata: {
        invitedEmail: email,
        role: invite.role,
      },
    });

    return NextResponse.json({ ok: true, invite });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
