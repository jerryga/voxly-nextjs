import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import {
  listWorkspaceNotifications,
  markWorkspaceNotificationsRead,
} from "@/lib/notifications";
import { requireWorkspaceContext } from "@/lib/workspaces";

export const runtime = "nodejs";

const notificationReadSchema = z.object({
  notificationId: z.string().trim().min(1).max(128).optional(),
});

export async function GET() {
  try {
    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const notifications = await listWorkspaceNotifications({
      workspaceId: context.activeWorkspace.id,
      userId: context.user.id,
      limit: 20,
    });

    return NextResponse.json({ ok: true, notifications });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) {
      return originError;
    }

    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = notificationReadSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    await markWorkspaceNotificationsRead({
      workspaceId: context.activeWorkspace.id,
      userId: context.user.id,
      notificationId: parsed.data.notificationId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
