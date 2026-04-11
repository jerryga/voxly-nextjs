/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import { projectDigestUpdateSchema } from "@/lib/api/validation";
import {
  getProjectDigestSettings,
  sendProjectDigest,
  updateProjectDigestSettings,
} from "@/lib/project-digests";
import { createWorkspaceAuditLog } from "@/lib/workspace-audit";
import {
  canManageWorkspace,
  requireWorkspaceContext,
} from "@/lib/workspaces";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const workspaceContext = await requireWorkspaceContext();
    if (!workspaceContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        workspaceId: workspaceContext.activeWorkspace.id,
      } as any,
      select: {
        id: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const settings = await getProjectDigestSettings(project.id);
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
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
    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        workspaceId: workspaceContext.activeWorkspace.id,
      } as any,
      select: {
        id: true,
        name: true,
      },
    });
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const parsed = projectDigestUpdateSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const settings = await updateProjectDigestSettings(project.id, parsed.data);

    await createWorkspaceAuditLog({
      workspaceId: workspaceContext.activeWorkspace.id,
      actorUserId: workspaceContext.user.id,
      action: "project.digest.updated",
      targetType: "project_digest",
      targetId: settings.id,
      summary: `${workspaceContext.user.name?.trim() || workspaceContext.user.email} updated digest settings for ${project.name}.`,
      metadata: {
        projectId: project.id,
        projectName: project.name,
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
    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        workspaceId: workspaceContext.activeWorkspace.id,
      } as any,
      select: {
        id: true,
      },
    });
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result = await sendProjectDigest({
      projectId: project.id,
      actorUserId: workspaceContext.user.id,
      trigger: "manual",
    });

    const settings = await getProjectDigestSettings(project.id);
    return NextResponse.json({ ok: true, result, settings });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
