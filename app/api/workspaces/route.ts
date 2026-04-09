/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import { workspaceUpdateSchema } from "@/lib/api/validation";
import {
  canManageWorkspace,
  requireWorkspaceContext,
} from "@/lib/workspaces";
import { createWorkspaceAuditLog } from "@/lib/workspace-audit";

export const runtime = "nodejs";

export async function GET() {
  try {
    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeWorkspace = await prisma.workspace.findUnique({
      where: { id: context.activeWorkspace.id },
      select: {
        id: true,
        name: true,
        slug: true,
        isPersonal: true,
        createdAt: true,
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    const uniqueMemberships = context.memberships.filter(
      (membership: any, index: number, allMemberships: any[]) => {
        const membershipKey = `${membership.workspace.name.toLowerCase().trim()}::${String(
          membership.workspace.isPersonal,
        )}`;

        return (
          allMemberships.findIndex((candidate: any) => {
            const candidateKey = `${candidate.workspace.name
              .toLowerCase()
              .trim()}::${String(candidate.workspace.isPersonal)}`;
            return candidateKey === membershipKey;
          }) === index
        );
      },
    );

    return NextResponse.json({
      ok: true,
      currentUser: {
        id: context.user.id,
        email: context.user.email,
        name: context.user.name,
      },
      activeWorkspaceId: context.activeWorkspace.id,
      activeWorkspace: activeWorkspace
        ? {
            id: activeWorkspace.id,
            name: activeWorkspace.name,
            slug: activeWorkspace.slug,
            isPersonal: activeWorkspace.isPersonal,
            createdAt: activeWorkspace.createdAt.toISOString(),
            owner: activeWorkspace.owner,
            memberCount: activeWorkspace._count.members,
            role: context.role,
            canManage: canManageWorkspace(context.role),
          }
        : null,
      workspaces: uniqueMemberships.map((membership: any) => ({
        id: membership.workspace.id,
        name: membership.workspace.name,
        slug: membership.workspace.slug,
        isPersonal: membership.workspace.isPersonal,
        role: membership.role,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) {
      return originError;
    }

    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canManageWorkspace(context.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = workspaceUpdateSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const updatedWorkspace = await prisma.workspace.update({
      where: { id: context.activeWorkspace.id },
      data: { name: parsed.data.name } as any,
      select: {
        id: true,
        name: true,
        slug: true,
        isPersonal: true,
        createdAt: true,
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    await createWorkspaceAuditLog({
      workspaceId: updatedWorkspace.id,
      actorUserId: context.user.id,
      action: "workspace.updated",
      targetType: "workspace",
      targetId: updatedWorkspace.id,
      summary: `${context.user.name?.trim() || context.user.email} renamed the workspace to ${updatedWorkspace.name}.`,
      metadata: {
        name: updatedWorkspace.name,
      },
    });

    return NextResponse.json({
      ok: true,
      workspace: {
        id: updatedWorkspace.id,
        name: updatedWorkspace.name,
        slug: updatedWorkspace.slug,
        isPersonal: updatedWorkspace.isPersonal,
        createdAt: updatedWorkspace.createdAt.toISOString(),
        owner: updatedWorkspace.owner,
        memberCount: updatedWorkspace._count.members,
        role: context.role,
        canManage: true,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
