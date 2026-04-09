import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { DashboardShell } from "../DashboardShell";
import { TranscriptionClient } from "../TranscriptionClient";

export default async function DashboardSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ section?: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const displayName =
    session.user.name?.trim() || session.user.email?.split("@")[0] || "User";
  const resolvedSearchParams = await searchParams;
  const requestedSection = resolvedSearchParams?.section;
  const initialSettingsSection =
    requestedSection === "workspace" ||
    requestedSection === "delivery" ||
    requestedSection === "integrations" ||
    requestedSection === "access" ||
    requestedSection === "personal"
      ? requestedSection
      : "personal";
  const initialSettingsMode =
    initialSettingsSection === "workspace" ||
    initialSettingsSection === "delivery" ||
    initialSettingsSection === "integrations" ||
    initialSettingsSection === "access"
      ? "workspace"
      : "personal";

  return (
    <DashboardShell
      displayName={displayName}
      email={session.user.email}
      activePath={initialSettingsMode === "workspace" ? "workspace" : "settings"}
    >
      <TranscriptionClient
        initialSurface="settings"
        initialSettingsSection={initialSettingsSection}
        initialSettingsMode={initialSettingsMode}
      />
    </DashboardShell>
  );
}
