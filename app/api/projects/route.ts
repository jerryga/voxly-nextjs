/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import { projectCreateSchema } from "@/lib/api/validation";
import {
  activeWorkspaceResourceWhere,
  requireWorkspaceContext,
} from "@/lib/workspaces";

export const runtime = "nodejs";

export async function GET() {
  try {
    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = await prisma.project.findMany({
      where: activeWorkspaceResourceWhere(context) as any,
      orderBy: [{ createdAt: "desc" }],
    });

    return NextResponse.json({ ok: true, projects });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}

export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) {
      return originError;
    }

    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = projectCreateSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        userId: context.user.id,
        workspaceId: context.activeWorkspace.id,
        name: parsed.data.name,
        description: parsed.data.description || null,
        color: parsed.data.color || null,
      } as any,
    });

    return NextResponse.json({ ok: true, project });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
