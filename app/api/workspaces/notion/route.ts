import { NextResponse } from "next/server";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import { workspaceNotionUpdateSchema } from "@/lib/api/validation";
import {
  deleteWorkspaceNotionSettings,
  getWorkspaceNotionSettings,
  updateWorkspaceNotionSettings,
  validateWorkspaceNotionSettings,
} from "@/lib/notion";
import { createWorkspaceAuditLog } from "@/lib/workspace-audit";
import {
  canManageWorkspace,
  requireWorkspaceContext,
} from "@/lib/workspaces";

export const runtime = "nodejs";

export async function GET() {
  try {
    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await getWorkspaceNotionSettings(context.activeWorkspace.id);
    return NextResponse.json({ ok: true, settings });
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

    const parsed = workspaceNotionUpdateSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid request body" },
        { status: 400 },
      );
    }

    const settings = await updateWorkspaceNotionSettings(
      context.activeWorkspace.id,
      parsed.data,
    );

    await createWorkspaceAuditLog({
      workspaceId: context.activeWorkspace.id,
      actorUserId: context.user.id,
      action: "workspace.notion.updated",
      targetType: "workspace_notion",
      summary: `${context.user.name?.trim() || context.user.email} updated Notion integration settings.`,
      metadata: {
        enabled: settings.enabled,
        configured: settings.configured,
        parentPageId: settings.parentPageId,
      },
    });

    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}

export async function POST(request: Request) {
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

    const settings = await validateWorkspaceNotionSettings(context.activeWorkspace.id);
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}

export async function DELETE(request: Request) {
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

    const settings = await deleteWorkspaceNotionSettings(context.activeWorkspace.id);

    await createWorkspaceAuditLog({
      workspaceId: context.activeWorkspace.id,
      actorUserId: context.user.id,
      action: "workspace.notion.deleted",
      targetType: "workspace_notion",
      summary: `${context.user.name?.trim() || context.user.email} disconnected Notion integration settings.`,
      metadata: {
        configured: settings.configured,
      },
    });

    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
