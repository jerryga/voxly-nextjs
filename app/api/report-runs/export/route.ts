import { NextResponse } from "next/server";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { listRecurringReportRunsWithFilters } from "@/lib/report-runs";
import { requireWorkspaceContext } from "@/lib/workspaces";

export const runtime = "nodejs";

function escapeCsv(value: string | number | boolean | null | undefined) {
  const stringValue = value == null ? "" : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

function formatRunsCsv(runs: Awaited<ReturnType<typeof listRecurringReportRunsWithFilters>>) {
  const header = [
    "createdAt",
    "scope",
    "project",
    "status",
    "trigger",
    "cadence",
    "reportType",
    "recipientScope",
    "sendEmail",
    "emailRecipientCount",
    "sendSlack",
    "slackDelivered",
    "summary",
    "error",
  ];

  const rows = runs.map((run) =>
    [
      run.createdAt,
      run.scope,
      run.project?.name || "",
      run.status,
      run.trigger,
      run.cadence,
      run.reportType,
      run.recipientScope,
      run.sendEmail,
      run.emailRecipientCount,
      run.sendSlack,
      run.slackDelivered,
      run.summary,
      typeof run.metadata === "object" && run.metadata && "error" in run.metadata
        ? String((run.metadata as { error?: string }).error || "")
        : "",
    ]
      .map(escapeCsv)
      .join(","),
  );

  return [header.join(","), ...rows].join("\n");
}

function formatRunsMarkdown(
  workspaceName: string,
  runs: Awaited<ReturnType<typeof listRecurringReportRunsWithFilters>>,
) {
  const lines = [`# ${workspaceName} report history`, ""];

  if (!runs.length) {
    lines.push("No report runs found.");
    return lines.join("\n");
  }

  for (const run of runs) {
    lines.push(`## ${run.summary}`);
    lines.push(`- Time: ${new Date(run.createdAt).toLocaleString()}`);
    lines.push(`- Scope: ${run.scope}${run.project?.name ? ` (${run.project.name})` : ""}`);
    lines.push(`- Status: ${run.status}`);
    lines.push(`- Trigger: ${run.trigger}`);
    lines.push(`- Cadence: ${run.cadence}`);
    lines.push(`- Report type: ${run.reportType}`);
    lines.push(`- Recipient scope: ${run.recipientScope}`);
    lines.push(
      `- Delivery: ${
        [
          run.sendEmail ? `Email (${run.emailRecipientCount})` : null,
          run.sendSlack ? `Slack${run.slackDelivered ? " delivered" : ""}` : null,
        ]
          .filter(Boolean)
          .join(" + ") || "None"
      }`,
    );
    if (run.metadata && typeof run.metadata === "object" && "error" in run.metadata) {
      lines.push(`- Error: ${String((run.metadata as { error?: string }).error || "")}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export async function GET(request: Request) {
  try {
    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "all";
    const status = searchParams.get("status") || "all";
    const format = searchParams.get("format") || "csv";

    const runs = await listRecurringReportRunsWithFilters(context.activeWorkspace.id, {
      scope:
        scope === "workspace" || scope === "project" || scope === "all"
          ? scope
          : "all",
      status:
        status === "success" || status === "failed" || status === "all"
          ? status
          : "all",
      limit: 200,
    });

    if (format === "md") {
      const body = formatRunsMarkdown(context.activeWorkspace.name, runs);
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": 'attachment; filename="report-history.md"',
        },
      });
    }

    const body = formatRunsCsv(runs);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="report-history.csv"',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
