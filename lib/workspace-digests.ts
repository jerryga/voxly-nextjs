/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { createWorkspaceNotifications } from "@/lib/notifications";
import { createWorkspaceAuditLog } from "@/lib/workspace-audit";
import { sendWorkspaceDigestToSlack } from "@/lib/slack";
import { createRecurringReportRun } from "@/lib/report-runs";

type WorkspaceDigestSettingsRecord = {
  id: string;
  workspaceId: string;
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

type WorkspaceDigestSettingsInput = {
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

type WorkspaceReportType = WorkspaceDigestSettingsInput["reportType"];

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

const workspaceDigestDelegate = (prisma as typeof prisma & {
  workspaceDigestSettings: {
    findUnique: (...args: any[]) => Promise<any>;
    findMany: (...args: any[]) => Promise<any[]>;
    upsert: (...args: any[]) => Promise<any>;
    update: (...args: any[]) => Promise<any>;
  };
}).workspaceDigestSettings;

const workspaceMemberDelegate = (prisma as typeof prisma & {
  workspaceMember: {
    findMany: (...args: any[]) => Promise<any[]>;
  };
}).workspaceMember;

function formatHourLabel(hourLocal: number) {
  const suffix = hourLocal >= 12 ? "PM" : "AM";
  const displayHour = hourLocal % 12 === 0 ? 12 : hourLocal % 12;
  return `${displayHour}:00 ${suffix}`;
}

function getWorkspaceReportLabel(reportType: WorkspaceReportType) {
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

function getWorkspaceReportIntro(reportType: WorkspaceReportType) {
  switch (reportType) {
    case "new_insights":
      return "This recurring report highlights the newest insights captured across the workspace.";
    case "open_tasks":
      return "This recurring report focuses on open work, active follow-ups, and what still needs attention.";
    case "risk_watch":
      return "This recurring report highlights potentially risky themes, unresolved questions, and active follow-ups.";
    default:
      return "This recurring report blends new insights with the current open-task picture.";
  }
}

function getWorkspaceReportSubject(workspaceName: string, reportType: WorkspaceReportType) {
  switch (reportType) {
    case "new_insights":
      return `${workspaceName} new insights report`;
    case "open_tasks":
      return `${workspaceName} open tasks report`;
    case "risk_watch":
      return `${workspaceName} risk watch report`;
    default:
      return `${workspaceName} weekly digest`;
  }
}

function getAppOrigin() {
  return (process.env.NEXTAUTH_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
}

function sanitizeTimeZone(timeZone: string) {
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "UTC";
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
  const weekdayName = getPart("weekday");

  return {
    weekday: shortWeekdayMap[weekdayName] ?? 0,
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

function computeNextWeeklyRun(settings: WorkspaceDigestSettingsRecord, now = new Date()) {
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

function computeNextMonthlyRun(settings: WorkspaceDigestSettingsRecord, now = new Date()) {
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

function computeNextRun(settings: WorkspaceDigestSettingsRecord, now = new Date()) {
  if (settings.cadence === "monthly") {
    return computeNextMonthlyRun(settings, now);
  }

  return computeNextWeeklyRun(settings, now);
}

function getScheduleLabel(settings: WorkspaceDigestSettingsRecord) {
  if (settings.cadence === "monthly") {
    return `Day ${settings.dayOfMonth} of each month at ${formatHourLabel(settings.hourLocal)} (${settings.timezone})`;
  }

  return `${weekdayNames[settings.weekday]} at ${formatHourLabel(settings.hourLocal)} (${settings.timezone})`;
}

function serializeDigestSettings(settings: WorkspaceDigestSettingsRecord) {
  return {
    id: settings.id,
    workspaceId: settings.workspaceId,
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

export async function ensureWorkspaceDigestSettings(workspaceId: string) {
  return (await workspaceDigestDelegate.upsert({
    where: { workspaceId },
    update: {},
    create: {
      workspaceId,
    },
  })) as WorkspaceDigestSettingsRecord;
}

export async function getWorkspaceDigestSettings(workspaceId: string) {
  const settings = await ensureWorkspaceDigestSettings(workspaceId);
  return serializeDigestSettings(settings);
}

export async function updateWorkspaceDigestSettings(
  workspaceId: string,
  input: WorkspaceDigestSettingsInput,
) {
  const settings = (await workspaceDigestDelegate.upsert({
    where: { workspaceId },
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
      workspaceId,
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
  })) as WorkspaceDigestSettingsRecord;

  return serializeDigestSettings(settings);
}

async function buildWorkspaceDigestPayload(workspaceId: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [workspace, recentWorkspaceInsights, recentProjectInsights, openTasks, recentTasks] =
    await Promise.all([
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          id: true,
          name: true,
        },
      }),
      prisma.workspaceInsight.findMany({
        where: {
          workspaceId,
          archivedAt: null,
          createdAt: {
            gte: since,
          },
        } as any,
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 5,
        select: {
          id: true,
          title: true,
          createdAt: true,
        },
      }),
      prisma.projectInsight.findMany({
        where: {
          workspaceId,
          archivedAt: null,
          createdAt: {
            gte: since,
          },
        } as any,
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 5,
        select: {
          id: true,
          title: true,
          createdAt: true,
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.actionTask.count({
        where: {
          workspaceId,
          status: {
            in: ["open", "in_progress"],
          },
        } as any,
      }),
      prisma.actionTask.findMany({
        where: {
          workspaceId,
          status: {
            in: ["open", "in_progress"],
          },
        } as any,
        orderBy: [{ updatedAt: "desc" }],
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          assignee: true,
          dueDate: true,
          transcription: {
            select: {
              id: true,
              fileName: true,
            },
          },
        },
      }),
    ]);

  if (!workspace) {
    const error = new Error("Workspace not found") as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  return {
    workspace,
    recentWorkspaceInsights,
    recentProjectInsights,
    openTasks,
    recentTasks,
  };
}

function renderDigestHtml(input: {
  workspaceName: string;
  scheduleLabel: string;
  reportType: WorkspaceReportType;
  workspaceInsights: Array<{ title: string; createdAt: Date }>;
  projectInsights: Array<{ title: string; createdAt: Date; project: { name: string } }>;
  openTasks: number;
  recentTasks: Array<{
    title: string;
    status: string;
    assignee: string | null;
    dueDate: Date | null;
    transcription: { fileName: string } | null;
  }>;
}) {
  const workspaceInsightMarkup = input.workspaceInsights.length
    ? input.workspaceInsights
        .map(
          (insight) => `
            <li style="margin-bottom: 8px;">
              <strong>${insight.title}</strong>
              <span style="color: #64748b;"> · ${insight.createdAt.toLocaleDateString()}</span>
            </li>`,
        )
        .join("")
    : `<li style="color: #64748b;">No new workspace insights this week.</li>`;

  const projectInsightMarkup = input.projectInsights.length
    ? input.projectInsights
        .map(
          (insight) => `
            <li style="margin-bottom: 8px;">
              <strong>${insight.title}</strong>
              <span style="color: #64748b;"> · ${insight.project.name}</span>
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
              ${
                task.assignee
                  ? `<span style="color: #64748b;"> · ${task.assignee}</span>`
                  : ""
              }
              ${
                task.transcription?.fileName
                  ? `<span style="color: #64748b;"> · ${task.transcription.fileName}</span>`
                  : ""
              }
            </li>`,
        )
        .join("")
    : `<li style="color: #64748b;">No active tasks right now.</li>`;

  return `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <h2 style="margin-bottom: 12px;">${input.workspaceName} ${getWorkspaceReportLabel(input.reportType).toLowerCase()}</h2>
      <p style="margin-top: 0; color: #475569;">
        ${getWorkspaceReportIntro(input.reportType)} This report runs on ${input.scheduleLabel}.
      </p>
      <div style="display: grid; gap: 16px; margin: 20px 0;">
        <div style="padding: 16px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0;">
          <p style="margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b;">Open tasks</p>
          <p style="margin: 8px 0 0; font-size: 28px; font-weight: 700;">${input.openTasks}</p>
        </div>
      </div>
      ${
        input.reportType !== "open_tasks"
          ? `<h3 style="margin: 24px 0 10px;">Recent workspace insights</h3>
      <ul style="padding-left: 20px;">${workspaceInsightMarkup}</ul>
      <h3 style="margin: 24px 0 10px;">Recent project insights</h3>
      <ul style="padding-left: 20px;">${projectInsightMarkup}</ul>`
          : ""
      }
      ${
        input.reportType !== "new_insights"
          ? `<h3 style="margin: 24px 0 10px;">${input.reportType === "risk_watch" ? "Follow-up watchlist" : "Active task snapshot"}</h3>
      <ul style="padding-left: 20px;">${taskMarkup}</ul>`
          : ""
      }
      <p style="margin: 24px 0 0;">
        <a href="${getAppOrigin()}/dashboard" style="display: inline-block; padding: 12px 18px; border-radius: 999px; background: #0f172a; color: white; text-decoration: none; font-weight: 700;">Open workspace</a>
      </p>
    </div>
  `;
}

function renderDigestText(input: {
  workspaceName: string;
  scheduleLabel: string;
  reportType: WorkspaceReportType;
  workspaceInsights: Array<{ title: string }>;
  projectInsights: Array<{ title: string; project: { name: string } }>;
  openTasks: number;
  recentTasks: Array<{
    title: string;
    status: string;
    assignee: string | null;
    transcription: { fileName: string } | null;
  }>;
}) {
  const workspaceInsightLines = input.workspaceInsights.length
    ? input.workspaceInsights.map((insight) => `- ${insight.title}`).join("\n")
    : "- No new workspace insights this week.";
  const projectInsightLines = input.projectInsights.length
    ? input.projectInsights
        .map((insight) => `- ${insight.title} (${insight.project.name})`)
        .join("\n")
    : "- No new project insights this week.";
  const taskLines = input.recentTasks.length
    ? input.recentTasks
        .map(
          (task) =>
            `- ${task.title} [${task.status}]${task.assignee ? ` · ${task.assignee}` : ""}${task.transcription?.fileName ? ` · ${task.transcription.fileName}` : ""}`,
        )
        .join("\n")
    : "- No active tasks right now.";

  return `${input.workspaceName} ${getWorkspaceReportLabel(input.reportType).toLowerCase()}

${getWorkspaceReportIntro(input.reportType)}
Schedule: ${input.scheduleLabel}
Open tasks: ${input.openTasks}

${input.reportType !== "open_tasks" ? `Recent workspace insights
${workspaceInsightLines}

Recent project insights
${projectInsightLines}
` : ""}${input.reportType !== "new_insights" ? `${input.reportType === "risk_watch" ? "Follow-up watchlist" : "Active task snapshot"}
${taskLines}
` : ""}

Open workspace: ${getAppOrigin()}/dashboard`;
}

export async function sendWorkspaceDigest(input: {
  workspaceId: string;
  actorUserId?: string | null;
  trigger: "manual" | "scheduled";
}) {
  const settings = await ensureWorkspaceDigestSettings(input.workspaceId);
  const payload = await buildWorkspaceDigestPayload(input.workspaceId);
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
                workspaceId: input.workspaceId,
                status: "active",
                ...(settings.recipientScope === "managers"
                  ? { role: { in: ["owner", "admin"] } }
                  : {}),
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
    const error = new Error("No eligible digest recipients were found") as Error & {
      statusCode?: number;
    };
    error.statusCode = 400;
    throw error;
  }

  const scheduleLabel = getScheduleLabel(settings);
  const reportType = (settings.reportType || "summary") as WorkspaceReportType;
  const subject = getWorkspaceReportSubject(payload.workspace.name, reportType);
  const html = renderDigestHtml({
    workspaceName: payload.workspace.name,
    scheduleLabel,
    reportType,
    workspaceInsights: payload.recentWorkspaceInsights,
    projectInsights: payload.recentProjectInsights,
    openTasks: payload.openTasks,
    recentTasks: payload.recentTasks,
  });
  const text = renderDigestText({
    workspaceName: payload.workspace.name,
    scheduleLabel,
    reportType,
    workspaceInsights: payload.recentWorkspaceInsights,
    projectInsights: payload.recentProjectInsights,
    openTasks: payload.openTasks,
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
    ? await sendWorkspaceDigestToSlack({
    workspaceId: input.workspaceId,
    destinationId: settings.slackDestinationId,
    workspaceName: payload.workspace.name,
    scheduleLabel,
    openTasks: payload.openTasks,
    workspaceInsightTitles: payload.recentWorkspaceInsights.map((insight) => insight.title),
    projectInsightTitles: payload.recentProjectInsights.map(
      (insight) => `${insight.title} (${insight.project.name})`,
    ),
    trigger: input.trigger,
  })
    : { delivered: false as const };

  if (uniqueRecipients.length) {
    await createWorkspaceNotifications({
      workspaceId: input.workspaceId,
      recipients: uniqueRecipients.map((recipient) => recipient.id),
      type: "workspace_digest",
      title: "Workspace digest delivered",
      body: `${payload.workspace.name} ${getWorkspaceReportLabel(reportType).toLowerCase()} is ready.`,
      link: "/dashboard",
      metadata: {
        trigger: input.trigger,
        recipientScope: settings.recipientScope,
        reportType,
        sendEmail: settings.sendEmail,
        sendSlack: settings.sendSlack,
      },
    });
  }

  await workspaceDigestDelegate.update({
    where: {
      workspaceId: input.workspaceId,
    },
    data: {
      lastSentAt: new Date(),
    },
  });

  await createWorkspaceAuditLog({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId || null,
    action: input.trigger === "manual" ? "workspace.digest.sent_manual" : "workspace.digest.sent_scheduled",
    targetType: "workspace_digest",
    targetId: settings.id,
    summary:
      input.trigger === "manual"
        ? "A workspace digest was sent manually."
        : "A scheduled workspace digest was sent.",
    metadata: {
      recipientCount: uniqueRecipients.length,
      recipientScope: settings.recipientScope,
      reportType,
      sendEmail: settings.sendEmail,
      sendSlack: settings.sendSlack,
      workspaceInsightCount: payload.recentWorkspaceInsights.length,
      projectInsightCount: payload.recentProjectInsights.length,
      openTasks: payload.openTasks,
    },
  });

  await createRecurringReportRun({
    workspaceId: input.workspaceId,
    scope: "workspace",
    trigger: input.trigger,
    cadence: settings.cadence,
    reportType,
    recipientScope: settings.recipientScope,
    sendEmail: settings.sendEmail,
    sendSlack: settings.sendSlack,
    slackDestinationId: settings.slackDestinationId,
    emailRecipientCount: uniqueRecipients.length,
    slackDelivered: slackResult.delivered,
    summary: `${payload.workspace.name} ${getWorkspaceReportLabel(reportType).toLowerCase()} delivered.`,
    metadata: {
      workspaceInsightCount: payload.recentWorkspaceInsights.length,
      projectInsightCount: payload.recentProjectInsights.length,
      openTasks: payload.openTasks,
    },
  });

  return {
    recipientCount: uniqueRecipients.length,
    emailRecipientCount: uniqueRecipients.length,
    slackDelivered: slackResult.delivered,
    reportType,
    openTasks: payload.openTasks,
    workspaceInsightCount: payload.recentWorkspaceInsights.length,
    projectInsightCount: payload.recentProjectInsights.length,
  };
}

function isDigestDue(settings: WorkspaceDigestSettingsRecord, now = new Date()) {
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

export async function sendDueWorkspaceDigests(now = new Date()) {
  const settingsList = (await workspaceDigestDelegate.findMany({
    where: {
      enabled: true,
    },
  })) as WorkspaceDigestSettingsRecord[];

  let sent = 0;
  const failures: Array<{ workspaceId: string; message: string }> = [];

  for (const settings of settingsList) {
    if (!isDigestDue(settings, now)) {
      continue;
    }

    try {
      await sendWorkspaceDigest({
        workspaceId: settings.workspaceId,
        trigger: "scheduled",
      });
      sent += 1;
    } catch (error) {
      await createRecurringReportRun({
        workspaceId: settings.workspaceId,
        scope: "workspace",
        trigger: "scheduled",
        cadence: settings.cadence,
        reportType: (settings.reportType || "summary") as WorkspaceReportType,
        recipientScope: settings.recipientScope,
        sendEmail: settings.sendEmail,
        sendSlack: settings.sendSlack,
        slackDestinationId: settings.slackDestinationId,
        emailRecipientCount: 0,
        slackDelivered: false,
        status: "failed",
        summary: "Scheduled workspace report failed.",
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
      failures.push({
        workspaceId: settings.workspaceId,
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
