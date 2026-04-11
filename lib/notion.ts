/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { createWorkspaceAuditLog } from "@/lib/workspace-audit";

const NOTION_VERSION = "2026-03-11";

type WorkspaceNotionSettingsRecord = {
  id: string;
  workspaceId: string;
  enabled: boolean;
  apiToken: string;
  parentPageId: string;
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt: Date | null;
};

type WorkspaceNotionSettingsInput = {
  enabled: boolean;
  apiToken?: string;
  parentPageId?: string;
};

const notionDelegate = (prisma as typeof prisma & {
  workspaceNotionSettings: {
    findUnique: (...args: any[]) => Promise<any>;
    upsert: (...args: any[]) => Promise<any>;
    update: (...args: any[]) => Promise<any>;
  };
}).workspaceNotionSettings;

function normalizePageId(value: string) {
  return value.trim().replace(/-/g, "");
}

export function maskNotionToken(token: string | null | undefined) {
  if (!token) {
    return null;
  }
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function serializeSettings(settings: WorkspaceNotionSettingsRecord | null) {
  if (!settings) {
    return {
      configured: false,
      enabled: false,
      maskedToken: null,
      parentPageId: null,
      updatedAt: null,
      lastSyncedAt: null,
    };
  }

  return {
    configured: true,
    enabled: settings.enabled,
    maskedToken: maskNotionToken(settings.apiToken),
    parentPageId: settings.parentPageId,
    updatedAt: settings.updatedAt.toISOString(),
    lastSyncedAt: settings.lastSyncedAt?.toISOString() || null,
  };
}

async function notionRequest<T>(
  apiToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const payload = await response.text();
    const error = new Error(`Notion API error: ${response.status} ${payload}`) as Error & {
      statusCode?: number;
    };
    error.statusCode = 502;
    throw error;
  }

  return (await response.json()) as T;
}

async function getSettingsRecord(workspaceId: string) {
  return (await notionDelegate.findUnique({
    where: { workspaceId },
  })) as WorkspaceNotionSettingsRecord | null;
}

export async function getWorkspaceNotionSettings(workspaceId: string) {
  const settings = await getSettingsRecord(workspaceId);
  return serializeSettings(settings);
}

export async function updateWorkspaceNotionSettings(
  workspaceId: string,
  input: WorkspaceNotionSettingsInput,
) {
  const existing = await getSettingsRecord(workspaceId);
  const apiToken = input.apiToken?.trim() || existing?.apiToken || "";
  const parentPageId = input.parentPageId?.trim() || existing?.parentPageId || "";

  if (!apiToken || !parentPageId) {
    const error = new Error("Notion token and parent page ID are required.") as Error & {
      statusCode?: number;
    };
    error.statusCode = 400;
    throw error;
  }

  const settings = (await notionDelegate.upsert({
    where: { workspaceId },
    update: {
      enabled: input.enabled,
      apiToken,
      parentPageId,
    },
    create: {
      workspaceId,
      enabled: input.enabled,
      apiToken,
      parentPageId,
    },
  })) as WorkspaceNotionSettingsRecord;

  return serializeSettings(settings);
}

async function requireEnabledNotionSettings(workspaceId: string) {
  const settings = await getSettingsRecord(workspaceId);
  if (!settings || !settings.enabled) {
    const error = new Error("Notion is not configured for this workspace.") as Error & {
      statusCode?: number;
    };
    error.statusCode = 400;
    throw error;
  }
  return settings;
}

export async function validateWorkspaceNotionSettings(workspaceId: string) {
  const settings = await requireEnabledNotionSettings(workspaceId);
  const pageId = normalizePageId(settings.parentPageId);

  await notionRequest(settings.apiToken, `/blocks/${pageId}/children?page_size=1`, {
    method: "GET",
  });

  await notionDelegate.update({
    where: { workspaceId },
    data: {
      lastSyncedAt: new Date(),
    },
  });

  return serializeSettings(settings);
}

export async function publishInsightToNotion(input: {
  workspaceId: string;
  title: string;
  markdown: string;
  actorUserId?: string | null;
  actorName: string;
  scopeLabel: string;
}) {
  const settings = await requireEnabledNotionSettings(input.workspaceId);
  const parentPageId = normalizePageId(settings.parentPageId);

  const response = await notionRequest<{ id: string; url?: string }>(settings.apiToken, "/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: {
        type: "page_id",
        page_id: parentPageId,
      },
      properties: {
        title: [
          {
            text: {
              content: input.title.slice(0, 200),
            },
          },
        ],
      },
      markdown: input.markdown,
    }),
  });

  await notionDelegate.update({
    where: { workspaceId: input.workspaceId },
    data: {
      lastSyncedAt: new Date(),
    },
  });

  await createWorkspaceAuditLog({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId || null,
    action: "workspace.notion.insight_published",
    targetType: "workspace_notion",
    targetId: settings.id,
    summary: `${input.actorName} published a ${input.scopeLabel.toLowerCase()} insight to Notion.`,
    metadata: {
      title: input.title,
      scope: input.scopeLabel,
      notionPageId: response.id,
      notionUrl: response.url || null,
    },
  });

  return {
    pageId: response.id,
    url: response.url || null,
  };
}
