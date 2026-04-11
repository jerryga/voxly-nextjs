/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { requireWorkspaceContext } from "@/lib/workspaces";

export const runtime = "nodejs";

export async function GET() {
  try {
    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: context.activeWorkspace.id, status: "active" } as any,
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true,
        role: true,
        status: true,
        joinedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ ok: true, members });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
