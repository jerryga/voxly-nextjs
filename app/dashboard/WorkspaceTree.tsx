"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SidebarWorkspace = {
  id: string;
  name: string;
  isPersonal: boolean;
};

type SidebarProject = {
  id: string;
  name: string;
  workspaceId: string | null;
};

type WorkspaceTreeProps = {
  workspaces: SidebarWorkspace[];
  projects: SidebarProject[];
  activeWorkspaceId: string | null;
  activePath:
    | "overview"
    | "transcriptions"
    | "workspace"
    | "intelligence"
    | "operations"
    | "settings"
    | "billing"
    | "contact";
  activeProjectId?: string | null;
};

export function WorkspaceTree({
  workspaces,
  projects,
  activeWorkspaceId,
  activePath,
  activeProjectId = null,
}: WorkspaceTreeProps) {
  const router = useRouter();
  const [switchingWorkspaceId, setSwitchingWorkspaceId] = useState<string | null>(
    null,
  );

  async function switchWorkspace(workspaceId: string, href: string) {
    if (!workspaceId) {
      return;
    }

    if (workspaceId === activeWorkspaceId) {
      router.push(href);
      return;
    }

    setSwitchingWorkspaceId(workspaceId);
    try {
      const response = await fetch("/api/workspaces/active", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to switch workspace");
      }

      router.push(href);
      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Failed to switch workspace",
      );
    } finally {
      setSwitchingWorkspaceId(null);
    }
  }

  if (!workspaces.length) {
    return (
      <p className="mt-3 rounded-2xl bg-[#f4f4f1] px-3 py-3 text-sm text-slate-500">
        No workspaces yet
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {workspaces.map((workspace) => {
        const workspaceProjects = projects.filter(
          (project) => project.workspaceId === workspace.id,
        );
        const isActiveWorkspace = workspace.id === activeWorkspaceId;
        const isBusy = switchingWorkspaceId === workspace.id;

        return (
          <details
            key={workspace.id}
            className={`group rounded-[24px] p-2 ${
              isActiveWorkspace ? "bg-[#f4f4f1]" : "bg-white"
            }`}
            open={
              isActiveWorkspace &&
              (activePath === "transcriptions" ||
                activePath === "settings" ||
                activePath === "workspace")
            }
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 rounded-[18px] px-3 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#f7f7f3]">
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
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  void switchWorkspace(workspace.id, "/dashboard");
                }}
                disabled={isBusy}
                className="min-w-0 flex-1 cursor-pointer truncate text-left disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBusy ? "Switching..." : workspace.name}
              </button>
            </summary>
            <div className="mt-1 space-y-1 pl-7">
              {workspaceProjects.length ? (
                workspaceProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() =>
                      void switchWorkspace(
                        workspace.id,
                        `/dashboard/transcriptions?projectId=${encodeURIComponent(
                          project.id,
                        )}`,
                      )
                    }
                    disabled={isBusy}
                    className={`flex w-full cursor-pointer items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      isActiveWorkspace &&
                      activePath === "transcriptions" &&
                      activeProjectId === project.id
                        ? "bg-white font-semibold text-slate-950"
                        : "text-slate-600 hover:bg-white hover:text-slate-950"
                    }`}
                  >
                    <span className="text-xs text-slate-400">▸</span>
                    <span className="truncate">{project.name}</span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-sm text-slate-500">No projects yet</p>
              )}
              <button
                type="button"
                onClick={() =>
                  void switchWorkspace(workspace.id, "/dashboard/settings?section=workspace")
                }
                disabled={isBusy}
                className={`flex w-full cursor-pointer items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  isActiveWorkspace && activePath === "workspace"
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
              </button>
            </div>
          </details>
        );
      })}
    </div>
  );
}
