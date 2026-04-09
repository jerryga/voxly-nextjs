/* eslint-disable @typescript-eslint/no-explicit-any */
import { sendEmail } from "@/lib/email";
import { createWorkspaceNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const userDelegate = (prisma as typeof prisma & {
  user: {
    findMany: (...args: any[]) => Promise<any[]>;
  };
}).user;

type MentionRecipient = {
  email: string;
  name?: string | null;
};

type MentionNotificationInput = {
  workspaceId: string;
  commentId: string;
  commentContent: string;
  actor: {
    id: string;
    email: string;
    name?: string | null;
  };
  mentions: MentionRecipient[];
  transcriptionId?: string | null;
  actionTaskId?: string | null;
  projectInsightId?: string | null;
  workspaceInsightId?: string | null;
};

function buildAppOrigin() {
  const baseUrl = process.env.NEXTAUTH_URL?.trim();
  return (baseUrl || "http://localhost:3000").replace(/\/+$/, "");
}

function excerptComment(content: string, limit = 220) {
  const normalized = content.trim().replace(/\s+/g, " ");
  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit - 1)}...`;
}

export async function sendCommentMentionNotifications(
  input: MentionNotificationInput,
) {
  const recipients = input.mentions.filter(
    (mention) => mention.email.trim().toLowerCase() !== input.actor.email.trim().toLowerCase(),
  );

  if (!recipients.length) {
    return { delivered: 0 };
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: {
      id: true,
      name: true,
    },
  });

  if (!workspace) {
    return { delivered: 0 };
  }

  const contextDetails =
    input.actionTaskId
      ? await prisma.actionTask.findFirst({
          where: {
            id: input.actionTaskId,
            workspaceId: input.workspaceId,
          } as any,
          select: {
            id: true,
            title: true,
            transcription: {
              select: {
                id: true,
                fileName: true,
              },
            },
          },
        })
      : input.projectInsightId
        ? await prisma.projectInsight.findFirst({
            where: {
              id: input.projectInsightId,
              workspaceId: input.workspaceId,
            } as any,
            select: {
              id: true,
              title: true,
              project: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          })
      : input.workspaceInsightId
        ? await prisma.workspaceInsight.findFirst({
            where: {
              id: input.workspaceInsightId,
              workspaceId: input.workspaceId,
            } as any,
            select: {
              id: true,
              title: true,
            },
          })
      : input.transcriptionId
        ? await prisma.transcription.findFirst({
            where: {
              id: input.transcriptionId,
              workspaceId: input.workspaceId,
            } as any,
            select: {
              id: true,
              fileName: true,
            },
          })
        : null;

  const contextRecord = contextDetails as
    | {
        fileName?: string;
        title?: string;
        transcription?: {
          fileName?: string;
        } | null;
        project?: {
          name?: string;
        } | null;
      }
    | null;

  const transcriptName =
    input.actionTaskId && contextRecord?.transcription
      ? contextRecord.transcription?.fileName || "a transcript"
      : typeof contextRecord?.fileName === "string"
        ? contextRecord.fileName
        : "a transcript";
  const taskTitle =
    input.actionTaskId && typeof contextRecord?.title === "string"
      ? contextRecord.title
      : null;
  const insightTitle =
    (input.projectInsightId || input.workspaceInsightId) &&
    typeof contextRecord?.title === "string"
      ? contextRecord.title
      : null;
  const projectName =
    input.projectInsightId && typeof contextRecord?.project?.name === "string"
      ? contextRecord.project.name
      : null;

  const dashboardUrl = `${buildAppOrigin()}/dashboard`;
  const subject = insightTitle
    ? `${input.actor.name?.trim() || input.actor.email} mentioned you on an insight in ${workspace.name}`
    : taskTitle
      ? `${input.actor.name?.trim() || input.actor.email} mentioned you on a task in ${workspace.name}`
      : `${input.actor.name?.trim() || input.actor.email} mentioned you in ${workspace.name}`;
  const commentSnippet = excerptComment(input.commentContent);

  const recipientUsers = await userDelegate.findMany({
    where: {
      email: {
        in: recipients.map((recipient) => recipient.email),
      },
    },
    select: {
      id: true,
      email: true,
      notificationPreferences: {
        select: {
          mentionEmailEnabled: true,
          mentionInAppEnabled: true,
        },
      },
    },
  });

  const inAppRecipients = recipientUsers
    .filter(
      (user) =>
        user.email.trim().toLowerCase() !== input.actor.email.trim().toLowerCase() &&
        user.notificationPreferences?.mentionInAppEnabled !== false,
    )
    .map((user) => user.id);

  await createWorkspaceNotifications({
    workspaceId: input.workspaceId,
    recipients: inAppRecipients,
    type: "comment_mention",
    title: insightTitle
      ? "You were mentioned on an insight"
      : taskTitle
        ? "You were mentioned on a task"
        : "You were mentioned in a comment",
    body: `${input.actor.name?.trim() || input.actor.email} mentioned you in ${workspace.name}.`,
    link: "/dashboard",
    metadata: {
      commentId: input.commentId,
      transcriptionId: input.transcriptionId || null,
      actionTaskId: input.actionTaskId || null,
      projectInsightId: input.projectInsightId || null,
      workspaceInsightId: input.workspaceInsightId || null,
    },
  });

  await Promise.all(
    recipients
      .filter((recipient) => {
        const matchedUser = recipientUsers.find(
          (user) => user.email.trim().toLowerCase() === recipient.email.trim().toLowerCase(),
        );
        return matchedUser?.notificationPreferences?.mentionEmailEnabled !== false;
      })
      .map((recipient) =>
      sendEmail({
        to: recipient.email,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
            <h2 style="margin-bottom: 12px;">You were mentioned on Voxly</h2>
            <p><strong>${input.actor.name?.trim() || input.actor.email}</strong> mentioned you in <strong>${workspace.name}</strong>.</p>
            ${
              projectName
                ? `<p><strong>Project:</strong> ${projectName}</p>`
                : `<p><strong>Transcript:</strong> ${transcriptName}</p>`
            }
            ${
              taskTitle
                ? `<p><strong>Task:</strong> ${taskTitle}</p>`
                : ""
            }
            ${
              insightTitle
                ? `<p><strong>Insight:</strong> ${insightTitle}</p>`
                : ""
            }
            <div style="margin: 18px 0; padding: 14px 16px; border-radius: 14px; background: #f8fafc; border: 1px solid #e2e8f0;">
              ${commentSnippet}
            </div>
            <p style="margin: 20px 0;">
              <a href="${dashboardUrl}" style="display: inline-block; padding: 12px 18px; border-radius: 999px; background: #0f172a; color: white; text-decoration: none; font-weight: 700;">Open workspace</a>
            </p>
          </div>
        `,
        text: `${input.actor.name?.trim() || input.actor.email} mentioned you in ${workspace.name}.${projectName ? ` Project: ${projectName}.` : ` Transcript: ${transcriptName}.`}${taskTitle ? ` Task: ${taskTitle}.` : ""}${insightTitle ? ` Insight: ${insightTitle}.` : ""} Comment: ${commentSnippet}. Open: ${dashboardUrl}`,
      }),
    ),
  );

  return { delivered: recipients.length };
}
