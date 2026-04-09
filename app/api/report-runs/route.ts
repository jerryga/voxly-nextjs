import { NextResponse } from "next/server";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { listRecurringReportRunsWithFilters } from "@/lib/report-runs";
import { requireWorkspaceContext } from "@/lib/workspaces";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "all";
    const status = searchParams.get("status") || "all";
    const limit = Number(searchParams.get("limit") || "25");

    const runs = await listRecurringReportRunsWithFilters(context.activeWorkspace.id, {
      scope:
        scope === "workspace" || scope === "project" || scope === "all"
          ? scope
          : "all",
      status:
        status === "success" || status === "failed" || status === "all"
          ? status
          : "all",
      limit: Number.isFinite(limit) ? Math.max(1, Math.min(limit, 200)) : 25,
    });
    return NextResponse.json({ ok: true, runs });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
