"use client";

import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import type { ActiveWorkspaceDetails, Project, Transcription } from "./TranscriptionClient";

const DASHBOARD_CACHE_TTL_MS = 60_000;
const HISTORY_CACHE_PREFIX = "voxly:dashboard:history:";

type SessionCacheEntry<T> = {
  savedAt: number;
  value: T;
};

const historyMemoryCache = new Map<string, SessionCacheEntry<unknown>>();

function readSessionCache<T>(key: string): T | null {
  const memoryEntry = historyMemoryCache.get(key) as SessionCacheEntry<T> | undefined;
  if (memoryEntry?.savedAt && Date.now() - memoryEntry.savedAt <= DASHBOARD_CACHE_TTL_MS) {
    return memoryEntry.value;
  }
  if (memoryEntry) {
    historyMemoryCache.delete(key);
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(key);
    if (!rawValue) {
      return null;
    }

    const entry = JSON.parse(rawValue) as SessionCacheEntry<T>;
    if (!entry?.savedAt || Date.now() - entry.savedAt > DASHBOARD_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(key);
      historyMemoryCache.delete(key);
      return null;
    }

    historyMemoryCache.set(key, entry as SessionCacheEntry<unknown>);
    return entry.value;
  } catch {
    window.sessionStorage.removeItem(key);
    historyMemoryCache.delete(key);
    return null;
  }
}

function writeSessionCache<T>(key: string, value: T) {
  historyMemoryCache.set(key, { savedAt: Date.now(), value });

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      key,
      JSON.stringify({ savedAt: Date.now(), value } satisfies SessionCacheEntry<T>),
    );
  } catch {
    // Ignore cache write failures; the network path is still the source of truth.
  }
}

function buildHistoryCacheKey(input: {
  workspaceId?: string | null;
  query: string;
  status: string;
  template: string;
  projectId: string;
}) {
  return `${HISTORY_CACHE_PREFIX}${encodeURIComponent(JSON.stringify(input))}`;
}

type ApiResponse = {
  ok?: boolean;
  items?: Transcription[];
  total?: number;
  nextCursor?: string | null;
  error?: string;
};
type HistoryFiltersProps = {
  initialSearchQuery: string;
  statusFilter: string;
  templateFilter: string;
  projectFilter: string;
  statusOptions: Array<{ id: string; label: string }>;
  templateOptions: Array<{ id: string; label: string }>;
  projects: Project[];
  searchDisabled: boolean;
  onSearchCommit: (value: string) => void;
  onSearchInputStart: () => void;
  onStatusChange: (value: string) => void;
  onTemplateChange: (value: string) => void;
  onProjectChange: (value: string) => void;
};

const HistoryFilters = memo(function HistoryFilters({
  initialSearchQuery,
  statusFilter,
  templateFilter,
  projectFilter,
  statusOptions,
  templateOptions,
  projects,
  searchDisabled,
  onSearchCommit,
  onSearchInputStart,
  onStatusChange,
  onTemplateChange,
  onProjectChange,
}: HistoryFiltersProps) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchCommitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committedSearchRef = useRef(initialSearchQuery.trim());
  const onSearchCommitRef = useRef(onSearchCommit);
  const onSearchInputStartRef = useRef(onSearchInputStart);
  const [localStatusFilter, setLocalStatusFilter] = useState(statusFilter);
  const [localTemplateFilter, setLocalTemplateFilter] = useState(templateFilter);
  const [localProjectFilter, setLocalProjectFilter] = useState(projectFilter);

  useEffect(() => {
    onSearchCommitRef.current = onSearchCommit;
  }, [onSearchCommit]);

  useEffect(() => {
    onSearchInputStartRef.current = onSearchInputStart;
  }, [onSearchInputStart]);

  useEffect(() => {
    committedSearchRef.current = initialSearchQuery.trim();
    if (searchInputRef.current && searchInputRef.current.value !== initialSearchQuery) {
      searchInputRef.current.value = initialSearchQuery;
    }
  }, [initialSearchQuery]);

  useEffect(() => {
    setLocalStatusFilter(statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    setLocalTemplateFilter(templateFilter);
  }, [templateFilter]);

  useEffect(() => {
    setLocalProjectFilter(projectFilter);
  }, [projectFilter]);

  useEffect(() => {
    return () => {
      if (searchCommitTimeoutRef.current) {
        clearTimeout(searchCommitTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      startTransition(() => {
        onStatusChange(localStatusFilter);
        onTemplateChange(localTemplateFilter);
        onProjectChange(localProjectFilter);
      });
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [
    localProjectFilter,
    localStatusFilter,
    localTemplateFilter,
    onProjectChange,
    onStatusChange,
    onTemplateChange,
  ]);

  function commitSearch(nextSearchValue?: string) {
    const nextValue = (nextSearchValue ?? searchInputRef.current?.value ?? "").trim();
    if (nextValue === committedSearchRef.current) {
      return;
    }
    committedSearchRef.current = nextValue;
    startTransition(() => {
      onSearchCommitRef.current(nextValue);
    });
  }

  useEffect(() => {
    const input = searchInputRef.current;
    if (!input) {
      return;
    }
    const activeInput = input;

    function handleInput() {
      if (activeInput.disabled) {
        return;
      }

      const nextValue = activeInput.value;
      onSearchInputStartRef.current();
      if (searchCommitTimeoutRef.current) {
        clearTimeout(searchCommitTimeoutRef.current);
      }
      searchCommitTimeoutRef.current = setTimeout(() => {
        commitSearch(nextValue);
      }, 700);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      if (searchCommitTimeoutRef.current) {
        clearTimeout(searchCommitTimeoutRef.current);
      }
      commitSearch(activeInput.value);
    }

    activeInput.addEventListener("input", handleInput);
    activeInput.addEventListener("keydown", handleKeyDown);
    return () => {
      activeInput.removeEventListener("input", handleInput);
      activeInput.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_180px_180px_180px]">
      <label className="block">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
          Search
        </span>
        <input
          type="search"
          ref={searchInputRef}
          defaultValue={initialSearchQuery}
          disabled={searchDisabled}
          placeholder={
            searchDisabled ? "Loading history before search..." : "Search recording names"
          }
          className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        />
      </label>

      <label className="block">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
          Status
        </span>
        <select
          value={localStatusFilter}
          onChange={(event) => setLocalStatusFilter(event.target.value)}
          className="mt-2 w-full cursor-pointer rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300"
        >
          {statusOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
          Template
        </span>
        <select
          value={localTemplateFilter}
          onChange={(event) => setLocalTemplateFilter(event.target.value)}
          className="mt-2 w-full cursor-pointer rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300"
        >
          <option value="all">All templates</option>
          {templateOptions.map((template) => (
            <option key={template.id} value={template.id}>
              {template.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
          Project
        </span>
        <select
          value={localProjectFilter}
          onChange={(event) => setLocalProjectFilter(event.target.value)}
          className="mt-2 w-full cursor-pointer rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300"
        >
          <option value="all">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
});

type HistoryRowProps = {
  item: Transcription;
  projects: Project[];
  onAssignProject: (transcriptionId: string, projectId: string) => Promise<boolean>;
  onProcess: (transcriptionId: string, template?: string | null) => void;
  onDelete: (transcriptionId: string) => Promise<void>;
};

const HistoryRow = memo(function HistoryRow({
  item,
  projects,
  onAssignProject,
  onProcess,
  onDelete,
}: HistoryRowProps) {
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [localProjectId, setLocalProjectId] = useState(item.projectId || "none");
  const [isAssigning, setIsAssigning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const transcriptPreview = item.transcript
    ? item.transcript.length > 1800
      ? `${item.transcript.slice(0, 1800).trim()}...`
      : item.transcript
    : "";
  const isTranscriptTruncated = Boolean(
    item.transcript && item.transcript.length > transcriptPreview.length,
  );

  useEffect(() => {
    setLocalProjectId(item.projectId || "none");
  }, [item.projectId]);

  return (
    <div
      className="rounded-[18px] border border-slate-200 bg-white px-4 py-4 hover:border-slate-300"
      style={{ contain: "content" }}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <Link
            href={`/session/${item.id}`}
            prefetch={true}
            className="block truncate text-[15px] font-semibold text-slate-900 hover:text-orange-700 transition-colors"
          >
            {item.fileName}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <p className="text-xs text-slate-500">
              {new Date(item.createdAt).toLocaleString()}
            </p>
            <span className="text-slate-300">•</span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                item.status === "done"
                  ? "bg-green-100 text-green-700"
                  : item.status === "uploaded"
                    ? "bg-amber-100 text-amber-700"
                    : item.status === "uploading"
                      ? "bg-orange-100 text-orange-700"
                      : item.status === "processing"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-700"
              }`}
            >
              {item.status}
            </span>
            {item.duration ? (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500">
                  {Math.max(1, Math.ceil(item.duration / 60))} credits
                </span>
              </>
            ) : null}
            {item.projectId ? (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500">
                  {projects.find((project) => project.id === item.projectId)?.name || "Project"}
                </span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:max-w-[28rem] xl:justify-end">
          <select
            value={localProjectId}
            onChange={async (event) => {
              const nextProjectId = event.target.value;
              const previousProjectId = localProjectId;
              setLocalProjectId(nextProjectId);
              setIsAssigning(true);
              const saved = await onAssignProject(item.id, nextProjectId);
              if (!saved) {
                setLocalProjectId(previousProjectId);
              }
              setIsAssigning(false);
            }}
            disabled={isAssigning}
            className="cursor-pointer rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="none">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          {item.transcript ? (
            <button
              type="button"
              onClick={() => setIsTranscriptOpen((prev) => !prev)}
              className="cursor-pointer rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-700 hover:border-slate-300 hover:bg-[#f2f7ff] hover:text-sky-700 active:scale-95"
            >
              {isTranscriptOpen ? "Hide Transcript" : "View Transcript"}
            </button>
          ) : null}

          <button
            type="button"
            onClick={async () => {
              setIsDeleting(true);
              try {
                await onDelete(item.id);
              } finally {
                setIsDeleting(false);
              }
            }}
            disabled={isDeleting}
            className="cursor-pointer rounded-full border border-red-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      {item.transcript && isTranscriptOpen ? (
        <div
          className="mt-4 max-h-[28rem] overflow-hidden rounded-[16px] border border-slate-200 bg-[#fcfbf8] p-4"
          style={{ contain: "content" }}
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Transcript
            </p>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                {item.transcript.length.toLocaleString()} chars
              </span>
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(item.transcript || "")}
                className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-[#f8f5ef]"
              >
                Copy full
              </button>
            </div>
          </div>
          <div className="mt-3 max-h-[20rem] overflow-auto rounded-[14px] bg-white px-4 py-3">
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {transcriptPreview}
            </p>
          </div>
          {isTranscriptTruncated ? (
            <p className="mt-3 text-xs text-slate-500">
              Showing a preview to keep History fast. Use Copy full to grab the complete transcript.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});

export type HistorySurfaceProps = {
  isActive: boolean;
  activeWorkspaceId: string | null;
  activeWorkspace: ActiveWorkspaceDetails | null;
  initialProjectFilter: string;
  statusOptions: Array<{ id: string; label: string }>;
  templateOptions: Array<{ id: string; label: string }>;
  projects: Project[];
  onAssignProject: (transcriptionId: string, projectId: string) => Promise<boolean>;
  onProcess: (transcriptionId: string, template?: string | null) => void;
  onDelete: (transcriptionId: string) => Promise<void>;
};

export const HistorySurface = memo(function HistorySurface({
  isActive,
  activeWorkspaceId,
  activeWorkspace,
  initialProjectFilter,
  statusOptions,
  templateOptions,
  projects,
  onAssignProject,
  onProcess,
  onDelete,
}: HistorySurfaceProps) {
  const historyRequestAbortRef = useRef<AbortController | null>(null);
  const historyInputActiveRef = useRef(false);
  const initialHistoryLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [historyItems, setHistoryItems] = useState<Transcription[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [initialHistoryLoaded, setInitialHistoryLoaded] = useState(false);
  const [visibleHistoryLimit, setVisibleHistoryLimit] = useState(12);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");
  const [historyTemplateFilter, setHistoryTemplateFilter] = useState("all");
  const [historyProjectFilter, setHistoryProjectFilter] = useState(initialProjectFilter);

  useEffect(() => {
    setHistoryProjectFilter(initialProjectFilter || "all");
  }, [initialProjectFilter]);

  const pinnedProjectFilter = initialProjectFilter !== "all" ? initialProjectFilter : "all";
  const activeWorkspaceLabel = activeWorkspace
    ? `${activeWorkspace.name}${activeWorkspace.isPersonal ? " (Personal)" : ""}`
    : "this workspace";
  const hasActiveFilters =
    historySearchQuery.trim().length > 0 ||
    historyStatusFilter !== "all" ||
    historyTemplateFilter !== "all" ||
    historyProjectFilter !== pinnedProjectFilter;

  const visibleHistoryItems = useMemo(
    () => historyItems.slice(0, visibleHistoryLimit),
    [historyItems, visibleHistoryLimit],
  );
  const hasMoreHistoryItems = historyItems.length > visibleHistoryLimit;
  const isRefreshingHistory = historyLoading && historyItems.length > 0;
  const searchDisabled = isActive && !initialHistoryLoaded;

  const cancelHistoryLoadForInput = useCallback(() => {
    historyInputActiveRef.current = true;
    if (initialHistoryLoadTimeoutRef.current) {
      clearTimeout(initialHistoryLoadTimeoutRef.current);
      initialHistoryLoadTimeoutRef.current = null;
    }
    if (historyRequestAbortRef.current) {
      historyRequestAbortRef.current.abort();
      historyRequestAbortRef.current = null;
    }
    startTransition(() => {
      setHistoryLoading(false);
    });
  }, []);

  const loadHistoryItems = useCallback(async () => {
    if (!isActive || !activeWorkspaceId) {
      return;
    }

    const trimmedQuery = historySearchQuery.trim();
    const cacheKey = buildHistoryCacheKey({
      workspaceId: "all",
      query: trimmedQuery,
      status: historyStatusFilter,
      template: historyTemplateFilter,
      projectId: historyProjectFilter,
    });
    const cachedItems = readSessionCache<Transcription[]>(cacheKey);
    if (cachedItems) {
      startTransition(() => {
        setHistoryItems(cachedItems);
        setVisibleHistoryLimit(12);
        setInitialHistoryLoaded(true);
        setHistoryLoading(false);
      });
      return;
    }

    if (historyRequestAbortRef.current) {
      historyRequestAbortRef.current.abort();
    }
    const abortController = new AbortController();
    historyRequestAbortRef.current = abortController;
    startTransition(() => {
      setHistoryLoading(true);
    });

    try {
      const params = new URLSearchParams();
      params.set("limit", "24");
      params.set("allWorkspaces", "true");
      if (trimmedQuery) {
        params.set("q", trimmedQuery);
        params.set("searchScope", "name");
      }
      if (historyStatusFilter !== "all") {
        params.set("status", historyStatusFilter);
      }
      if (historyTemplateFilter !== "all") {
        params.set("template", historyTemplateFilter);
      }
      if (historyProjectFilter !== "all") {
        params.set("projectId", historyProjectFilter);
      }

      const queryString = params.toString();
      const response = await fetch(
        queryString ? `/api/transcriptions?${queryString}` : "/api/transcriptions",
        { signal: abortController.signal },
      );
      const payload = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load history");
      }

      if (historyRequestAbortRef.current !== abortController) {
        return;
      }
      if (historyInputActiveRef.current && !historySearchQuery.trim()) {
        return;
      }

      const nextItems = [...(payload.items || [])].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      writeSessionCache(cacheKey, nextItems);
      startTransition(() => {
        setHistoryItems(nextItems);
        setVisibleHistoryLimit(12);
        setInitialHistoryLoaded(true);
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      startTransition(() => {
        setHistoryItems([]);
        setVisibleHistoryLimit(12);
        setInitialHistoryLoaded(true);
      });
    } finally {
      if (historyRequestAbortRef.current === abortController) {
        historyRequestAbortRef.current = null;
      }
      startTransition(() => {
        setHistoryLoading(false);
      });
    }
  }, [
    historySearchQuery,
    historyProjectFilter,
    historyStatusFilter,
    historyTemplateFilter,
    activeWorkspaceId,
    isActive,
  ]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    if (initialHistoryLoadTimeoutRef.current) {
      clearTimeout(initialHistoryLoadTimeoutRef.current);
    }

    initialHistoryLoadTimeoutRef.current = setTimeout(() => {
      historyInputActiveRef.current = false;
      void loadHistoryItems();
    }, historySearchQuery.trim() ? 0 : 350);

    return () => {
      if (initialHistoryLoadTimeoutRef.current) {
        clearTimeout(initialHistoryLoadTimeoutRef.current);
        initialHistoryLoadTimeoutRef.current = null;
      }
    };
  }, [historySearchQuery, isActive, loadHistoryItems]);

  useEffect(() => {
    return () => {
      if (historyRequestAbortRef.current) {
        historyRequestAbortRef.current.abort();
      }
      if (initialHistoryLoadTimeoutRef.current) {
        clearTimeout(initialHistoryLoadTimeoutRef.current);
      }
    };
  }, []);

  function clearHistoryFilters() {
    startTransition(() => {
      setHistorySearchQuery("");
      setHistoryStatusFilter("all");
      setHistoryTemplateFilter("all");
      setHistoryProjectFilter(pinnedProjectFilter);
      setVisibleHistoryLimit(12);
    });
  }

  async function handleHistoryAssignProject(transcriptionId: string, projectId: string) {
    const saved = await onAssignProject(transcriptionId, projectId);
    if (saved) {
      const nextProjectId = projectId === "none" ? null : projectId;
      setHistoryItems((prev) =>
        prev.map((item) =>
          item.id === transcriptionId ? { ...item, projectId: nextProjectId } : item,
        ),
      );
    }
    return saved;
  }

  async function handleHistoryDelete(transcriptionId: string) {
    await onDelete(transcriptionId);
    setHistoryItems((prev) => prev.filter((item) => item.id !== transcriptionId));
  }

  return (
    <section
      id="transcriptions"
      className={`rounded-[30px] border border-white/80 bg-white/88 p-8 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)] ${
        isActive ? "" : "hidden"
      }`}
      style={{ contain: "layout paint style" }}
    >
      <div className="border-b border-slate-200 pb-4" style={{ contain: "layout paint" }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Your Recordings</h2>
            <p className="mt-1 text-sm text-slate-500">
              Search recordings and narrow the list with quick filters.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearHistoryFilters}
                className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-[#f8f5ef] active:scale-95"
              >
                Clear Filters
              </button>
            ) : null}
            {isRefreshingHistory ? (
              <span className="rounded-full border border-slate-200 bg-[#fcfbf8] px-4 py-2 text-sm font-semibold text-slate-500">
                Updating...
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => void loadHistoryItems()}
              className="cursor-pointer rounded-full border border-slate-200 bg-[#fcfbf8] px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-[#f5f1ea] active:scale-95"
            >
              Refresh
            </button>
          </div>
        </div>

        <HistoryFilters
          initialSearchQuery={historySearchQuery}
          statusFilter={historyStatusFilter}
          templateFilter={historyTemplateFilter}
          projectFilter={historyProjectFilter}
          statusOptions={statusOptions}
          templateOptions={templateOptions}
          projects={projects}
          searchDisabled={searchDisabled}
          onSearchCommit={setHistorySearchQuery}
          onSearchInputStart={cancelHistoryLoadForInput}
          onStatusChange={setHistoryStatusFilter}
          onTemplateChange={setHistoryTemplateFilter}
          onProjectChange={setHistoryProjectFilter}
        />
      </div>

      {!initialHistoryLoaded || (historyLoading && historyItems.length === 0) ? (
        <p className="mt-6 text-center text-sm text-slate-400">
          Loading history for {activeWorkspaceLabel}...
        </p>
      ) : historyItems.length === 0 ? (
        <div className="mt-6 rounded-[22px] border border-dashed border-slate-200 bg-[#fcfbf8] px-6 py-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
            <svg
              className="h-7 w-7 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="mt-4 text-base font-semibold text-slate-700">
            {hasActiveFilters ? "No matching history" : "No history yet"}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {hasActiveFilters
              ? "Try clearing a filter or searching with a broader phrase."
              : `Upload a recording above to get started in ${activeWorkspaceLabel}.`}
          </p>
          {hasActiveFilters ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={clearHistoryFilters}
                className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Clear Filters
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-6 space-y-4" style={{ contentVisibility: "auto" }}>
          {visibleHistoryItems.map((item) => (
            <HistoryRow
              key={item.id}
              item={item}
              projects={projects}
              onAssignProject={handleHistoryAssignProject}
              onProcess={onProcess}
              onDelete={handleHistoryDelete}
            />
          ))}
          {hasMoreHistoryItems ? (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() =>
                  startTransition(() => {
                    setVisibleHistoryLimit((prev) => prev + 24);
                  })
                }
                className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-[#f8f5ef] active:scale-95"
              >
                Show more history
              </button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
});
