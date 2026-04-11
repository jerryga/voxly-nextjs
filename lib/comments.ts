/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";

type MentionableMember = {
  user: {
    email: string;
    name?: string | null;
  };
};

function normalizeMentionToken(value: string) {
  return value.trim().toLowerCase().replace(/^@+/, "");
}

export function extractCommentMentions(
  content: string,
  members: MentionableMember[],
) {
  const tokens = Array.from(
    new Set(
      (content.match(/@([a-zA-Z0-9._-]+)/g) || []).map((token) =>
        normalizeMentionToken(token),
      ),
    ),
  );

  if (!tokens.length) {
    return [];
  }

  const mentions = members
    .map((member) => {
      const email = member.user.email.trim().toLowerCase();
      const emailLocal = email.split("@")[0];
      const nameTokens = (member.user.name || "")
        .toLowerCase()
        .split(/[^a-z0-9._-]+/g)
        .filter(Boolean);

      const matched = tokens.some(
        (token) => token === email || token === emailLocal || nameTokens.includes(token),
      );

      return matched
        ? {
            email: member.user.email,
            name: member.user.name || null,
          }
        : null;
    })
    .filter(Boolean);

  return Array.from(
    new Map(mentions.map((mention: any) => [mention.email, mention])).values(),
  );
}

export async function getWorkspaceMentionableMembers(workspaceId: string) {
  return prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      status: "active",
    } as any,
    select: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });
}
