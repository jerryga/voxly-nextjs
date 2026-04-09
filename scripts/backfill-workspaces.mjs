import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugifyWorkspaceName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function uniqueWorkspaceSlug(baseName) {
  const baseSlug = slugifyWorkspaceName(baseName) || "workspace";
  let slug = baseSlug;
  let suffix = 1;

  while (await prisma.workspace.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  return slug;
}

async function ensurePersonalWorkspace(user) {
  const existing = await prisma.workspace.findFirst({
    where: { ownerUserId: user.id, isPersonal: true },
  });

  if (existing) {
    return existing;
  }

  const baseName = `${user.name?.trim() || user.email.split("@")[0] || "Personal"} Workspace`;
  const slug = await uniqueWorkspaceSlug(baseName);

  return prisma.workspace.create({
    data: {
      ownerUserId: user.id,
      name: baseName,
      slug,
      isPersonal: true,
    },
  });
}

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  for (const user of users) {
    const workspace = await ensurePersonalWorkspace(user);

    await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: user.id,
        },
      },
      update: {
        role: "owner",
        status: "active",
        joinedAt: new Date(),
      },
      create: {
        workspaceId: workspace.id,
        userId: user.id,
        role: "owner",
        status: "active",
        joinedAt: new Date(),
      },
    });

    await prisma.project.updateMany({
      where: { userId: user.id, workspaceId: null },
      data: { workspaceId: workspace.id },
    });

    await prisma.transcription.updateMany({
      where: { userId: user.id, workspaceId: null },
      data: { workspaceId: workspace.id },
    });

    await prisma.summaryTemplate.updateMany({
      where: { userId: user.id, workspaceId: null },
      data: { workspaceId: workspace.id },
    });

    await prisma.actionTask.updateMany({
      where: { userId: user.id, workspaceId: null },
      data: { workspaceId: workspace.id },
    });

    console.log(`Backfilled workspace for ${user.email}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
