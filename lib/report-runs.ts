/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";

const recurringReportRunDelegate = (prisma as typeof prisma & {
  recurringReportRun: {
    create: (...args: any[]) => Promise<any>;
    findMany: (...args: any[]) => Promise<any[]>;
    findFirst: (...args: any[]) => Promise<any>;
  };
}).recurringReportRun;

export async function createRecurringReportRun(input: {
  workspaceId: string;
  projectId?: string | null;
  scope: "workspace" | "project";
  trigger: "manual" | "scheduled";
  cadence: string;
  reportType: string;
  recipientScope: string;
  sendEmail: boolean;
  sendSlack: boolean;
  slackDestinationId?: string | null;
  emailRecipientCount: number;
  slackDelivered: boolean;
  status?: "success" | "failed";
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  return recurringReportRunDelegate.create({
    data: {
      workspaceId: input.workspaceId,
      projectId: input.projectId || null,
      scope: input.scope,
      trigger: input.trigger,
      cadence: input.cadence,
      reportType: input.reportType,
      recipientScope: input.recipientScope,
      sendEmail: input.sendEmail,
      sendSlack: input.sendSlack,
      slackDestinationId: input.slackDestinationId || null,
      emailRecipientCount: input.emailRecipientCount,
      slackDelivered: input.slackDelivered,
      status: input.status || "success",
      summary: input.summary,
      metadata: input.metadata || undefined,
    },
  });
}

export async function listRecurringReportRuns(workspaceId: string, limit = 25) {
  return listRecurringReportRunsWithFilters(workspaceId, {
    limit,
  });
}

export async function listRecurringReportRunsWithFilters(
  workspaceId: string,
  input: {
    limit?: number;
    scope?: "workspace" | "project" | "all";
    status?: "success" | "failed" | "all";
  } = {},
) {
  const runs = await recurringReportRunDelegate.findMany({
    where: {
      workspaceId,
      ...(input.scope && input.scope !== "all" ? { scope: input.scope } : {}),
      ...(input.status && input.status !== "all" ? { status: input.status } : {}),
    } as any,
    orderBy: [{ createdAt: "desc" }],
    take: input.limit ?? 25,
    select: {
      id: true,
      scope: true,
      trigger: true,
      cadence: true,
      reportType: true,
      recipientScope: true,
      sendEmail: true,
      sendSlack: true,
      emailRecipientCount: true,
      slackDelivered: true,
      status: true,
      summary: true,
      metadata: true,
      createdAt: true,
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return runs.map((run) => ({
    ...run,
    createdAt: run.createdAt.toISOString(),
  }));
}

export async function getRecurringReportRun(workspaceId: string, runId: string) {
  const run = await recurringReportRunDelegate.findFirst({
    where: {
      id: runId,
      workspaceId,
    } as any,
    select: {
      id: true,
      workspaceId: true,
      projectId: true,
      scope: true,
      trigger: true,
      cadence: true,
      reportType: true,
      recipientScope: true,
      sendEmail: true,
      sendSlack: true,
      slackDestinationId: true,
      emailRecipientCount: true,
      slackDelivered: true,
      status: true,
      summary: true,
      metadata: true,
      createdAt: true,
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!run) {
    return null;
  }

  return {
    ...run,
    createdAt: run.createdAt.toISOString(),
  };
}

export async function summarizeRecurringReportRuns(
  workspaceId: string,
  input: {
    days?: number;
  } = {},
) {
  const days = Math.max(1, Math.min(input.days ?? 30, 365));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const runs = await recurringReportRunDelegate.findMany({
    where: {
      workspaceId,
      createdAt: {
        gte: since,
      },
    } as any,
    select: {
      scope: true,
      trigger: true,
      sendEmail: true,
      sendSlack: true,
      emailRecipientCount: true,
      slackDelivered: true,
      status: true,
      reportType: true,
    },
  });

  const totalRuns = runs.length;
  const successCount = runs.filter((run) => run.status === "success").length;
  const failedCount = runs.filter((run) => run.status === "failed").length;
  const workspaceRuns = runs.filter((run) => run.scope === "workspace").length;
  const projectRuns = runs.filter((run) => run.scope === "project").length;
  const manualRuns = runs.filter((run) => run.trigger === "manual").length;
  const scheduledRuns = runs.filter((run) => run.trigger === "scheduled").length;
  const emailRuns = runs.filter((run) => run.sendEmail).length;
  const slackRuns = runs.filter((run) => run.sendSlack).length;
  const slackDeliveredCount = runs.filter((run) => run.slackDelivered).length;
  const emailRecipientCount = runs.reduce(
    (sum, run) => sum + (run.emailRecipientCount || 0),
    0,
  );

  const reportTypeCounts = runs.reduce<Record<string, number>>((acc, run) => {
    acc[run.reportType] = (acc[run.reportType] || 0) + 1;
    return acc;
  }, {});

  const topReportType =
    Object.entries(reportTypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return {
    days,
    totalRuns,
    successCount,
    failedCount,
    successRate:
      totalRuns > 0 ? Math.round((successCount / totalRuns) * 1000) / 10 : 0,
    workspaceRuns,
    projectRuns,
    manualRuns,
    scheduledRuns,
    emailRuns,
    slackRuns,
    slackDeliveredCount,
    emailRecipientCount,
    topReportType,
  };
}
