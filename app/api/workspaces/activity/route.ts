import { NextResponse } from "next/server";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { listWorkspaceAuditLogs } from "@/lib/workspace-audit";
import { requireWorkspaceContext } from "@/lib/workspaces";

export const runtime = "nodejs";

export async function GET() {
  try {
    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activity = await listWorkspaceAuditLogs(context.activeWorkspace.id, 20);

    return NextResponse.json({ ok: true, activity });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
