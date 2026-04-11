/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import {
  projectInsightCreateSchema,
} from "@/lib/api/validation";
import { requireWorkspaceContext } from "@/lib/workspaces";

export const runtime = "nodejs";

const projectInsightDelegate = (prisma as typeof prisma & {
  projectInsight: {
    findMany: (...args: any[]) => Promise<any[]>;
    create: (...args: any[]) => Promise<any>;
  };
}).projectInsight;

export async function GET(request: Request) {
  try {
    const context = await requireWorkspaceContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = new URL(request.url).searchParams.get("projectId")?.trim();
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { workspaceId: context.activeWorkspace.id },
          { workspaceId: null, userId: context.user.id },
        ],
      } as any,
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const insights = await projectInsightDelegate.findMany({
      where: {
        projectId,
        workspaceId: context.activeWorkspace.id,
      } as any,
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ ok: true, insights });
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

    const parsed = projectInsightCreateSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { projectId, title, question, answer, confidenceNote, sources } = parsed.data;

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { workspaceId: context.activeWorkspace.id },
          { workspaceId: null, userId: context.user.id },
        ],
      } as any,
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const insight = await projectInsightDelegate.create({
      data: {
        workspaceId: context.activeWorkspace.id,
        projectId,
        createdById: context.user.id,
        title,
        question,
        answer,
        confidenceNote: confidenceNote || null,
        isPinned: false,
        sources,
      } as any,
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ ok: true, insight });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}
