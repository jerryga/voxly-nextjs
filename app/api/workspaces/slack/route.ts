import { NextResponse } from "next/server";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import { workspaceSlackUpdateSchema } from "@/lib/api/validation";
import {
  deleteWorkspaceSlackSettings,
  getWorkspaceSlackSettings,
  sendWorkspaceSlackTest,
  updateWorkspaceSlackSettings,
} from "@/lib/slack";
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

    const settings = await getWorkspaceSlackSettings(context.activeWorkspace.id);
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

    const parsed = workspaceSlackUpdateSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const settings = await updateWorkspaceSlackSettings(
      context.activeWorkspace.id,
      parsed.data,
    );

    await createWorkspaceAuditLog({
      workspaceId: context.activeWorkspace.id,
      actorUserId: context.user.id,
      action: "workspace.slack.updated",
      targetType: "workspace_slack",
      summary: `${context.user.name?.trim() || context.user.email} updated Slack integration settings.`,
      metadata: {
        enabled: settings.enabled,
        sendDigests: settings.sendDigests,
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

    await sendWorkspaceSlackTest({
      workspaceId: context.activeWorkspace.id,
      workspaceName: context.activeWorkspace.name,
      actorUserId: context.user.id,
      actorName: context.user.name?.trim() || context.user.email,
    });

    const settings = await getWorkspaceSlackSettings(context.activeWorkspace.id);

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

    const settings = await deleteWorkspaceSlackSettings(context.activeWorkspace.id);

    await createWorkspaceAuditLog({
      workspaceId: context.activeWorkspace.id,
      actorUserId: context.user.id,
      action: "workspace.slack.deleted",
      targetType: "workspace_slack",
      summary: `${context.user.name?.trim() || context.user.email} disconnected Slack integration settings.`,
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
