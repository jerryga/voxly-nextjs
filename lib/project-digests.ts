/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { createWorkspaceNotifications } from "@/lib/notifications";
import { createWorkspaceAuditLog } from "@/lib/workspace-audit";
import { sendProjectDigestToSlack } from "@/lib/slack";
import { createRecurringReportRun } from "@/lib/report-runs";

type ProjectDigestSettingsRecord = {
  id: string;
  projectId: string;
  enabled: boolean;
  cadence: string;
  reportType: string;
  weekday: number;
  dayOfMonth: number;
  hourLocal: number;
  timezone: string;
  recipientScope: string;
  sendEmail: boolean;
  sendSlack: boolean;
  slackDestinationId: string | null;
  lastSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ProjectDigestSettingsInput = {
  enabled: boolean;
  cadence: "weekly" | "monthly";
  reportType: "summary" | "new_insights" | "open_tasks" | "risk_watch";
  weekday: number;
  dayOfMonth: number;
  hourLocal: number;
  timezone: string;
  recipientScope: "managers" | "all_members";
  sendEmail: boolean;
  sendSlack: boolean;
  slackDestinationId?: string | null;
};

type ProjectReportType = ProjectDigestSettingsInput["reportType"];

const weekdayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const shortWeekdayMap: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const projectDigestDelegate = (prisma as typeof prisma & {
  projectDigestSettings: {
    findUnique: (...args: any[]) => Promise<any>;
    findMany: (...args: any[]) => Promise<any[]>;
    upsert: (...args: any[]) => Promise<any>;
    update: (...args: any[]) => Promise<any>;
  };
}).projectDigestSettings;

const workspaceMemberDelegate = (prisma as typeof prisma & {
  workspaceMember: {
    findMany: (...args: any[]) => Promise<any[]>;
  };
}).workspaceMember;

function sanitizeTimeZone(timeZone: string) {
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "UTC";
  }
}

function formatHourLabel(hourLocal: number) {
  const suffix = hourLocal >= 12 ? "PM" : "AM";
  const displayHour = hourLocal % 12 === 0 ? 12 : hourLocal % 12;
  return `${displayHour}:00 ${suffix}`;
}

function getProjectReportLabel(reportType: ProjectReportType) {
  switch (reportType) {
    case "new_insights":
      return "New insights report";
    case "open_tasks":
      return "Open tasks report";
    case "risk_watch":
      return "Risk watch report";
    default:
      return "Summary report";
  }
}

function getProjectReportIntro(reportType: ProjectReportType) {
  switch (reportType) {
    case "new_insights":
      return "This recurring report focuses on the newest insights captured for this project.";
    case "open_tasks":
      return "This recurring report focuses on active follow-ups, ownership, and unfinished work in this project.";
    case "risk_watch":
      return "This recurring report highlights potentially risky themes and open follow-ups for this project.";
    default:
      return "This recurring report combines recent insights with the current task snapshot for this project.";
  }
}

function getProjectReportSubject(projectName: string, reportType: ProjectReportType) {
  switch (reportType) {
    case "new_insights":
      return `${projectName} new insights report`;
    case "open_tasks":
      return `${projectName} open tasks report`;
    case "risk_watch":
      return `${projectName} risk watch report`;
    default:
      return `${projectName} weekly digest`;
  }
}

function getZonedDateParts(date: Date, timeZone: string) {
  const safeTimeZone = sanitizeTimeZone(timeZone);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find((part) => part.type === type)?.value || "";

  return {
    weekday: shortWeekdayMap[getPart("weekday")] ?? 0,
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: Number(getPart("hour") || "0"),
  };
}

function isSameZonedHour(a: Date, b: Date, timeZone: string) {
  const aParts = getZonedDateParts(a, timeZone);
  const bParts = getZonedDateParts(b, timeZone);
  return (
    aParts.year === bParts.year &&
    aParts.month === bParts.month &&
    aParts.day === bParts.day &&
    aParts.hour === bParts.hour
  );
}

function computeNextWeeklyRun(settings: ProjectDigestSettingsRecord, now = new Date()) {
  const probe = new Date(now);
  for (let offset = 0; offset < 8 * 24; offset += 1) {
    if (offset > 0) {
      probe.setUTCHours(probe.getUTCHours() + 1, 0, 0, 0);
    } else {
      probe.setUTCMinutes(0, 0, 0);
    }
    const parts = getZonedDateParts(probe, settings.timezone);
    if (parts.weekday === settings.weekday && parts.hour === settings.hourLocal) {
      return new Date(probe);
    }
  }
  return null;
}

function computeNextMonthlyRun(settings: ProjectDigestSettingsRecord, now = new Date()) {
  const probe = new Date(now);
  for (let offset = 0; offset < 35 * 24; offset += 1) {
    if (offset > 0) {
      probe.setUTCHours(probe.getUTCHours() + 1, 0, 0, 0);
    } else {
      probe.setUTCMinutes(0, 0, 0);
    }
    const parts = getZonedDateParts(probe, settings.timezone);
    if (Number(parts.day) === settings.dayOfMonth && parts.hour === settings.hourLocal) {
      return new Date(probe);
    }
  }
  return null;
}

function computeNextRun(settings: ProjectDigestSettingsRecord, now = new Date()) {
  if (settings.cadence === "monthly") {
    return computeNextMonthlyRun(settings, now);
  }
  return computeNextWeeklyRun(settings, now);
}

function getScheduleLabel(settings: ProjectDigestSettingsRecord) {
  if (settings.cadence === "monthly") {
    return `Day ${settings.dayOfMonth} of each month at ${formatHourLabel(settings.hourLocal)} (${settings.timezone})`;
  }
  return `${weekdayNames[settings.weekday]} at ${formatHourLabel(settings.hourLocal)} (${settings.timezone})`;
}

function serializeProjectDigestSettings(settings: ProjectDigestSettingsRecord) {
  return {
    id: settings.id,
    projectId: settings.projectId,
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
    lastSentAt: settings.lastSentAt?.toISOString() || null,
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString(),
    scheduleLabel: getScheduleLabel(settings),
    nextRunAt: settings.enabled ? computeNextRun(settings)?.toISOString() || null : null,
  };
}

export async function ensureProjectDigestSettings(projectId: string) {
  return (await projectDigestDelegate.upsert({
    where: { projectId },
    update: {},
    create: { projectId },
  })) as ProjectDigestSettingsRecord;
}

export async function getProjectDigestSettings(projectId: string) {
  const settings = await ensureProjectDigestSettings(projectId);
  return serializeProjectDigestSettings(settings);
}

export async function updateProjectDigestSettings(
  projectId: string,
  input: ProjectDigestSettingsInput,
) {
  const settings = (await projectDigestDelegate.upsert({
    where: { projectId },
    update: {
      enabled: input.enabled,
      cadence: input.cadence,
      reportType: input.reportType,
      weekday: input.weekday,
      dayOfMonth: input.dayOfMonth,
      hourLocal: input.hourLocal,
      timezone: sanitizeTimeZone(input.timezone),
      recipientScope: input.recipientScope,
      sendEmail: input.sendEmail,
      sendSlack: input.sendSlack,
      slackDestinationId: input.slackDestinationId || null,
    },
    create: {
      projectId,
      enabled: input.enabled,
      cadence: input.cadence,
      reportType: input.reportType,
      weekday: input.weekday,
      dayOfMonth: input.dayOfMonth,
      hourLocal: input.hourLocal,
      timezone: sanitizeTimeZone(input.timezone),
      recipientScope: input.recipientScope,
      sendEmail: input.sendEmail,
      sendSlack: input.sendSlack,
      slackDestinationId: input.slackDestinationId || null,
    },
  })) as ProjectDigestSettingsRecord;

  return serializeProjectDigestSettings(settings);
}

async function buildProjectDigestPayload(projectId: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [project, recentInsights, openTasks, recentTasks, transcriptCount] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        workspaceId: true,
      },
    }),
    prisma.projectInsight.findMany({
      where: {
        projectId,
        archivedAt: null,
        createdAt: {
          gte: since,
        },
      } as any,
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: 6,
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
    }),
    prisma.actionTask.count({
      where: {
        transcription: {
          projectId,
        },
        status: {
          in: ["open", "in_progress"],
        },
      } as any,
    }),
    prisma.actionTask.findMany({
      where: {
        transcription: {
          projectId,
        },
        status: {
          in: ["open", "in_progress"],
        },
      } as any,
      orderBy: [{ updatedAt: "desc" }],
      take: 6,
      select: {
        id: true,
        title: true,
        status: true,
        assignee: true,
        transcription: {
          select: {
            fileName: true,
          },
        },
      },
    }),
    prisma.transcription.count({
      where: {
        projectId,
        status: "done",
      } as any,
    }),
  ]);

  if (!project?.workspaceId) {
    const error = new Error("Project not found") as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  return {
    project,
    recentInsights,
    openTasks,
    recentTasks,
    transcriptCount,
  };
}

function renderProjectDigestHtml(input: {
  projectName: string;
  scheduleLabel: string;
  reportType: ProjectReportType;
  transcriptCount: number;
  openTasks: number;
  recentInsights: Array<{ title: string; createdAt: Date }>;
  recentTasks: Array<{
    title: string;
    status: string;
    assignee: string | null;
    transcription: { fileName: string } | null;
  }>;
}) {
  const insightMarkup = input.recentInsights.length
    ? input.recentInsights
        .map(
          (insight) => `
            <li style="margin-bottom: 8px;">
              <strong>${insight.title}</strong>
              <span style="color: #64748b;"> · ${insight.createdAt.toLocaleDateString()}</span>
            </li>`,
        )
        .join("")
    : `<li style="color: #64748b;">No new project insights this week.</li>`;

  const taskMarkup = input.recentTasks.length
    ? input.recentTasks
        .map(
          (task) => `
            <li style="margin-bottom: 8px;">
              <strong>${task.title}</strong>
              <span style="color: #64748b;"> · ${task.status.replace("_", " ")}</span>
              ${task.assignee ? `<span style="color: #64748b;"> · ${task.assignee}</span>` : ""}
              ${task.transcription?.fileName ? `<span style="color: #64748b;"> · ${task.transcription.fileName}</span>` : ""}
            </li>`,
        )
        .join("")
    : `<li style="color: #64748b;">No active project tasks right now.</li>`;

  return `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <h2 style="margin-bottom: 12px;">${input.projectName} ${getProjectReportLabel(input.reportType).toLowerCase()}</h2>
      <p style="margin-top: 0; color: #475569;">${getProjectReportIntro(input.reportType)} This report runs on ${input.scheduleLabel}.</p>
      <div style="display: grid; gap: 16px; margin: 20px 0;">
        <div style="padding: 16px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0;">
          <p style="margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b;">Processed transcripts</p>
          <p style="margin: 8px 0 0; font-size: 28px; font-weight: 700;">${input.transcriptCount}</p>
        </div>
        <div style="padding: 16px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0;">
          <p style="margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b;">Open tasks</p>
          <p style="margin: 8px 0 0; font-size: 28px; font-weight: 700;">${input.openTasks}</p>
        </div>
      </div>
      ${
        input.reportType !== "open_tasks"
          ? `<h3 style="margin: 24px 0 10px;">Recent project insights</h3>
      <ul style="padding-left: 20px;">${insightMarkup}</ul>`
          : ""
      }
      ${
        input.reportType !== "new_insights"
          ? `<h3 style="margin: 24px 0 10px;">${input.reportType === "risk_watch" ? "Follow-up watchlist" : "Active task snapshot"}</h3>
      <ul style="padding-left: 20px;">${taskMarkup}</ul>`
          : ""
      }
    </div>
  `;
}

function renderProjectDigestText(input: {
  projectName: string;
  scheduleLabel: string;
  reportType: ProjectReportType;
  transcriptCount: number;
  openTasks: number;
  recentInsights: Array<{ title: string }>;
  recentTasks: Array<{
    title: string;
    status: string;
    assignee: string | null;
    transcription: { fileName: string } | null;
  }>;
}) {
  const insightLines = input.recentInsights.length
    ? input.recentInsights.map((insight) => `- ${insight.title}`).join("\n")
    : "- No new project insights this week.";
  const taskLines = input.recentTasks.length
    ? input.recentTasks
        .map(
          (task) =>
            `- ${task.title} [${task.status}]${task.assignee ? ` · ${task.assignee}` : ""}${task.transcription?.fileName ? ` · ${task.transcription.fileName}` : ""}`,
        )
        .join("\n")
    : "- No active project tasks right now.";

  return `${input.projectName} ${getProjectReportLabel(input.reportType).toLowerCase()}

${getProjectReportIntro(input.reportType)}
Schedule: ${input.scheduleLabel}
Processed transcripts: ${input.transcriptCount}
Open tasks: ${input.openTasks}

${input.reportType !== "open_tasks" ? `Recent project insights
${insightLines}
` : ""}${input.reportType !== "new_insights" ? `${input.reportType === "risk_watch" ? "Follow-up watchlist" : "Active task snapshot"}
${taskLines}` : ""}`;
}

export async function sendProjectDigest(input: {
  projectId: string;
  actorUserId?: string | null;
  trigger: "manual" | "scheduled";
}) {
  const settings = await ensureProjectDigestSettings(input.projectId);
  const payload = await buildProjectDigestPayload(input.projectId);
  const workspaceId = payload.project.workspaceId as string;
  if (!settings.sendEmail && !settings.sendSlack) {
    const error = new Error("Enable email or Slack delivery before sending this report.") as Error & {
      statusCode?: number;
    };
    error.statusCode = 400;
    throw error;
  }

  const uniqueRecipients = settings.sendEmail
    ? Array.from(
        new Map(
          (
            await workspaceMemberDelegate.findMany({
              where: {
                workspaceId,
                status: "active",
                ...(settings.recipientScope === "managers"
                  ? { role: { in: ["owner", "admin"] } }
                  : {}),
                user: {
                  email: {
                    not: null,
                  },
                },
              } as any,
              select: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                    notificationPreferences: {
                      select: {
                        digestEmailEnabled: true,
                      },
                    },
                  },
                },
              },
            })
          )
            .filter((member) => member.user.email?.trim())
            .filter((member) => member.user.notificationPreferences?.digestEmailEnabled !== false)
            .map((member) => [member.user.email.trim().toLowerCase(), member.user]),
        ).values(),
      )
    : [];

  if (settings.sendEmail && !uniqueRecipients.length) {
    const error = new Error("No eligible project digest recipients were found") as Error & {
      statusCode?: number;
    };
    error.statusCode = 400;
    throw error;
  }

  const scheduleLabel = getScheduleLabel(settings);
  const reportType = (settings.reportType || "summary") as ProjectReportType;
  const subject = getProjectReportSubject(payload.project.name, reportType);
  const html = renderProjectDigestHtml({
    projectName: payload.project.name,
    scheduleLabel,
    reportType,
    transcriptCount: payload.transcriptCount,
    openTasks: payload.openTasks,
    recentInsights: payload.recentInsights,
    recentTasks: payload.recentTasks,
  });
  const text = renderProjectDigestText({
    projectName: payload.project.name,
    scheduleLabel,
    reportType,
    transcriptCount: payload.transcriptCount,
    openTasks: payload.openTasks,
    recentInsights: payload.recentInsights,
    recentTasks: payload.recentTasks,
  });

  if (settings.sendEmail) {
    await Promise.all(
      uniqueRecipients.map((recipient) =>
        sendEmail({
          to: recipient.email,
          subject,
          html,
          text,
        }),
      ),
    );
  }

  const slackResult = settings.sendSlack
    ? await sendProjectDigestToSlack({
    workspaceId,
    destinationId: settings.slackDestinationId,
    projectName: payload.project.name,
    scheduleLabel,
    transcriptCount: payload.transcriptCount,
    openTasks: payload.openTasks,
    insightTitles: payload.recentInsights.map((insight) => insight.title),
    trigger: input.trigger,
  })
    : { delivered: false as const };

  if (uniqueRecipients.length) {
    await createWorkspaceNotifications({
      workspaceId,
      recipients: uniqueRecipients.map((recipient) => recipient.id),
      type: "project_digest",
      title: "Project digest delivered",
      body: `${payload.project.name} ${getProjectReportLabel(reportType).toLowerCase()} is ready.`,
      link: "/dashboard",
      metadata: {
        projectId: payload.project.id,
        trigger: input.trigger,
        recipientScope: settings.recipientScope,
        reportType,
        sendEmail: settings.sendEmail,
        sendSlack: settings.sendSlack,
      },
    });
  }

  await projectDigestDelegate.update({
    where: { projectId: input.projectId },
    data: { lastSentAt: new Date() },
  });

  await createWorkspaceAuditLog({
    workspaceId,
    actorUserId: input.actorUserId || null,
    action: input.trigger === "manual" ? "project.digest.sent_manual" : "project.digest.sent_scheduled",
    targetType: "project_digest",
    targetId: settings.id,
    summary:
      input.trigger === "manual"
        ? `A project digest was sent manually for ${payload.project.name}.`
        : `A scheduled project digest was sent for ${payload.project.name}.`,
    metadata: {
      projectId: payload.project.id,
      projectName: payload.project.name,
      recipientCount: uniqueRecipients.length,
      recipientScope: settings.recipientScope,
      reportType,
      sendEmail: settings.sendEmail,
      sendSlack: settings.sendSlack,
      insightCount: payload.recentInsights.length,
      openTasks: payload.openTasks,
      transcriptCount: payload.transcriptCount,
    },
  });

  await createRecurringReportRun({
    workspaceId,
    projectId: payload.project.id,
    scope: "project",
    trigger: input.trigger,
    cadence: settings.cadence,
    reportType,
    recipientScope: settings.recipientScope,
    sendEmail: settings.sendEmail,
    sendSlack: settings.sendSlack,
    slackDestinationId: settings.slackDestinationId,
    emailRecipientCount: uniqueRecipients.length,
    slackDelivered: slackResult.delivered,
    summary: `${payload.project.name} ${getProjectReportLabel(reportType).toLowerCase()} delivered.`,
    metadata: {
      insightCount: payload.recentInsights.length,
      openTasks: payload.openTasks,
      transcriptCount: payload.transcriptCount,
    },
  });

  return {
    recipientCount: uniqueRecipients.length,
    emailRecipientCount: uniqueRecipients.length,
    slackDelivered: slackResult.delivered,
    reportType,
    insightCount: payload.recentInsights.length,
    openTasks: payload.openTasks,
    transcriptCount: payload.transcriptCount,
  };
}

function isDigestDue(settings: ProjectDigestSettingsRecord, now = new Date()) {
  if (!settings.enabled) {
    return false;
  }
  const parts = getZonedDateParts(now, settings.timezone);
  if (settings.cadence === "monthly") {
    if (Number(parts.day) !== settings.dayOfMonth || parts.hour !== settings.hourLocal) {
      return false;
    }
  } else {
    if (parts.weekday !== settings.weekday || parts.hour !== settings.hourLocal) {
      return false;
    }
  }
  if (settings.lastSentAt && isSameZonedHour(settings.lastSentAt, now, settings.timezone)) {
    return false;
  }
  return true;
}

export async function sendDueProjectDigests(now = new Date()) {
  const settingsList = (await projectDigestDelegate.findMany({
    where: {
      enabled: true,
    },
  })) as ProjectDigestSettingsRecord[];

  let sent = 0;
  const failures: Array<{ projectId: string; message: string }> = [];
  for (const settings of settingsList) {
    if (!isDigestDue(settings, now)) {
      continue;
    }
    try {
      await sendProjectDigest({
        projectId: settings.projectId,
        trigger: "scheduled",
      });
      sent += 1;
    } catch (error) {
      const project = await prisma.project.findUnique({
        where: { id: settings.projectId },
        select: { workspaceId: true },
      } as any);
      if (project?.workspaceId) {
        await createRecurringReportRun({
          workspaceId: project.workspaceId,
          projectId: settings.projectId,
          scope: "project",
          trigger: "scheduled",
          cadence: settings.cadence,
          reportType: (settings.reportType || "summary") as ProjectReportType,
          recipientScope: settings.recipientScope,
          sendEmail: settings.sendEmail,
          sendSlack: settings.sendSlack,
          slackDestinationId: settings.slackDestinationId,
          emailRecipientCount: 0,
          slackDelivered: false,
          status: "failed",
          summary: "Scheduled project report failed.",
          metadata: {
            error: error instanceof Error ? error.message : "Unknown error",
          },
        });
      }
      failures.push({
        projectId: settings.projectId,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    scanned: settingsList.length,
    sent,
    failures,
  };
}
