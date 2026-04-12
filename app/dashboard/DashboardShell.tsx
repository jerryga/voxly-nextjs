import Link from "next/link";
import { CreateWorkspaceButton } from "./CreateWorkspaceButton";
import { SignOutButton } from "./SignOutButton";
import { BrandLink } from "@/app/components/BrandLink";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext } from "@/lib/workspaces";

type DashboardShellProps = {
  children: React.ReactNode;
  displayName: string;
  email?: string | null;
  activeProjectId?: string | null;
  activePath?:
    | "overview"
    | "transcriptions"
    | "workspace"
    | "intelligence"
    | "operations"
    | "settings"
    | "billing"
    | "contact";
};

export async function DashboardShell({
  children,
  displayName,
  email,
  activeProjectId = null,
  activePath = "overview",
}: DashboardShellProps) {
  const workspaceContext = await getWorkspaceContext();
  const sidebarWorkspace = workspaceContext?.activeWorkspace ?? null;
  const sidebarWorkspaceProjects = sidebarWorkspace
    ? await prisma.project.findMany({
        where: { workspaceId: sidebarWorkspace.id },
        select: {
          id: true,
          name: true,
        },
        orderBy: [{ createdAt: "asc" }],
      })
    : [];
  const initial = displayName.charAt(0).toUpperCase();
  const sidebarLinks = [
    { id: "overview", label: "Overview", href: "/dashboard" },
    { id: "transcriptions", label: "History", href: "/dashboard/transcriptions" },
    { id: "settings", label: "Settings", href: "/dashboard/settings" },
    { id: "billing", label: "Billing", href: "/billing" },
    { id: "contact", label: "Contact", href: "/contact" },
  ] as const;

  return (
    <div className="min-h-screen bg-[#f6f6f3] text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.08),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.06),transparent_28%),linear-gradient(180deg,#f8f8f5_0%,#f6f6f3_40%,#f3f4f6_100%)]" />
      <div className="flex min-h-screen">
        <aside className="hidden h-screen w-[272px] shrink-0 overflow-hidden border-r border-slate-200/80 bg-white/92 px-5 pb-3 pt-6 xl:sticky xl:top-0 xl:flex xl:flex-col">
          <BrandLink href="/dashboard" subtitle="Knowledge Workspace" />

          <div className="mt-8">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Navigate
            </p>
            <nav className="mt-3 space-y-1">
              {sidebarLinks.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center rounded-2xl px-3 py-3 text-sm font-medium transition ${
                    activePath === item.id &&
                    !(item.id === "transcriptions" && activeProjectId)
                      ? "bg-slate-950 text-white"
                      : "text-slate-600 hover:bg-[#f7f7f3] hover:text-slate-950"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="mt-7">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Spaces
            </p>
            <CreateWorkspaceButton />
            <details
              className="group mt-3 rounded-[24px] bg-[#f4f4f1] p-2"
              open={
                activePath === "transcriptions" ||
                activePath === "settings" ||
                activePath === "workspace"
              }
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-[18px] px-3 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white">
                <span className="inline-flex h-5 w-5 items-center justify-center text-slate-500 transition duration-200 group-open:rotate-90">
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                    className="h-4 w-4"
                  >
                    <path
                      d="M7 4.5 13 10l-6 5.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="truncate">
                  {sidebarWorkspace?.name || "Current workspace"}
                </span>
              </summary>
              <div className="mt-1 space-y-1 pl-7">
                {sidebarWorkspaceProjects.length ? (
                  sidebarWorkspaceProjects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/dashboard/transcriptions?projectId=${encodeURIComponent(project.id)}`}
                      className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-sm transition ${
                        activePath === "transcriptions" && activeProjectId === project.id
                          ? "bg-white font-semibold text-slate-950"
                          : "text-slate-600 hover:bg-white hover:text-slate-950"
                      }`}
                    >
                      <span className="text-xs text-slate-400">▸</span>
                      {project.name}
                    </Link>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-slate-500">
                    No projects yet
                  </p>
                )}
                <Link
                  href="/dashboard/settings?section=workspace"
                  className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-sm transition ${
                    activePath === "workspace"
                      ? "bg-white font-semibold text-slate-950"
                      : "text-slate-600 hover:bg-white hover:text-slate-950"
                  }`}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-400">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                      className="h-4 w-4"
                    >
                      <path
                        d="M4 7h10M18 7h2M4 17h2M10 17h10"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <circle
                        cx="16"
                        cy="7"
                        r="2"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <circle
                        cx="8"
                        cy="17"
                        r="2"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                  </span>
                  Workspace settings
                </Link>
              </div>
            </details>
          </div>

          <div className="mt-auto rounded-[24px] border border-slate-200 bg-white p-3.5 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.35)]">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#111827] text-sm font-bold text-white">
                {initial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                <p className="truncate text-xs text-slate-500">{email}</p>
              </div>
            </div>
            <div className="mt-3">
              <SignOutButton />
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="border-b border-slate-200/80 bg-white/72 px-4 py-4 backdrop-blur sm:px-6 xl:hidden">
            <div className="flex items-center justify-between gap-4">
              <BrandLink href="/dashboard" subtitle="Knowledge Workspace" />
              <SignOutButton />
            </div>
          </div>

          <div className="px-4 py-5 sm:px-6 xl:px-8 xl:py-7">{children}</div>
        </main>
      </div>
    </div>
  );
}
