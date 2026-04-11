/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import { projectUpdateSchema } from "@/lib/api/validation";
import { requireWorkspaceContext } from "@/lib/workspaces";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

    const { id } = await context.params;
    const parsed = projectUpdateSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const updated = await prisma.project.updateMany({
      where: {
        id,
        OR: [
          { workspaceId: workspaceContext.activeWorkspace.id },
          { workspaceId: null, userId: workspaceContext.user.id },
        ],
      } as any,
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(Object.prototype.hasOwnProperty.call(parsed.data, "description")
          ? {
              description:
                parsed.data.description === "" ? null : parsed.data.description,
            }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(parsed.data, "color")
          ? { color: parsed.data.color === "" ? null : parsed.data.color }
          : {}),
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const workspaceContext = await requireWorkspaceContext();
    if (!workspaceContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const deleted = await prisma.project.deleteMany({
      where: {
        id,
        OR: [
          { workspaceId: workspaceContext.activeWorkspace.id },
          { workspaceId: null, userId: workspaceContext.user.id },
        ],
      } as any,
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
