/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import { recurringReportTemplateCreateSchema } from "@/lib/api/validation";
import { createWorkspaceAuditLog } from "@/lib/workspace-audit";
import { canManageWorkspace, requireWorkspaceContext } from "@/lib/workspaces";

export const runtime = "nodejs";

const recurringReportTemplateDelegate = (prisma as typeof prisma & {
  recurringReportTemplate: {
    findMany: (...args: any[]) => Promise<any[]>;
    create: (...args: any[]) => Promise<any>;
  };
}).recurringReportTemplate;

export async function GET() {
  try {
    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const templates = await recurringReportTemplateDelegate.findMany({
      where: {
        workspaceId: context.activeWorkspace.id,
      } as any,
      orderBy: [{ targetScope: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        targetScope: true,
        cadence: true,
        reportType: true,
        weekday: true,
        dayOfMonth: true,
        hourLocal: true,
        timezone: true,
        recipientScope: true,
        sendEmail: true,
        sendSlack: true,
        slackDestinationId: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ ok: true, templates });
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

    const parsed = recurringReportTemplateCreateSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const template = await recurringReportTemplateDelegate.create({
      data: {
        workspaceId: context.activeWorkspace.id,
        createdById: context.user.id,
        ...parsed.data,
      } as any,
      select: {
        id: true,
        name: true,
        targetScope: true,
        cadence: true,
        reportType: true,
        weekday: true,
        dayOfMonth: true,
        hourLocal: true,
        timezone: true,
        recipientScope: true,
        sendEmail: true,
        sendSlack: true,
        slackDestinationId: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    await createWorkspaceAuditLog({
      workspaceId: context.activeWorkspace.id,
      actorUserId: context.user.id,
      action: "report_template.created",
      targetType: "recurring_report_template",
      targetId: template.id,
      summary: `${context.user.name?.trim() || context.user.email} created recurring report template ${template.name}.`,
      metadata: {
        targetScope: template.targetScope,
        cadence: template.cadence,
        reportType: template.reportType,
        recipientScope: template.recipientScope,
      },
    });

    return NextResponse.json({ ok: true, template });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
