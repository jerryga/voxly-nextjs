import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import { normalizeTemplateSelection } from "@/lib/templates";
import {
  transcriptionDeleteSchema,
  transcriptionUpdateSchema,
} from "@/lib/api/validation";

export const runtime = "nodejs";

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase().trim();

    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const status = searchParams.get("status")?.trim();
    const templateParam = searchParams.get("template")?.trim();
    const template = templateParam
      ? normalizeTemplateSelection(templateParam)
      : undefined;
    const projectId = searchParams.get("projectId")?.trim();
    const dateFrom = searchParams.get("dateFrom")?.trim();
    const dateTo = searchParams.get("dateTo")?.trim();
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), 100), 100);

    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (dateFrom) {
      const parsedDate = new Date(dateFrom);
      if (!Number.isNaN(parsedDate.getTime())) {
        createdAtFilter.gte = parsedDate;
      }
    }
    if (dateTo) {
      const parsedDate = new Date(dateTo);
      if (!Number.isNaN(parsedDate.getTime())) {
        createdAtFilter.lte = parsedDate;
      }
    }

    const where: Prisma.TranscriptionWhereInput = {
      userId: user.id,
      ...(status ? { status } : {}),
      ...(template ? { template } : {}),
      ...(projectId ? { projectId } : {}),
      ...(Object.keys(createdAtFilter).length ? { createdAt: createdAtFilter } : {}),
      ...(q
        ? {
            OR: [
              { fileName: { contains: q, mode: "insensitive" } },
              { transcript: { contains: q, mode: "insensitive" } },
              { searchText: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.transcription.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.transcription.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      items,
      total,
      nextCursor: items.length === limit ? items[items.length - 1]?.id || null : null,
    });
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

    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase().trim();

    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = transcriptionUpdateSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const { id, template } = parsed.data;
    const projectId = Object.prototype.hasOwnProperty.call(parsed.data, "projectId")
      ? parsed.data.projectId
      : undefined;

    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: user.id },
        select: { id: true },
      });
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }

    const updated = await prisma.transcription.updateMany({
      where: { id, userId: user.id },
      data: {
        ...(template ? { template } : {}),
        ...(typeof projectId !== "undefined" ? { projectId } : {}),
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

export async function DELETE(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) {
      return originError;
    }

    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase().trim();

    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = transcriptionDeleteSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { id } = parsed.data;

    const deleted = await prisma.transcription.deleteMany({
      where: { id, userId: user.id },
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
