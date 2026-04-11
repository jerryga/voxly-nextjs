/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const ACTIVE_WORKSPACE_COOKIE = "voxly_workspace";

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

const workspaceDelegate = (prisma as typeof prisma & {
  workspace: {
    findUnique: (...args: any[]) => Promise<any>;
    findFirst: (...args: any[]) => Promise<any>;
    create: (...args: any[]) => Promise<any>;
  };
  workspaceMember: {
    upsert: (...args: any[]) => Promise<any>;
    findMany: (...args: any[]) => Promise<any[]>;
    findFirst: (...args: any[]) => Promise<any>;
  };
}).workspace;

const workspaceMemberDelegate = (prisma as typeof prisma & {
  workspaceMember: {
    upsert: (...args: any[]) => Promise<any>;
    findMany: (...args: any[]) => Promise<any[]>;
    findFirst: (...args: any[]) => Promise<any>;
  };
}).workspaceMember;

function slugifyWorkspaceName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function uniqueWorkspaceSlug(baseName: string) {
  const baseSlug = slugifyWorkspaceName(baseName) || "workspace";
  let slug = baseSlug;
  let suffix = 1;

  while (await workspaceDelegate.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  return slug;
}

export async function requireAuthenticatedUser() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase().trim();

  if (!email) {
    return null;
  }

  return prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });
}

export async function ensurePersonalWorkspaceForUser(user: {
  id: string;
  email: string;
  name: string | null;
}) {
  const existing = await workspaceDelegate.findFirst({
    where: { ownerUserId: user.id, isPersonal: true },
  });

  if (existing) {
    await workspaceMemberDelegate.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: existing.id,
          userId: user.id,
        },
      },
      update: {
        role: "owner",
        status: "active",
        joinedAt: new Date(),
      },
      create: {
        workspaceId: existing.id,
        userId: user.id,
        role: "owner",
        status: "active",
        joinedAt: new Date(),
      },
    });

    return existing;
  }

  const baseName = `${user.name?.trim() || user.email.split("@")[0] || "Personal"} Workspace`;
  const slug = await uniqueWorkspaceSlug(baseName);

  const workspace = await workspaceDelegate.create({
    data: {
      ownerUserId: user.id,
      name: baseName,
      slug,
      isPersonal: true,
      members: {
        create: {
          userId: user.id,
          role: "owner",
          status: "active",
          joinedAt: new Date(),
        },
      },
    },
  });

  return workspace;
}

export async function getWorkspaceContext() {
  const user = await requireAuthenticatedUser();
  if (!user) {
    return null;
  }

  const personalWorkspace = await ensurePersonalWorkspaceForUser(user);
  const cookieStore = await cookies();
  const requestedWorkspaceId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value?.trim();

  const memberships = await workspaceMemberDelegate.findMany({
    where: { userId: user.id, status: "active" },
    select: {
      workspaceId: true,
      role: true,
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          isPersonal: true,
        },
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  const activeMembership =
    memberships.find((membership: any) => membership.workspaceId === requestedWorkspaceId) ||
    memberships.find((membership: any) => membership.workspaceId === personalWorkspace.id) ||
    memberships[0] ||
    null;

  if (!activeMembership) {
    return null;
  }

  return {
    user,
    activeWorkspace: activeMembership.workspace,
    role: activeMembership.role as WorkspaceRole,
    memberships: memberships.map((membership: any) => ({
      workspaceId: membership.workspaceId,
      role: membership.role as WorkspaceRole,
      workspace: membership.workspace,
    })),
  };
}

export async function requireWorkspaceContext() {
  return getWorkspaceContext();
}

export async function userHasWorkspaceAccess(userId: string, workspaceId: string) {
  const membership = await workspaceMemberDelegate.findFirst({
    where: {
      userId,
      workspaceId,
      status: "active",
    },
    select: { workspaceId: true },
  });

  return Boolean(membership);
}

export function canManageWorkspace(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}

export function canEditWorkspaceMember(
  actorRole: WorkspaceRole,
  targetRole: WorkspaceRole,
) {
  if (actorRole === "owner") {
    return targetRole !== "owner";
  }

  if (actorRole === "admin") {
    return targetRole !== "owner" && targetRole !== "admin";
  }

  return false;
}

export function canTransferWorkspaceOwnership(role: WorkspaceRole) {
  return role === "owner";
}
