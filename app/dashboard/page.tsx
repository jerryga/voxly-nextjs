import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { TranscriptionClient } from "./TranscriptionClient";
import { SignOutButton } from "./SignOutButton";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const displayName =
    session.user.name?.trim() || session.user.email?.split("@")[0] || "User";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
        <div className="mx-auto flex w-full max-w-400 items-center gap-3 px-4 py-3 sm:px-6">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
              V
            </span>
            <span className="text-sm font-bold tracking-tight text-slate-900">
              Voxly
            </span>
          </a>

          <nav className="hidden items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 md:flex">
            {[
              { label: "Workspace", href: "/dashboard" },
              { label: "Uploads", href: "#upload" },
              { label: "Transcriptions", href: "#transcriptions" },
              { label: "Assistant", href: "#assistant" },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              System healthy
            </div>

            <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 sm:flex">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-bold text-white">
                {initial}
              </span>
              <div className="leading-tight">
                <p className="max-w-36 truncate text-sm font-semibold text-slate-900">
                  {displayName}
                </p>
                <p className="max-w-36 truncate text-xs text-slate-500">
                  {session.user.email}
                </p>
              </div>
            </div>

            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-400 px-4 py-6 sm:px-6 sm:py-8">
        <TranscriptionClient />
      </div>
    </div>
  );
}
