"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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

const DELETED_WORKSPACE_TOMBSTONE_KEY = "voxly:dashboard:deleted-workspace";

function clearDeletedWorkspaceTombstone() {
  window.sessionStorage.removeItem(DELETED_WORKSPACE_TOMBSTONE_KEY);
}

export function WorkspaceTree({
  workspaces,
  projects,
  activeWorkspaceId,
  activePath,
  activeProjectId = null,
}: WorkspaceTreeProps) {
  const router = useRouter();
  const [switchingWorkspaceId, setSwitchingWorkspaceId] = useState<string | null>(null);
  const [deletedWorkspaceIds, setDeletedWorkspaceIds] = useState<string[]>([]);
  // Controlled expand state — active workspace always starts open
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(activeWorkspaceId ? [activeWorkspaceId] : []),
  );
  // Track the last known active workspace so we can auto-expand on switch
  const prevActiveWorkspaceIdRef = useRef(activeWorkspaceId);

  // Auto-expand newly active workspace when it changes (e.g. after a switch)
  useEffect(() => {
    if (activeWorkspaceId && activeWorkspaceId !== prevActiveWorkspaceIdRef.current) {
      setExpandedIds((prev) => new Set([...prev, activeWorkspaceId]));
      prevActiveWorkspaceIdRef.current = activeWorkspaceId;
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    function handleWorkspaceDeleted(event: Event) {
      const workspaceId = (event as CustomEvent<{ workspaceId?: string }>).detail?.workspaceId;
      if (!workspaceId) return;
      setDeletedWorkspaceIds((prev) =>
        prev.includes(workspaceId) ? prev : [...prev, workspaceId],
      );
    }

    window.addEventListener("voxly:workspace-deleted", handleWorkspaceDeleted);
    return () => window.removeEventListener("voxly:workspace-deleted", handleWorkspaceDeleted);
  }, []);

  function toggleExpanded(workspaceId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(workspaceId)) {
        next.delete(workspaceId);
      } else {
        next.add(workspaceId);
      }
      return next;
    });
  }

  async function switchWorkspace(workspaceId: string, href: string) {
    if (!workspaceId) return;

    if (workspaceId === activeWorkspaceId) {
      clearDeletedWorkspaceTombstone();
      window.dispatchEvent(
        new CustomEvent("voxly:workspace-switched", { detail: { workspaceId } }),
      );
      router.push(href);
      router.refresh();
      return;
    }

    setSwitchingWorkspaceId(workspaceId);
    // Optimistically expand the target workspace so the user sees its projects
    setExpandedIds((prev) => new Set([...prev, workspaceId]));

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

      clearDeletedWorkspaceTombstone();
      window.dispatchEvent(
        new CustomEvent("voxly:workspace-switched", { detail: { workspaceId } }),
      );
      router.push(href);
      router.refresh();
    } catch (error) {
      // Revert optimistic expansion on failure
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.delete(workspaceId);
        return next;
      });
      window.alert(error instanceof Error ? error.message : "Failed to switch workspace");
    } finally {
      setSwitchingWorkspaceId(null);
    }
  }

  const visibleWorkspaces = workspaces.filter(
    (workspace) => !deletedWorkspaceIds.includes(workspace.id),
  );
  const visibleProjects = projects.filter(
    (project) => !project.workspaceId || !deletedWorkspaceIds.includes(project.workspaceId),
  );

  if (!visibleWorkspaces.length) {
    return (
      <p className="mt-3 rounded-2xl bg-[#f4f4f1] px-3 py-3 text-sm text-slate-500">
        No workspaces yet
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {visibleWorkspaces.map((workspace) => {
        const workspaceProjects = visibleProjects.filter(
          (project) => project.workspaceId === workspace.id,
        );
        const isActiveWorkspace = workspace.id === activeWorkspaceId;
        const isSwitching = switchingWorkspaceId === workspace.id;
        const isExpanded = expandedIds.has(workspace.id);
        const isAnySwitching = switchingWorkspaceId !== null;

        return (
          <div
            key={workspace.id}
            className={`rounded-[22px] p-1.5 transition-colors duration-150 ${
              isActiveWorkspace && isExpanded
                ? "bg-[#f4f4f1]"
                : isActiveWorkspace
                  ? "bg-[#f4f4f1]/60"
                  : "bg-transparent"
            }`}
          >
            {/* Workspace header row */}
            <div className="flex items-center gap-1">
              {/* Chevron — expand/collapse only, never switches workspace */}
              <button
                type="button"
                aria-label={isExpanded ? "Collapse workspace" : "Expand workspace"}
                onClick={() => toggleExpanded(workspace.id)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-600"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                >
                  <path
                    d="M7 4.5 13 10l-6 5.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {/* Workspace name — switches workspace */}
              <button
                type="button"
                onClick={() => void switchWorkspace(workspace.id, "/dashboard")}
                disabled={isSwitching || isAnySwitching}
                className={`min-w-0 flex-1 rounded-xl px-1.5 py-1.5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  isActiveWorkspace
                    ? "hover:bg-slate-200/50"
                    : "hover:bg-slate-100"
                }`}
              >
                <span className="block truncate text-sm font-semibold leading-snug text-slate-950">
                  {isSwitching ? "Switching…" : workspace.name}
                </span>
                {workspace.isPersonal && (
                  <span className="text-[11px] font-normal text-slate-400">
                    Personal
                  </span>
                )}
              </button>
            </div>

            {/* Collapsible project list */}
            <div
              className={`overflow-hidden transition-all duration-200 ${
                isExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="mt-1 space-y-0.5 pb-1 pl-8">
                {workspaceProjects.length > 0 ? (
                  workspaceProjects.map((project) => {
                    const isActiveProject =
                      isActiveWorkspace &&
                      activePath === "transcriptions" &&
                      activeProjectId === project.id;

                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() =>
                          void switchWorkspace(
                            workspace.id,
                            `/dashboard/transcriptions?projectId=${encodeURIComponent(project.id)}`,
                          )
                        }
                        disabled={isSwitching || isAnySwitching}
                        className={`flex w-full cursor-pointer items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          isActiveProject
                            ? "bg-white font-semibold text-slate-950 shadow-sm"
                            : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            isActiveProject ? "bg-slate-700" : "bg-slate-300"
                          }`}
                        />
                        <span className="truncate">{project.name}</span>
                      </button>
                    );
                  })
                ) : (
                  <p className="px-3 py-2 text-xs text-slate-400">No projects yet</p>
                )}

                {/* Workspace Settings link */}
                <button
                  type="button"
                  onClick={() =>
                    void switchWorkspace(workspace.id, "/dashboard/settings?section=workspace")
                  }
                  disabled={isSwitching || isAnySwitching}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    isActiveWorkspace && activePath === "workspace"
                      ? "bg-white font-semibold text-slate-950 shadow-sm"
                      : "text-slate-500 hover:bg-white/70 hover:text-slate-950"
                  }`}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-400">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
                      <path
                        d="M4 7h10M18 7h2M4 17h2M10 17h10"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <circle cx="16" cy="7" r="2" stroke="currentColor" strokeWidth="2" />
                      <circle cx="8" cy="17" r="2" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </span>
                  Workspace Settings
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
