import { CreateWorkspaceButton } from "./CreateWorkspaceButton";
import { DashboardSidebarNav } from "./DashboardSidebarNav";
import { SignOutButton } from "./SignOutButton";
import { WorkspaceTree } from "./WorkspaceTree";
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
  const sidebarWorkspaces =
    workspaceContext?.memberships.map((membership) => ({
      id: membership.workspace.id,
      name: membership.workspace.name,
      isPersonal: membership.workspace.isPersonal,
    })) ?? [];
  const sidebarWorkspaceProjects = sidebarWorkspaces.length
    ? await prisma.project.findMany({
        where: { workspaceId: { in: sidebarWorkspaces.map((workspace) => workspace.id) } },
        select: {
          id: true,
          name: true,
          workspaceId: true,
        },
        orderBy: [{ workspaceId: "asc" }, { createdAt: "asc" }],
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
            <DashboardSidebarNav
              links={sidebarLinks}
              activePath={activePath}
              activeProjectId={activeProjectId}
            />
          </div>

          <div className="mt-7">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Spaces
            </p>
            <CreateWorkspaceButton />
            <WorkspaceTree
              workspaces={sidebarWorkspaces}
              projects={sidebarWorkspaceProjects}
              activeWorkspaceId={workspaceContext?.activeWorkspace.id ?? null}
              activePath={activePath}
              activeProjectId={activeProjectId}
            />
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
