import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { DashboardShell } from "@/app/dashboard/DashboardShell";
import { BillingClient } from "./BillingClient";

export default async function BillingPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const displayName =
    session.user.name?.trim() || session.user.email?.split("@")[0] || "User";

  return (
    <DashboardShell
      activePath="billing"
      displayName={displayName}
      email={session.user.email}
    >
        <BillingClient />
    </DashboardShell>
  );
}
