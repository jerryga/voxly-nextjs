import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceSameOrigin } from "@/lib/api/security";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import {
  ACTIVE_WORKSPACE_COOKIE,
  requireWorkspaceContext,
  userHasWorkspaceAccess,
} from "@/lib/workspaces";

export const runtime = "nodejs";

const activeWorkspaceSchema = z.object({
  workspaceId: z.string().trim().min(1).max(128),
});

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

    const parsed = activeWorkspaceSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const hasAccess = await userHasWorkspaceAccess(
      context.user.id,
      parsed.data.workspaceId,
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_WORKSPACE_COOKIE, parsed.data.workspaceId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return NextResponse.json({ ok: true, workspaceId: parsed.data.workspaceId });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
