/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";

type UserNotificationPreferencesRecord = {
  id: string;
  userId: string;
  mentionEmailEnabled: boolean;
  mentionInAppEnabled: boolean;
  digestEmailEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const delegate = (prisma as typeof prisma & {
  userNotificationPreferences: {
    upsert: (...args: any[]) => Promise<any>;
    findUnique: (...args: any[]) => Promise<any>;
  };
}).userNotificationPreferences;

function serialize(record: UserNotificationPreferencesRecord) {
  return {
    id: record.id,
    userId: record.userId,
    mentionEmailEnabled: record.mentionEmailEnabled,
    mentionInAppEnabled: record.mentionInAppEnabled,
    digestEmailEnabled: record.digestEmailEnabled,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function ensureUserNotificationPreferences(userId: string) {
  return (await delegate.upsert({
    where: { userId },
    update: {},
    create: { userId },
  })) as UserNotificationPreferencesRecord;
}

export async function getUserNotificationPreferences(userId: string) {
  const record = await ensureUserNotificationPreferences(userId);
  return serialize(record);
}

export async function updateUserNotificationPreferences(
  userId: string,
  input: {
    mentionEmailEnabled: boolean;
    mentionInAppEnabled: boolean;
    digestEmailEnabled: boolean;
  },
) {
  const record = (await delegate.upsert({
    where: { userId },
    update: {
      mentionEmailEnabled: input.mentionEmailEnabled,
      mentionInAppEnabled: input.mentionInAppEnabled,
      digestEmailEnabled: input.digestEmailEnabled,
    },
    create: {
      userId,
      mentionEmailEnabled: input.mentionEmailEnabled,
      mentionInAppEnabled: input.mentionInAppEnabled,
      digestEmailEnabled: input.digestEmailEnabled,
    },
  })) as UserNotificationPreferencesRecord;

  return serialize(record);
}
