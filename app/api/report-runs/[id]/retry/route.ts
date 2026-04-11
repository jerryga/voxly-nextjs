import { NextResponse } from "next/server";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import { getRecurringReportRun } from "@/lib/report-runs";
import { sendWorkspaceDigest } from "@/lib/workspace-digests";
import { sendProjectDigest } from "@/lib/project-digests";
import { createWorkspaceAuditLog } from "@/lib/workspace-audit";
import { canManageWorkspace, requireWorkspaceContext } from "@/lib/workspaces";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) {
      return originError;
    }

    const workspaceContext = await requireWorkspaceContext();
    if (!workspaceContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canManageWorkspace(workspaceContext.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = await context.params;
    const run = await getRecurringReportRun(workspaceContext.activeWorkspace.id, params.id);
    if (!run) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let result;
    if (run.scope === "project") {
      if (!run.projectId) {
        return NextResponse.json({ error: "Project run is missing its project context" }, { status: 400 });
      }
      result = await sendProjectDigest({
        projectId: run.projectId,
        actorUserId: workspaceContext.user.id,
        trigger: "manual",
      });
    } else {
      result = await sendWorkspaceDigest({
        workspaceId: workspaceContext.activeWorkspace.id,
        actorUserId: workspaceContext.user.id,
        trigger: "manual",
      });
    }

    await createWorkspaceAuditLog({
      workspaceId: workspaceContext.activeWorkspace.id,
      actorUserId: workspaceContext.user.id,
      action: "report_run.retried",
      targetType: "recurring_report_run",
      targetId: run.id,
      summary: `${workspaceContext.user.name?.trim() || workspaceContext.user.email} retried a ${run.scope} recurring report run.`,
      metadata: {
        scope: run.scope,
        reportType: run.reportType,
        originalRunId: run.id,
      },
    });

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
