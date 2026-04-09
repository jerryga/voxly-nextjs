/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";

type CreateWorkspaceAuditLogInput = {
  workspaceId: string;
  actorUserId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
};

const workspaceAuditLogDelegate = (prisma as typeof prisma & {
  workspaceAuditLog: {
    create: (...args: any[]) => Promise<any>;
    findMany: (...args: any[]) => Promise<any[]>;
  };
}).workspaceAuditLog;

export async function createWorkspaceAuditLog(input: CreateWorkspaceAuditLogInput) {
  return workspaceAuditLogDelegate.create({
    data: {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId || null,
      action: input.action,
      targetType: input.targetType || null,
      targetId: input.targetId || null,
      summary: input.summary,
      metadata: input.metadata || undefined,
    } as any,
  });
}

export async function listWorkspaceAuditLogs(workspaceId: string, limit = 20) {
  return workspaceAuditLogDelegate.findMany({
    where: { workspaceId } as any,
    orderBy: [{ createdAt: "desc" }],
    take: Math.min(Math.max(limit, 1), 50),
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      summary: true,
      metadata: true,
      createdAt: true,
      actorUser: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });
}
