/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";

const workspaceNotificationDelegate = (prisma as typeof prisma & {
  workspaceNotification: {
    createMany: (...args: any[]) => Promise<any>;
    findMany: (...args: any[]) => Promise<any[]>;
    updateMany: (...args: any[]) => Promise<{ count: number }>;
  };
}).workspaceNotification;

export async function createWorkspaceNotifications(input: {
  workspaceId: string;
  recipients: string[];
  type: string;
  title: string;
  body: string;
  link?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const recipients = Array.from(new Set(input.recipients.filter(Boolean)));
  if (!recipients.length) {
    return { count: 0 };
  }

  return workspaceNotificationDelegate.createMany({
    data: recipients.map((userId) => ({
      workspaceId: input.workspaceId,
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link || null,
      metadata: input.metadata || undefined,
    })) as any,
  });
}

export async function listWorkspaceNotifications(input: {
  workspaceId: string;
  userId: string;
  limit?: number;
}) {
  return workspaceNotificationDelegate.findMany({
    where: {
      workspaceId: input.workspaceId,
      userId: input.userId,
    } as any,
    orderBy: [{ createdAt: "desc" }],
    take: Math.min(Math.max(input.limit || 20, 1), 50),
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      link: true,
      metadata: true,
      readAt: true,
      createdAt: true,
    },
  });
}

export async function markWorkspaceNotificationsRead(input: {
  workspaceId: string;
  userId: string;
  notificationId?: string;
}) {
  return workspaceNotificationDelegate.updateMany({
    where: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      ...(input.notificationId ? { id: input.notificationId } : {}),
      readAt: null,
    } as any,
    data: {
      readAt: new Date(),
    },
  });
}
