"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadPanelBody } from "./OverviewSurface";
import type { UploadPanelBodyProps } from "./OverviewSurface";
import { HistorySurface } from "./HistorySurface";
import type { BillingInfo, BillingResponse } from "@/lib/billing-types";
import type {
  ActiveWorkspaceDetails,
  Project,
} from "./TranscriptionClient";

// ─── Types ────────────────────────────────────────────────────────────────────

type SummaryTemplate = { id: string; name: string };
type WorkspacesResponse = { ok?: boolean; activeWorkspace?: ActiveWorkspaceDetails | null; error?: string };
type ProjectsResponse  = { ok?: boolean; projects?: Project[]; project?: Project; error?: string };
type TemplatesResponse = { ok?: boolean; templates?: SummaryTemplate[]; error?: string };
type UploadPayload     = { transcriptionId?: string; projectId?: string; error?: string };

function isInsufficientCreditsError(message: string | null) {
  if (!message) return false;

  return (
    message.includes("does not have enough remaining credits") ||
    message.includes("not have enough remaining credits")
  );
}

// ─── useStableCallback ────────────────────────────────────────────────────────

function useStableCallback<T extends (...args: never[]) => unknown>(fn: T): T {
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; }, [fn]);
  return useCallback((...args: Parameters<T>) => ref.current(...args), []) as T;
}

// ─── DashboardClient ──────────────────────────────────────────────────────────

type DashboardSurface = "overview" | "transcriptions";

export function DashboardClient({ initialProjectFilter = "all" }: { initialProjectFilter?: string }) {
  const router = useRouter();
  const fileInputId = useId();

  const [activeSurface, setActiveSurface] = useState<DashboardSurface>("overview");

  // ── Workspace ──
  const [activeWorkspace, setActiveWorkspace] = useState<ActiveWorkspaceDetails | null>(null);

  // ── Data ──
  const [projects,        setProjects]        = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectBusy,     setProjectBusy]     = useState(false);
  const [customTemplates, setCustomTemplates] = useState<SummaryTemplate[]>([]);
  const [templatesLoading,setTemplatesLoading]= useState(true);
  const [templateBusy,    setTemplateBusy]    = useState(false);
  const [billing,         setBilling]         = useState<BillingInfo | null>(null);

  // ── Upload ──
  const [file,                      setFile]                      = useState<File | null>(null);
  const [estimatedDurationSeconds,  setEstimatedDurationSeconds]  = useState<number | null>(null);
  const [durationLoading,           setDurationLoading]           = useState(false);
  const [uploadTemplate,            setUploadTemplate]            = useState("default");
  const [uploadProjectId,           setUploadProjectId]           = useState("none");
  const [uploading,                 setUploading]                 = useState(false);
  const [uploadError,               setUploadError]               = useState<string | null>(null);

  const activeWorkspaceId = activeWorkspace?.id ?? null;
  const isDev = process.env.NODE_ENV !== "production";

  // ── Derived credits ──
  const estimatedCredits = estimatedDurationSeconds
    ? Math.max(1, Math.ceil(estimatedDurationSeconds / 60))
    : null;
  const hasEnoughEstimatedCredits =
    !estimatedCredits || !billing ? true : billing.creditsRemaining >= estimatedCredits;

  // ── Template options ──
  const templateOptions = useMemo(
    () => [
      { id: "default",     label: "Default Template (Default)" },
      { id: "brainstorm",  label: "Brainstorm Session" },
      { id: "interview",   label: "Interview Notes" },
      { id: "lecture",     label: "Lecture Notes" },
      { id: "voice-memo",  label: "Voice Memo Notes" },
      ...customTemplates.map((t) => ({ id: `custom:${t.id}`, label: `${t.name} (Custom)` })),
    ],
    [customTemplates],
  );

  // ── Data loaders ──
  async function loadWorkspace() {
    try {
      const res = await fetch("/api/workspaces");
      const data = (await res.json()) as WorkspacesResponse;
      if (res.ok) setActiveWorkspace(data.activeWorkspace ?? null);
    } catch { /* ignore */ }
  }

  async function loadProjects() {
    setProjectsLoading(true);
    try {
      const res = await fetch("/api/projects");
      const data = (await res.json()) as ProjectsResponse;
      if (res.ok) setProjects(data.projects ?? []);
    } catch { /* ignore */ }
    finally { setProjectsLoading(false); }
  }

  async function loadTemplates() {
    setTemplatesLoading(true);
    try {
      const res = await fetch("/api/templates");
      const data = (await res.json()) as TemplatesResponse;
      if (res.ok) setCustomTemplates(data.templates ?? []);
    } catch { /* ignore */ }
    finally { setTemplatesLoading(false); }
  }

  async function loadBilling() {
    try {
      const res = await fetch("/api/billing/subscription");
      const data = (await res.json()) as BillingResponse;
      if (res.ok) setBilling(data.billing ?? null);
    } catch { /* ignore */ }
  }

  useEffect(() => { void loadWorkspace(); }, []);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    void loadProjects();
    void loadTemplates();
    void loadBilling();
  }, [activeWorkspaceId]);

  useEffect(() => {
    function handleWorkspaceSwitched() {
      // Re-fetch workspace so activeWorkspaceId changes, which cascades to
      // projects / templates / billing via the effect above.
      void loadWorkspace();
      // Reset upload and surface state for the new workspace.
      setFile(null);
      setEstimatedDurationSeconds(null);
      setUploadError(null);
      setUploadProjectId("none");
      setActiveSurface("overview");
    }
    window.addEventListener("voxly:workspace-switched", handleWorkspaceSwitched);
    return () => window.removeEventListener("voxly:workspace-switched", handleWorkspaceSwitched);
  }, []);

  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; }, [router]);

  useEffect(() => {
    function handleNavigate(event: Event) {
      const detail = (event as CustomEvent<{ surface?: string }>).detail;
      if (detail?.surface === "transcriptions") {
        setActiveSurface("transcriptions");
      } else if (detail?.surface === "overview") {
        setActiveSurface("overview");
      } else if (detail?.surface === "settings") {
        // Settings lives in TranscriptionClient — do a real navigation
        routerRef.current.push("/dashboard/settings");
      }
    }
    window.addEventListener("voxly:navigate-dashboard-surface", handleNavigate);
    return () => window.removeEventListener("voxly:navigate-dashboard-surface", handleNavigate);
  }, []);

  // ── Media duration ──
  async function readMediaDuration(fileToRead: File) {
    setDurationLoading(true);
    try {
      const url = URL.createObjectURL(fileToRead);
      const el = document.createElement(fileToRead.type.startsWith("video/") ? "video" : "audio");
      el.preload = "metadata";
      const duration = await new Promise<number | null>((resolve) => {
        el.onloadedmetadata = () => {
          URL.revokeObjectURL(url);
          el.removeAttribute("src");
          el.load();
          resolve(Number.isFinite(el.duration) && el.duration > 0 ? el.duration : null);
        };
        el.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        el.src = url;
      });
      setEstimatedDurationSeconds(duration);
    } catch { setEstimatedDurationSeconds(null); }
    finally { setDurationLoading(false); }
  }

  // ── File change ──
  const handleFileChange = useStableCallback((nextFile: File | null) => {
    setFile(nextFile);
    setEstimatedDurationSeconds(null);
    if (nextFile) void readMediaDuration(nextFile);
  });

  // ── Upload ──
  const handleUpload = useStableCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadError(null);

    const body = new FormData();
    body.append("file", file);
    body.append("template", uploadTemplate);
    if (uploadProjectId !== "none") body.append("projectId", uploadProjectId);
    if (estimatedDurationSeconds) body.append("estimatedDurationSeconds", String(estimatedDurationSeconds));

    try {
      const res = await fetch("/api/uploads", { method: "POST", body });
      const data = (await res.json()) as UploadPayload;
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      if (data.transcriptionId) {
        router.push(`/session/${data.transcriptionId}`);
        return;
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  });

  // ── Create project ──
  const handleCreateProject = useStableCallback(async (input: { name: string; description: string }): Promise<boolean> => {
    setProjectBusy(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as ProjectsResponse;
      if (res.ok && data.project) {
        setProjects((prev) => [...prev, data.project!]);
        setUploadProjectId(data.project.id);
        return true;
      }
      return false;
    } catch { return false; }
    finally { setProjectBusy(false); }
  });

  // ── Create template ──
  const handleCreateTemplate = useStableCallback(async (input: { name: string; baseTemplate: string; promptInstructions: string }): Promise<boolean> => {
    setTemplateBusy(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as TemplatesResponse;
      if (res.ok && data.templates) { setCustomTemplates(data.templates); return true; }
      return false;
    } catch { return false; }
    finally { setTemplateBusy(false); }
  });

  // ── History callbacks ──
  const handleAssignProject = useStableCallback(async (txId: string, projectId: string): Promise<boolean> => {
    const res = await fetch("/api/transcriptions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: txId, projectId }),
    });
    return res.ok;
  });

  const handleDelete = useStableCallback(async (txId: string) => {
    await fetch("/api/transcriptions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: txId }),
    });
  });

  // ── Upload panel props ──
  const uploadBodyProps = useMemo<UploadPanelBodyProps>(() => ({
    activeWorkspace,
    fileInputId,
    file,
    onFileChange: handleFileChange,
    estimatedDurationSeconds,
    isDev,
    testDataLoading: false,
    testDataStatus: null,
    onLoadTestData: async () => {},
    uploadTemplate,
    onUploadTemplateChange: setUploadTemplate,
    templateOptions,
    templatesStatusText: templatesLoading
      ? "Loading templates..."
      : customTemplates.length
        ? `${customTemplates.length} custom template${customTemplates.length === 1 ? "" : "s"}`
        : "No custom templates yet.",
    templateBusy,
    onCreateTemplate: handleCreateTemplate,
    uploadProjectId,
    onUploadProjectIdChange: setUploadProjectId,
    projects,
    projectsStatusText: projectsLoading
      ? "Loading projects..."
      : projects.length
        ? `${projects.length} project${projects.length === 1 ? "" : "s"}`
        : "No projects yet.",
    projectBusy,
    onCreateProject: handleCreateProject,
    onUpload: handleUpload,
    uploading,
    durationLoading,
    hasEnoughEstimatedCredits,
    estimatedCredits,
    billing,
  }), [
    activeWorkspace, billing, customTemplates.length, durationLoading,
    estimatedCredits, estimatedDurationSeconds, file, fileInputId,
    handleCreateProject, handleCreateTemplate, handleFileChange, handleUpload,
    hasEnoughEstimatedCredits, isDev, projectBusy, projects, projectsLoading,
    templateBusy, templateOptions, templatesLoading, uploadProjectId,
    uploadTemplate, uploading,
  ]);

  const statusOptions = useMemo(() => [
    { id: "all",        label: "All statuses" },
    { id: "uploading",  label: "Uploading" },
    { id: "uploaded",   label: "Uploaded" },
    { id: "processing", label: "Processing" },
    { id: "done",       label: "Done" },
    { id: "error",      label: "Error" },
  ], []);

  const isOverview = activeSurface === "overview";
  const isHistory  = activeSurface === "transcriptions";

  return (
    <div className="space-y-6">
      {/* Upload zone — shown on Overview only */}
      <section className={`rounded-[28px] border border-white/80 bg-white/90 p-6 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)] sm:p-7 ${isOverview ? "" : "hidden"}`}>
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-700">
            Upload
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">
            Drop in a recording and let Voxly shape it.
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Choose a notes template, upload your file, and Voxly will turn the
            recording into a transcript, summary, and action-ready output.
          </p>
        </div>
        <UploadPanelBody {...uploadBodyProps} />
        {uploadError && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800">
            <p>{uploadError}</p>
            {isInsufficientCreditsError(uploadError) ? (
              <a
                href="/billing"
                className="mt-3 inline-flex rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white"
              >
                Buy Credits
              </a>
            ) : null}
          </div>
        )}
      </section>

      {/* History — shown on History tab (and prefetched/mounted on Overview too) */}
      <HistorySurface
        key={activeWorkspaceId ?? "pending"}
        isActive={isHistory}
        activeWorkspaceId={activeWorkspaceId}
        activeWorkspace={activeWorkspace}
        initialProjectFilter={initialProjectFilter}
        statusOptions={statusOptions}
        templateOptions={templateOptions}
        projects={projects}
        onAssignProject={handleAssignProject}
        onDelete={handleDelete}
      />
    </div>
  );
}
