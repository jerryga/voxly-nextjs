import { NextResponse } from "next/server";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { summarizeRecurringReportRuns } from "@/lib/report-runs";
import { requireWorkspaceContext } from "@/lib/workspaces";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = Number(searchParams.get("days") || "30");
    const summary = await summarizeRecurringReportRuns(context.activeWorkspace.id, {
      days: Number.isFinite(days) ? days : 30,
    });

    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
