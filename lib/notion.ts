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
    deleteMany: (...args: any[]) => Promise<any>;
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

function getNotionErrorMessage(status: number, payload: string) {
  let parsed: { code?: string; message?: string } | null = null;
  try {
    parsed = JSON.parse(payload) as { code?: string; message?: string };
  } catch {
    parsed = null;
  }

  const message = parsed?.message || payload;
  const code = parsed?.code || "";

  if (status === 401) {
    return "Notion rejected the integration token. Paste a valid internal integration secret and save again.";
  }

  if (status === 403 || code === "restricted_resource") {
    return "Notion could not access that page. Share the parent page with your Voxly integration in Notion, then validate again.";
  }

  if (status === 404 || code === "object_not_found") {
    return "Notion could not find that page. Check the parent page ID or URL, and make sure the page is shared with your integration.";
  }

  if (status === 400 && code === "validation_error") {
    return `Notion rejected the page request: ${message}`;
  }

  if (status === 429) {
    return "Notion rate limited the request. Wait a moment, then validate again.";
  }

  return `Notion API error: ${status} ${message}`;
}

function getNotionErrorStatus(status: number) {
  if ([400, 401, 403, 404].includes(status)) {
    return 400;
  }

  if (status === 429) {
    return 429;
  }

  return 502;
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
    const error = new Error(
      getNotionErrorMessage(response.status, payload),
    ) as Error & {
      statusCode?: number;
    };
    error.statusCode = getNotionErrorStatus(response.status);
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

export async function deleteWorkspaceNotionSettings(workspaceId: string) {
  await notionDelegate.deleteMany({
    where: { workspaceId },
  });

  return serializeSettings(null);
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

// Requires only that Notion is connected (token + parent page saved).
// Use this for manual publish actions where the user explicitly requests the push,
// regardless of the workspace-level `enabled` toggle.
async function requireConnectedNotionSettings(workspaceId: string) {
  const settings = await getSettingsRecord(workspaceId);
  if (!settings || !settings.apiToken?.trim() || !settings.parentPageId?.trim()) {
    const error = new Error("Notion is not connected for this workspace.") as Error & {
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

export async function publishSessionToNotion(input: {
  workspaceId: string;
  title: string;
  markdown: string;
  actorUserId?: string | null;
  actorName: string;
}) {
  const settings = await requireConnectedNotionSettings(input.workspaceId);
  const parentPageId = normalizePageId(settings.parentPageId);

  const response = await notionRequest<{ id: string; url?: string }>(settings.apiToken, "/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { type: "page_id", page_id: parentPageId },
      properties: {
        title: [{ text: { content: input.title.slice(0, 200) } }],
      },
      markdown: input.markdown,
    }),
  });

  await notionDelegate.update({
    where: { workspaceId: input.workspaceId },
    data: { lastSyncedAt: new Date() },
  });

  await createWorkspaceAuditLog({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId || null,
    action: "workspace.notion.session_published",
    targetType: "workspace_notion",
    targetId: settings.id,
    summary: `${input.actorName} published session "${input.title}" to Notion.`,
    metadata: { title: input.title, notionPageId: response.id, notionUrl: response.url || null },
  });

  return { pageId: response.id, url: response.url || null };
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
