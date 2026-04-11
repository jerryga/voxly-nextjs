import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { TranscriptionClient } from "./TranscriptionClient";
import { DashboardShell } from "./DashboardShell";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const displayName =
    session.user.name?.trim() || session.user.email?.split("@")[0] || "User";

  return (
    <DashboardShell
      displayName={displayName}
      email={session.user.email}
      activePath="overview"
    >
      <TranscriptionClient initialSurface="overview" />
    </DashboardShell>
  );
}
