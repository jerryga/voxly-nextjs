import { NextResponse } from "next/server";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import { workspaceDigestUpdateSchema } from "@/lib/api/validation";
import {
  getWorkspaceDigestSettings,
  sendWorkspaceDigest,
  updateWorkspaceDigestSettings,
} from "@/lib/workspace-digests";
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

    const settings = await getWorkspaceDigestSettings(context.activeWorkspace.id);
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

    const parsed = workspaceDigestUpdateSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const settings = await updateWorkspaceDigestSettings(
      context.activeWorkspace.id,
      parsed.data,
    );

    await createWorkspaceAuditLog({
      workspaceId: context.activeWorkspace.id,
      actorUserId: context.user.id,
      action: "workspace.digest.updated",
      targetType: "workspace_digest",
      targetId: settings.id,
      summary: `${context.user.name?.trim() || context.user.email} updated workspace digest settings.`,
      metadata: {
        enabled: settings.enabled,
        cadence: settings.cadence,
        reportType: settings.reportType,
        weekday: settings.weekday,
        dayOfMonth: settings.dayOfMonth,
        hourLocal: settings.hourLocal,
        timezone: settings.timezone,
        recipientScope: settings.recipientScope,
        sendEmail: settings.sendEmail,
        sendSlack: settings.sendSlack,
        slackDestinationId: settings.slackDestinationId,
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

    const result = await sendWorkspaceDigest({
      workspaceId: context.activeWorkspace.id,
      actorUserId: context.user.id,
      trigger: "manual",
    });

    const settings = await getWorkspaceDigestSettings(context.activeWorkspace.id);

    return NextResponse.json({ ok: true, result, settings });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
