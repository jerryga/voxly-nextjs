import { NextResponse } from "next/server";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import {
  workspaceSlackDestinationCreateSchema,
} from "@/lib/api/validation";
import {
  createWorkspaceSlackDestination,
  listWorkspaceSlackDestinations,
} from "@/lib/slack";
import { createWorkspaceAuditLog } from "@/lib/workspace-audit";
import { canManageWorkspace, requireWorkspaceContext } from "@/lib/workspaces";

export const runtime = "nodejs";

export async function GET() {
  try {
    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const destinations = await listWorkspaceSlackDestinations(context.activeWorkspace.id);
    return NextResponse.json({ ok: true, destinations });
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

    const parsed = workspaceSlackDestinationCreateSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const destination = await createWorkspaceSlackDestination({
      workspaceId: context.activeWorkspace.id,
      name: parsed.data.name,
      webhookUrl: parsed.data.webhookUrl,
    });

    await createWorkspaceAuditLog({
      workspaceId: context.activeWorkspace.id,
      actorUserId: context.user.id,
      action: "workspace.slack_destination.created",
      targetType: "workspace_slack_destination",
      targetId: destination.id,
      summary: `${context.user.name?.trim() || context.user.email} created Slack destination ${destination.name}.`,
    });

    return NextResponse.json({ ok: true, destination });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
