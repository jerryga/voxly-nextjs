/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { createWorkspaceAuditLog } from "@/lib/workspace-audit";

type WorkspaceSlackSettingsRecord = {
  id: string;
  workspaceId: string;
  enabled: boolean;
  sendDigests: boolean;
  webhookUrl: string;
  createdAt: Date;
  updatedAt: Date;
};

type WorkspaceSlackDestinationRecord = {
  id: string;
  workspaceId: string;
  name: string;
  webhookUrl: string;
  createdAt: Date;
  updatedAt: Date;
};

type WorkspaceSlackSettingsInput = {
  enabled: boolean;
  sendDigests: boolean;
  webhookUrl?: string;
};

const slackDelegate = (prisma as typeof prisma & {
  workspaceSlackSettings: {
    findUnique: (...args: any[]) => Promise<any>;
    upsert: (...args: any[]) => Promise<any>;
  };
}).workspaceSlackSettings;

const slackDestinationDelegate = (prisma as typeof prisma & {
  workspaceSlackDestination: {
    findMany: (...args: any[]) => Promise<any[]>;
    findFirst: (...args: any[]) => Promise<any>;
    create: (...args: any[]) => Promise<any>;
    delete: (...args: any[]) => Promise<any>;
  };
}).workspaceSlackDestination;

function trimWebhookUrl(webhookUrl?: string) {
  return webhookUrl?.trim() || "";
}

export function maskSlackWebhook(webhookUrl: string | null | undefined) {
  if (!webhookUrl) {
    return null;
  }

  const parts = webhookUrl.split("/");
  const tail = parts.slice(-2).join("/");
  return `…/${tail}`;
}

function serializeSlackSettings(settings: WorkspaceSlackSettingsRecord | null) {
  if (!settings) {
    return {
      configured: false,
      enabled: false,
      sendDigests: true,
      maskedWebhook: null,
      updatedAt: null,
    };
  }

  return {
    configured: true,
    enabled: settings.enabled,
    sendDigests: settings.sendDigests,
    maskedWebhook: maskSlackWebhook(settings.webhookUrl),
    updatedAt: settings.updatedAt.toISOString(),
  };
}

function serializeSlackDestination(settings: WorkspaceSlackDestinationRecord) {
  return {
    id: settings.id,
    workspaceId: settings.workspaceId,
    name: settings.name,
    maskedWebhook: maskSlackWebhook(settings.webhookUrl),
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString(),
  };
}

export async function getWorkspaceSlackSettings(workspaceId: string) {
  const settings = (await slackDelegate.findUnique({
    where: { workspaceId },
  })) as WorkspaceSlackSettingsRecord | null;

  return serializeSlackSettings(settings);
}

async function getWorkspaceSlackSettingsRecord(workspaceId: string) {
  return (await slackDelegate.findUnique({
    where: { workspaceId },
  })) as WorkspaceSlackSettingsRecord | null;
}

export async function listWorkspaceSlackDestinations(workspaceId: string) {
  const destinations = (await slackDestinationDelegate.findMany({
    where: { workspaceId },
    orderBy: [{ createdAt: "desc" }],
  })) as WorkspaceSlackDestinationRecord[];

  return destinations.map(serializeSlackDestination);
}

export async function createWorkspaceSlackDestination(input: {
  workspaceId: string;
  name: string;
  webhookUrl: string;
}) {
  const destination = (await slackDestinationDelegate.create({
    data: {
      workspaceId: input.workspaceId,
      name: input.name.trim(),
      webhookUrl: trimWebhookUrl(input.webhookUrl),
    },
  })) as WorkspaceSlackDestinationRecord;

  return serializeSlackDestination(destination);
}

export async function deleteWorkspaceSlackDestination(workspaceId: string, destinationId: string) {
  const destination = (await slackDestinationDelegate.findFirst({
    where: {
      id: destinationId,
      workspaceId,
    },
  })) as WorkspaceSlackDestinationRecord | null;

  if (!destination) {
    const error = new Error("Slack destination not found") as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  await slackDestinationDelegate.delete({
    where: { id: destination.id },
  });

  return serializeSlackDestination(destination);
}

export async function updateWorkspaceSlackSettings(
  workspaceId: string,
  input: WorkspaceSlackSettingsInput,
) {
  const existing = await getWorkspaceSlackSettingsRecord(workspaceId);
  const nextWebhookUrl = trimWebhookUrl(input.webhookUrl) || existing?.webhookUrl || "";

  if (!nextWebhookUrl) {
    const error = new Error("A Slack webhook URL is required to enable this integration.") as Error & {
      statusCode?: number;
    };
    error.statusCode = 400;
    throw error;
  }

  const settings = (await slackDelegate.upsert({
    where: { workspaceId },
    update: {
      enabled: input.enabled,
      sendDigests: input.sendDigests,
      webhookUrl: nextWebhookUrl,
    },
    create: {
      workspaceId,
      enabled: input.enabled,
      sendDigests: input.sendDigests,
      webhookUrl: nextWebhookUrl,
    },
  })) as WorkspaceSlackSettingsRecord;

  return serializeSlackSettings(settings);
}

async function postSlackWebhook(webhookUrl: string, payload: Record<string, unknown>) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Slack delivery failed: ${response.status} ${body}`) as Error & {
      statusCode?: number;
    };
    error.statusCode = 502;
    throw error;
  }
}

async function requireEnabledSlackSettings(workspaceId: string) {
  const settings = await getWorkspaceSlackSettingsRecord(workspaceId);
  if (!settings || !settings.enabled || !settings.webhookUrl.trim()) {
    const error = new Error("Slack is not configured for this workspace.") as Error & {
      statusCode?: number;
    };
    error.statusCode = 400;
    throw error;
  }

  return settings;
}

async function resolveSlackWebhook(workspaceId: string, destinationId?: string | null) {
  if (destinationId) {
    const destination = (await slackDestinationDelegate.findFirst({
      where: {
        id: destinationId,
        workspaceId,
      },
    })) as WorkspaceSlackDestinationRecord | null;

    if (!destination || !destination.webhookUrl.trim()) {
      const error = new Error("Selected Slack destination is not available.") as Error & {
        statusCode?: number;
      };
      error.statusCode = 400;
      throw error;
    }

    return {
      webhookUrl: destination.webhookUrl,
      destinationId: destination.id,
      destinationName: destination.name,
    };
  }

  const settings = await requireEnabledSlackSettings(workspaceId);
  return {
    webhookUrl: settings.webhookUrl,
    destinationId: null,
    destinationName: "Default workspace destination",
  };
}

export async function sendWorkspaceSlackTest(input: {
  workspaceId: string;
  workspaceName: string;
  actorUserId?: string | null;
  actorName: string;
}) {
  const settings = await requireEnabledSlackSettings(input.workspaceId);

  await postSlackWebhook(settings.webhookUrl, {
    text: `${input.workspaceName} is now connected to Slack.`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${input.workspaceName} is connected`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Slack delivery is active for *${input.workspaceName}*. Triggered by *${input.actorName}*.`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Voxly test delivery",
          },
        ],
      },
    ],
  });

  await createWorkspaceAuditLog({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId || null,
    action: "workspace.slack.test_sent",
    targetType: "workspace_slack",
    targetId: settings.id,
    summary: `${input.actorName} sent a Slack test message.`,
  });
}

export async function sendWorkspaceDigestToSlack(input: {
  workspaceId: string;
  destinationId?: string | null;
  workspaceName: string;
  scheduleLabel: string;
  openTasks: number;
  workspaceInsightTitles: string[];
  projectInsightTitles: string[];
  trigger: "manual" | "scheduled";
}) {
  const settings = await getWorkspaceSlackSettingsRecord(input.workspaceId);
  if (!settings || !settings.enabled || !settings.sendDigests || !settings.webhookUrl.trim()) {
    return { delivered: false as const };
  }

  const destination = await resolveSlackWebhook(input.workspaceId, input.destinationId);

  await postSlackWebhook(destination.webhookUrl, {
    text: `${input.workspaceName} weekly digest`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${input.workspaceName} weekly digest`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Schedule:* ${input.scheduleLabel}\n*Open tasks:* ${input.openTasks}\n*Trigger:* ${input.trigger}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*Recent workspace insights*\n${input.workspaceInsightTitles.length ? input.workspaceInsightTitles.map((title) => `• ${title}`).join("\n") : "• No new workspace insights"}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*Recent project insights*\n${input.projectInsightTitles.length ? input.projectInsightTitles.map((title) => `• ${title}`).join("\n") : "• No new project insights"}`,
        },
      },
    ],
  });

  return { delivered: true as const, destinationName: destination.destinationName };
}

export async function sendProjectDigestToSlack(input: {
  workspaceId: string;
  destinationId?: string | null;
  projectName: string;
  scheduleLabel: string;
  transcriptCount: number;
  openTasks: number;
  insightTitles: string[];
  trigger: "manual" | "scheduled";
}) {
  const settings = await getWorkspaceSlackSettingsRecord(input.workspaceId);
  if (!settings || !settings.enabled || !settings.sendDigests || !settings.webhookUrl.trim()) {
    return { delivered: false as const };
  }

  const destination = await resolveSlackWebhook(input.workspaceId, input.destinationId);

  await postSlackWebhook(destination.webhookUrl, {
    text: `${input.projectName} weekly digest`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${input.projectName} weekly digest`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Schedule:* ${input.scheduleLabel}\n*Processed transcripts:* ${input.transcriptCount}\n*Open tasks:* ${input.openTasks}\n*Trigger:* ${input.trigger}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Recent project insights*\n${input.insightTitles.length ? input.insightTitles.map((title) => `• ${title}`).join("\n") : "• No new project insights"}`,
        },
      },
    ],
  });

  return { delivered: true as const, destinationName: destination.destinationName };
}

export async function shareInsightToSlack(input: {
  workspaceId: string;
  title: string;
  question: string;
  answer: string;
  sourceCount: number;
  actorUserId?: string | null;
  actorName: string;
  scopeLabel: string;
  note?: string;
}) {
  const settings = await requireEnabledSlackSettings(input.workspaceId);
  const answerSnippet =
    input.answer.length > 900 ? `${input.answer.slice(0, 897)}...` : input.answer;
  const note = input.note?.trim();

  await postSlackWebhook(settings.webhookUrl, {
    text: `${input.actorName} shared an insight from Voxly`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: input.title,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Scope:* ${input.scopeLabel}\n*Shared by:* ${input.actorName}\n*Sources:* ${input.sourceCount}`,
        },
      },
      ...(note
        ? [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Note:* ${note}`,
              },
            },
          ]
        : []),
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Question*\n${input.question}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Answer*\n${answerSnippet}`,
        },
      },
    ],
  });

  await createWorkspaceAuditLog({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId || null,
    action: "workspace.slack.insight_shared",
    targetType: "workspace_slack",
    targetId: settings.id,
    summary: `${input.actorName} shared an insight to Slack.`,
    metadata: {
      title: input.title,
      scope: input.scopeLabel,
      sourceCount: input.sourceCount,
    },
  });
}
