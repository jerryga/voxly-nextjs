/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import { createWorkspaceAuditLog } from "@/lib/workspace-audit";
import { canManageWorkspace, requireWorkspaceContext } from "@/lib/workspaces";

export const runtime = "nodejs";

const recurringReportTemplateDelegate = (prisma as typeof prisma & {
  recurringReportTemplate: {
    findFirst: (...args: any[]) => Promise<any>;
    delete: (...args: any[]) => Promise<any>;
  };
}).recurringReportTemplate;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
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
    const template = await recurringReportTemplateDelegate.findFirst({
      where: {
        id: params.id,
        workspaceId: workspaceContext.activeWorkspace.id,
      } as any,
      select: {
        id: true,
        name: true,
        targetScope: true,
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await recurringReportTemplateDelegate.delete({
      where: { id: template.id },
    });

    await createWorkspaceAuditLog({
      workspaceId: workspaceContext.activeWorkspace.id,
      actorUserId: workspaceContext.user.id,
      action: "report_template.deleted",
      targetType: "recurring_report_template",
      targetId: template.id,
      summary: `${workspaceContext.user.name?.trim() || workspaceContext.user.email} deleted recurring report template ${template.name}.`,
      metadata: {
        targetScope: template.targetScope,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
