import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { enforceSameOrigin } from "@/lib/api/security";
import {
  actionTaskDeleteSchema,
  actionTaskUpdateSchema,
} from "@/lib/api/validation";

export const runtime = "nodejs";

const actionTaskDelegate = (prisma as typeof prisma & {
  actionTask: {
    updateMany: typeof prisma.$executeRaw;
    findFirst: typeof prisma.$queryRaw;
    deleteMany: typeof prisma.$executeRaw;
  };
}).actionTask;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
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

    const params = await context.params;
    const parsed = actionTaskUpdateSchema.safeParse({
      ...(await request.json().catch(() => ({}))),
      id: params.id,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { id, title, status, priority, assignee, dueDate } = parsed.data;
    const updated = await actionTaskDelegate.updateMany({
      where: { id, userId: user.id },
      data: {
        ...(title ? { title } : {}),
        ...(status ? { status, completedAt: status === "done" ? new Date() : null } : {}),
        ...(priority ? { priority } : {}),
        ...(typeof assignee !== "undefined" ? { assignee: assignee || null } : {}),
        ...(typeof dueDate !== "undefined"
          ? { dueDate: dueDate instanceof Date ? dueDate : null }
          : {}),
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const task = await actionTaskDelegate.findFirst({
      where: { id, userId: user.id },
    });

    return NextResponse.json({ ok: true, task });
  } catch (err) {
    return NextResponse.json(
      { error: getApiErrorMessage(err) },
      { status: getApiErrorStatus(err) },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
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

    const params = await context.params;
    const parsed = actionTaskDeleteSchema.safeParse({ id: params.id });

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const deleted = await actionTaskDelegate.deleteMany({
      where: { id: parsed.data.id, userId: user.id },
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
