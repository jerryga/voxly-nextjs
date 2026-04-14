import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext } from "@/lib/workspaces";
import { ensureWorkspaceDigestSettings } from "@/lib/workspace-digests";
import { getWorkspaceNotionSettings } from "@/lib/notion";
import { DashboardShell } from "@/app/dashboard/DashboardShell";
import { SessionClient } from "./SessionClient";
import type { ActiveWorkspaceDetails } from "./SessionAssistantRail";

type Props = { params: Promise<{ id: string }> };

export default async function SessionPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const { id } = await params;

  const workspaceContext = await getWorkspaceContext();
  if (!workspaceContext) {
    redirect("/auth/sign-in");
  }

  const workspaceId = workspaceContext.activeWorkspace.id;

  const [transcription, projects, digestSettings, notionSettings] = await Promise.all([
    prisma.transcription.findFirst({
      where: { id, workspaceId },
      select: {
        id: true,
        fileName: true,
        status: true,
        template: true,
        projectId: true,
        createdAt: true,
        updatedAt: true,
        duration: true,
        transcript: true,
        decisions: true,
        keyPoints: true,
        nextSteps: true,
        actionItems: true,
      },
    }),
    prisma.project.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: "asc" },
    }),
    ensureWorkspaceDigestSettings(workspaceId),
    getWorkspaceNotionSettings(workspaceId),
  ]);

  if (!transcription) {
    notFound();
  }

  const displayName =
    session.user.name?.trim() || session.user.email?.split("@")[0] || "User";

  // Build ActiveWorkspaceDetails-compatible shape from workspace context
  const activeWorkspace: ActiveWorkspaceDetails = {
    id: workspaceContext.activeWorkspace.id,
    name: workspaceContext.activeWorkspace.name,
    slug: workspaceContext.activeWorkspace.slug,
    isPersonal: workspaceContext.activeWorkspace.isPersonal,
    createdAt: new Date().toISOString(),
    role: workspaceContext.role,
    canManage: workspaceContext.role === "owner" || workspaceContext.role === "admin",
    memberCount: 1,
    owner: {
      id: workspaceContext.user.id,
      email: workspaceContext.user.email,
      name: workspaceContext.user.name,
    },
  };

  // Serialize dates and JSON fields for client consumption
  const serializedTranscription = {
    ...transcription,
    createdAt: transcription.createdAt.toISOString(),
    updatedAt: transcription.updatedAt.toISOString(),
    decisions: Array.isArray(transcription.decisions)
      ? (transcription.decisions as string[])
      : undefined,
    keyPoints: Array.isArray(transcription.keyPoints)
      ? (transcription.keyPoints as string[])
      : undefined,
    nextSteps: Array.isArray(transcription.nextSteps)
      ? (transcription.nextSteps as string[])
      : undefined,
    actionItems: Array.isArray(transcription.actionItems)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (transcription.actionItems as any[])
      : undefined,
  };

  const serializedProjects = projects.map((project) => ({
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  }));

  return (
    <DashboardShell
      displayName={displayName}
      email={session.user.email}
      activePath="transcriptions"
    >
      <SessionClient
        transcription={serializedTranscription}
        projects={serializedProjects}
        activeWorkspace={activeWorkspace}
        hasDigestConfigured={digestSettings.enabled}
        hasNotionConfigured={notionSettings.configured}
      />
    </DashboardShell>
  );
}
