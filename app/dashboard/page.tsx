import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { TranscriptionClient } from "./TranscriptionClient";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  return (
    <div className="min-h-screen bg-white px-4 py-8 sm:px-6 sm:py-12 text-slate-900">
      <div className="mx-auto w-full max-w-[1600px]">
        <TranscriptionClient />
      </div>
    </div>
  );
}
