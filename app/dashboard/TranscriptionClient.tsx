"use client";

import {
  lazy,
  memo,
  Suspense,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
  useId,
  useRef,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import type { BillingInfo, BillingResponse } from "@/lib/billing-types";
import { HistorySurface } from "./HistorySurface";
import type { HistorySurfaceProps } from "./HistorySurface";
// OperationsSurface — lazy-loaded (only needed when user visits operations/tasks)
const OperationsActivitySurface = lazy(() =>
  import("./OperationsSurface").then((m) => ({ default: m.OperationsActivitySurface })),
);
const WorkspaceTasksSurface = lazy(() =>
  import("./OperationsSurface").then((m) => ({ default: m.WorkspaceTasksSurface })),
);
import type {
  OperationsActivitySurfaceProps,
  WorkspaceTasksSurfaceProps,
} from "./OperationsSurface";
import { OverviewSurface, UploadPanelBody } from "./OverviewSurface";
import type {
  OverviewCurrentRecordingProps,
  UploadPanelBodyProps,
} from "./OverviewSurface";
// IntelligenceSurface — lazy-loaded (large module, only needed on intelligence surface)
const ProjectDigestPanel = lazy(() =>
  import("./IntelligenceSurface").then((m) => ({ default: m.ProjectDigestPanel })),
);
const SavedInsightsPanel = lazy(() =>
  import("./IntelligenceSurface").then((m) => ({ default: m.SavedInsightsPanel })),
);
import type { SavedInsightsPanelProps } from "./IntelligenceSurface";
// SettingsSurface sections — lazy-loaded (rarely visited, large forms)
const AccessSettingsSection = lazy(() =>
  import("./SettingsSurface").then((m) => ({ default: m.AccessSettingsSection })),
);
const DeliverySettingsSection = lazy(() =>
  import("./SettingsSurface").then((m) => ({ default: m.DeliverySettingsSection })),
);
const IntegrationSettingsSection = lazy(() =>
  import("./SettingsSurface").then((m) => ({ default: m.IntegrationSettingsSection })),
);
const PersonalSettingsSection = lazy(() =>
  import("./SettingsSurface").then((m) => ({ default: m.PersonalSettingsSection })),
);
const WorkspaceSettingsSection = lazy(() =>
  import("./SettingsSurface").then((m) => ({ default: m.WorkspaceSettingsSection })),
);
import {
  SettingsSurfaceNav,
} from "./SettingsSurface";
import type { SettingsSection, SettingsSectionMeta } from "./SettingsSurface";

export type ActionItem = {
  text: string;
  priority?: string;
  assignee?: string;
};

export type ActionTask = {
  id: string;
  transcriptionId: string;
  title: string;
  status: "open" | "in_progress" | "done";
  priority: "LOW" | "MEDIUM" | "HIGH";
  assignee?: string | null;
  dueDate?: string | null;
  sourceActionIndex?: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  transcription?: {
    id: string;
    fileName: string;
    status: string;
  };
};

export type Transcription = {
  id: string;
  fileName: string;
  status: string;
  template?: string | null;
  projectId?: string | null;
  createdAt: string;
  updatedAt: string;
  duration?: number | null;
  transcript?: string | null;
  decisions?: string[];
  keyPoints?: string[];
  nextSteps?: string[];
  actionItems?: ActionItem[];
};

type ApiResponse = {
  ok?: boolean;
  items?: Transcription[];
  total?: number;
  nextCursor?: string | null;
  error?: string;
};

const DASHBOARD_CACHE_TTL_MS = 60_000;
const TRANSCRIPTIONS_CACHE_PREFIX = "voxly:dashboard:transcriptions:";
const HISTORY_CACHE_PREFIX = "voxly:dashboard:history:";
const PROJECTS_CACHE_KEY = "voxly:dashboard:projects";
const BILLING_CACHE_KEY = "voxly:dashboard:billing";
const TEMPLATES_CACHE_KEY = "voxly:dashboard:templates";
const WORKSPACES_CACHE_KEY = "voxly:dashboard:workspaces";
const WORKSPACE_DIGEST_CACHE_KEY = "voxly:dashboard:workspace-digest";
const REPORT_TEMPLATES_CACHE_KEY = "voxly:dashboard:report-templates";
const WORKSPACE_SLACK_CACHE_KEY = "voxly:dashboard:workspace-slack";
const WORKSPACE_SLACK_DESTINATIONS_CACHE_KEY =
  "voxly:dashboard:workspace-slack-destinations";
const NOTIFICATION_PREFERENCES_CACHE_KEY =
  "voxly:dashboard:notification-preferences";
const WORKSPACE_NOTION_CACHE_KEY = "voxly:dashboard:workspace-notion";
const WORKSPACE_PEOPLE_CACHE_KEY = "voxly:dashboard:workspace-people";
const WORKSPACE_ACTIVITY_CACHE_KEY = "voxly:dashboard:workspace-activity";
const WORKSPACE_TASKS_CACHE_KEY = "voxly:dashboard:workspace-tasks";
const DELETED_WORKSPACE_TOMBSTONE_KEY = "voxly:dashboard:deleted-workspace";

const dashboardMemoryCache = new Map<string, SessionCacheEntry<unknown>>();

type SessionCacheEntry<T> = {
  savedAt: number;
  value: T;
};

type DeletedWorkspaceTombstone = {
  id: string;
  name: string;
  deletedAt: number;
};

function readSessionCache<T>(key: string): T | null {
  const memoryEntry = dashboardMemoryCache.get(key) as SessionCacheEntry<T> | undefined;
  if (memoryEntry?.savedAt && Date.now() - memoryEntry.savedAt <= DASHBOARD_CACHE_TTL_MS) {
    return memoryEntry.value;
  }
  if (memoryEntry) {
    dashboardMemoryCache.delete(key);
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
      dashboardMemoryCache.delete(key);
      return null;
    }

    dashboardMemoryCache.set(key, entry as SessionCacheEntry<unknown>);
    return entry.value;
  } catch {
    window.sessionStorage.removeItem(key);
    dashboardMemoryCache.delete(key);
    return null;
  }
}

function writeSessionCache<T>(key: string, value: T) {
  dashboardMemoryCache.set(key, { savedAt: Date.now(), value });

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

function readDeletedWorkspaceTombstone() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(DELETED_WORKSPACE_TOMBSTONE_KEY);
    if (!rawValue) {
      return null;
    }

    const tombstone = JSON.parse(rawValue) as DeletedWorkspaceTombstone;
    return tombstone?.id && tombstone?.name ? tombstone : null;
  } catch {
    window.sessionStorage.removeItem(DELETED_WORKSPACE_TOMBSTONE_KEY);
    return null;
  }
}

function writeDeletedWorkspaceTombstone(tombstone: DeletedWorkspaceTombstone) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      DELETED_WORKSPACE_TOMBSTONE_KEY,
      JSON.stringify(tombstone),
    );
  } catch {
    // Ignore storage write failures; the in-memory mask still applies.
  }
}

function clearDeletedWorkspaceTombstone() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(DELETED_WORKSPACE_TOMBSTONE_KEY);
}

function isInsufficientCreditsError(message: string | null) {
  if (!message) {
    return false;
  }

  return (
    message.includes("does not have enough remaining credits") ||
    message.includes("not have enough remaining credits")
  );
}

function useStableCallback<T extends (...args: never[]) => unknown>(callback: T): T {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const stableCallback = useCallback((...args: Parameters<T>) => {
    return callbackRef.current(...args);
  }, []);

  return stableCallback as T;
}

function clearSessionCacheKey(key: string) {
  dashboardMemoryCache.delete(key);
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(key);
}

function clearSessionCachePrefix(prefix: string) {
  for (const key of dashboardMemoryCache.keys()) {
    if (key.startsWith(prefix)) {
      dashboardMemoryCache.delete(key);
    }
  }

  if (typeof window === "undefined") {
    return;
  }

  for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = window.sessionStorage.key(index);
    if (key?.startsWith(prefix)) {
      window.sessionStorage.removeItem(key);
    }
  }
}

function buildScopedCacheKey(baseKey: string, workspaceId?: string | null) {
  return `${baseKey}:${workspaceId || "pending"}`;
}

function clearScopedCache(baseKey: string, workspaceId?: string | null) {
  if (workspaceId) {
    clearSessionCacheKey(buildScopedCacheKey(baseKey, workspaceId));
    return;
  }

  clearSessionCachePrefix(`${baseKey}:`);
}

function clearTranscriptionCaches() {
  clearSessionCachePrefix(TRANSCRIPTIONS_CACHE_PREFIX);
  clearSessionCachePrefix(HISTORY_CACHE_PREFIX);
}

function clearWorkspaceAdminCaches() {
  clearSessionCacheKey(WORKSPACES_CACHE_KEY);
  clearScopedCache(WORKSPACE_DIGEST_CACHE_KEY);
  clearScopedCache(REPORT_TEMPLATES_CACHE_KEY);
  clearScopedCache(WORKSPACE_SLACK_CACHE_KEY);
  clearScopedCache(WORKSPACE_SLACK_DESTINATIONS_CACHE_KEY);
  clearScopedCache(WORKSPACE_NOTION_CACHE_KEY);
  clearScopedCache(WORKSPACE_PEOPLE_CACHE_KEY);
  clearScopedCache(WORKSPACE_ACTIVITY_CACHE_KEY);
  clearScopedCache(WORKSPACE_TASKS_CACHE_KEY);
}

function buildTranscriptionsCacheKey(input: {
  workspaceId?: string | null;
  query: string;
  status: string;
  template: string;
  projectId: string;
}) {
  return `${TRANSCRIPTIONS_CACHE_PREFIX}${encodeURIComponent(JSON.stringify(input))}`;
}

type SummaryTemplate = {
  id: string;
  name: string;
  slug: string;
  baseTemplate: string;
  promptInstructions: string;
  createdAt: string;
  updatedAt: string;
};

type TemplatesResponse = {
  ok?: boolean;
  templates?: SummaryTemplate[];
  template?: SummaryTemplate;
  error?: string;
};

export type Project = {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProjectsResponse = {
  ok?: boolean;
  projects?: Project[];
  project?: Project;
  error?: string;
};

type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  isPersonal: boolean;
  role: string;
};

export type ActiveWorkspaceDetails = {
  id: string;
  name: string;
  slug: string;
  isPersonal: boolean;
  createdAt: string;
  role: string;
  canManage: boolean;
  memberCount: number;
  owner: {
    id: string;
    email: string;
    name?: string | null;
  };
};

type WorkspacesResponse = {
  ok?: boolean;
  currentUser?: {
    id: string;
    email: string;
    name?: string | null;
  };
  activeWorkspaceId?: string;
  activeWorkspace?: ActiveWorkspaceDetails | null;
  workspaces?: WorkspaceSummary[];
  workspace?: ActiveWorkspaceDetails;
  error?: string;
};

export type WorkspaceMemberEntry = {
  id: string;
  role: string;
  status: string;
  joinedAt?: string | null;
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
};

export type WorkspaceInviteEntry = {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  updatedAt?: string;
};

type WorkspaceMembersResponse = {
  ok?: boolean;
  members?: WorkspaceMemberEntry[];
  error?: string;
};

type WorkspaceInvitesResponse = {
  ok?: boolean;
  invites?: WorkspaceInviteEntry[];
  invite?: WorkspaceInviteEntry;
  error?: string;
};

export type WorkspaceActivityEntry = {
  id: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  actorUser?: {
    id: string;
    email: string;
    name?: string | null;
  } | null;
};

type WorkspaceActivityResponse = {
  ok?: boolean;
  activity?: WorkspaceActivityEntry[];
  error?: string;
};

type TasksResponse = {
  ok?: boolean;
  tasks?: ActionTask[];
  task?: ActionTask;
  error?: string;
};

export type WorkspaceComment = {
  id: string;
  content: string;
  mentions?: Array<{
    email: string;
    name?: string | null;
  }> | null;
  transcriptionId?: string | null;
  actionTaskId?: string | null;
  projectInsightId?: string | null;
  workspaceInsightId?: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
};

type CommentsResponse = {
  ok?: boolean;
  comments?: WorkspaceComment[];
  comment?: WorkspaceComment;
  error?: string;
};

export type WorkspaceNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  metadata?: Record<string, unknown> | null;
  readAt?: string | null;
  createdAt: string;
};

type NotificationsResponse = {
  ok?: boolean;
  notifications?: WorkspaceNotification[];
  error?: string;
};

export type ProjectIntelligenceSource = {
  sourceId: string;
  transcriptionId: string;
  fileName: string;
  excerpt: string;
};

type ProjectIntelligenceResponse = {
  ok?: boolean;
  answer?: string;
  confidenceNote?: string;
  sources?: ProjectIntelligenceSource[];
  coverage?: {
    transcriptCount: number;
    chunkCount: number;
    projectCount?: number | null;
  };
  error?: string;
};

export type SavedProjectInsight = {
  id: string;
  title: string;
  question: string;
  answer: string;
  confidenceNote?: string | null;
  isPinned?: boolean;
  archivedAt?: string | null;
  sources: ProjectIntelligenceSource[];
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    email: string;
    name?: string | null;
  };
};

type ProjectInsightsResponse = {
  ok?: boolean;
  insights?: SavedProjectInsight[];
  insight?: SavedProjectInsight;
  error?: string;
};

export type SavedWorkspaceInsight = {
  id: string;
  title: string;
  question: string;
  answer: string;
  confidenceNote?: string | null;
  isPinned?: boolean;
  archivedAt?: string | null;
  projectIds?: string[] | null;
  sources: ProjectIntelligenceSource[];
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    email: string;
    name?: string | null;
  };
};

type WorkspaceInsightsResponse = {
  ok?: boolean;
  insights?: SavedWorkspaceInsight[];
  insight?: SavedWorkspaceInsight;
  error?: string;
};

export type RecurringReportTemplate = {
  id: string;
  name: string;
  targetScope: "workspace" | "project";
  cadence: "weekly" | "monthly";
  reportType: "summary" | "new_insights" | "open_tasks" | "risk_watch";
  weekday: number;
  dayOfMonth: number;
  hourLocal: number;
  timezone: string;
  recipientScope: "managers" | "all_members";
  sendEmail: boolean;
  sendSlack: boolean;
  slackDestinationId?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    email: string;
    name?: string | null;
  };
};

type ReportTemplatesResponse = {
  ok?: boolean;
  templates?: RecurringReportTemplate[];
  template?: RecurringReportTemplate;
  error?: string;
};

export type WorkspaceDigestSettings = {
  id: string;
  workspaceId: string;
  enabled: boolean;
  cadence: "weekly" | "monthly";
  reportType: "summary" | "new_insights" | "open_tasks" | "risk_watch";
  weekday: number;
  dayOfMonth: number;
  hourLocal: number;
  timezone: string;
  recipientScope: string;
  sendEmail: boolean;
  sendSlack: boolean;
  slackDestinationId?: string | null;
  lastSentAt?: string | null;
  createdAt: string;
  updatedAt: string;
  scheduleLabel: string;
  nextRunAt?: string | null;
};

type WorkspaceDigestResponse = {
  ok?: boolean;
  settings?: WorkspaceDigestSettings;
  result?: {
    recipientCount: number;
    emailRecipientCount?: number;
    slackDelivered?: boolean;
    openTasks: number;
    workspaceInsightCount: number;
    projectInsightCount: number;
  };
  error?: string;
};

export type ProjectDigestSettings = {
  id: string;
  projectId: string;
  enabled: boolean;
  cadence: "weekly" | "monthly";
  reportType: "summary" | "new_insights" | "open_tasks" | "risk_watch";
  weekday: number;
  dayOfMonth: number;
  hourLocal: number;
  timezone: string;
  recipientScope: string;
  sendEmail: boolean;
  sendSlack: boolean;
  slackDestinationId?: string | null;
  lastSentAt?: string | null;
  createdAt: string;
  updatedAt: string;
  scheduleLabel: string;
  nextRunAt?: string | null;
};

type ProjectDigestResponse = {
  ok?: boolean;
  settings?: ProjectDigestSettings;
  result?: {
    recipientCount: number;
    emailRecipientCount?: number;
    slackDelivered?: boolean;
    insightCount: number;
    openTasks: number;
    transcriptCount: number;
  };
  error?: string;
};

export type WorkspaceSlackSettings = {
  configured: boolean;
  enabled: boolean;
  sendDigests: boolean;
  maskedWebhook?: string | null;
  updatedAt?: string | null;
};

type WorkspaceSlackResponse = {
  ok?: boolean;
  settings?: WorkspaceSlackSettings;
  error?: string;
};

export type WorkspaceSlackDestination = {
  id: string;
  workspaceId: string;
  name: string;
  maskedWebhook?: string | null;
  createdAt: string;
  updatedAt: string;
};

type WorkspaceSlackDestinationsResponse = {
  ok?: boolean;
  destinations?: WorkspaceSlackDestination[];
  destination?: WorkspaceSlackDestination;
  error?: string;
};

export type RecurringReportRun = {
  id: string;
  scope: "workspace" | "project";
  trigger: string;
  cadence: string;
  reportType: string;
  recipientScope: string;
  sendEmail: boolean;
  sendSlack: boolean;
  emailRecipientCount: number;
  slackDelivered: boolean;
  status: string;
  summary: string;
  metadata?: {
    error?: string;
  } | null;
  createdAt: string;
  project?: {
    id: string;
    name: string;
  } | null;
};

type ReportRunsResponse = {
  ok?: boolean;
  runs?: RecurringReportRun[];
  result?: {
    recipientCount: number;
    emailRecipientCount?: number;
    slackDelivered?: boolean;
  };
  error?: string;
};

export type ReportRunSummary = {
  days: number;
  totalRuns: number;
  successCount: number;
  failedCount: number;
  successRate: number;
  workspaceRuns: number;
  projectRuns: number;
  manualRuns: number;
  scheduledRuns: number;
  emailRuns: number;
  slackRuns: number;
  slackDeliveredCount: number;
  emailRecipientCount: number;
  topReportType?: string | null;
};

type ReportRunSummaryResponse = {
  ok?: boolean;
  summary?: ReportRunSummary;
  error?: string;
};

export type UserNotificationPreferences = {
  id: string;
  userId: string;
  mentionEmailEnabled: boolean;
  mentionInAppEnabled: boolean;
  digestEmailEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type UserNotificationPreferencesResponse = {
  ok?: boolean;
  preferences?: UserNotificationPreferences;
  error?: string;
};

export type WorkspaceNotionSettings = {
  configured: boolean;
  enabled: boolean;
  maskedToken?: string | null;
  parentPageId?: string | null;
  updatedAt?: string | null;
  lastSyncedAt?: string | null;
};

type WorkspaceNotionResponse = {
  ok?: boolean;
  settings?: WorkspaceNotionSettings;
  result?: {
    pageId?: string;
    url?: string | null;
  };
  error?: string;
};

type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

type AssistantScope = "transcript" | "project" | "workspace";
type DashboardSurface = "overview" | "upload" | "transcriptions" | "intelligence" | "operations" | "settings";

const defaultAssistantMessages: AssistantMessage[] = [
  {
    role: "assistant",
    content: "Hi! I can edit these notes or answer questions about them.",
  },
];

function formatIntelligenceAssistantReply(
  payload: ProjectIntelligenceResponse,
): string {
  const parts: string[] = [];

  if (payload.answer?.trim()) {
    parts.push(payload.answer.trim());
  }

  if (payload.confidenceNote?.trim()) {
    parts.push(`Confidence note: ${payload.confidenceNote.trim()}`);
  }

  if (payload.sources?.length) {
    parts.push(
      `Sources:\n${payload.sources
        .slice(0, 4)
        .map((source) => `- ${source.fileName}: ${source.excerpt}`)
        .join("\n")}`,
    );
  }

  return parts.join("\n\n").trim() || "(No reply)";
}

const builtInTemplates = [
  { id: "default", label: "Default Template (Default)" },
  { id: "brainstorm", label: "Brainstorm Session" },
  { id: "interview", label: "Interview Notes" },
  { id: "lecture", label: "Lecture Notes" },
  { id: "voice-memo", label: "Voice Memo Notes" },
];

type AssistantRailProps = {
  projects: Project[];
  activeWorkspace: ActiveWorkspaceDetails | null;
  assistantBusy: boolean;
  assistantRefreshing: boolean;
  assistantHistoryLoading: boolean;
  assistantError: string | null;
  assistantMessages: AssistantMessage[];
  hasProcessedSummary: boolean;
  initialScope: AssistantScope;
  initialProjectId: string;
  initialWorkspaceProjectIds: string[];
  suggestions: Record<AssistantScope, string[]>;
  onRefresh: () => void;
  onSubmit: (input: {
    text: string;
    scope: AssistantScope;
    projectId: string;
    workspaceProjectIds: string[];
  }) => void;
};

const AssistantRail = memo(function AssistantRail({
  projects,
  activeWorkspace,
  assistantBusy,
  assistantRefreshing,
  assistantHistoryLoading,
  assistantError,
  assistantMessages,
  hasProcessedSummary,
  initialScope,
  initialProjectId,
  initialWorkspaceProjectIds,
  suggestions,
  onRefresh,
  onSubmit,
}: AssistantRailProps) {
  const assistantInputRef = useRef<HTMLInputElement | null>(null);
  const [localScope, setLocalScope] = useState<AssistantScope>(initialScope);
  const [localProjectId, setLocalProjectId] = useState(initialProjectId);
  const [localWorkspaceProjectIds, setLocalWorkspaceProjectIds] = useState<string[]>(
    initialWorkspaceProjectIds,
  );
  const [localPrompt, setLocalPrompt] = useState("");

  useEffect(() => {
    setLocalScope(initialScope);
  }, [initialScope]);

  useEffect(() => {
    setLocalProjectId(initialProjectId);
  }, [initialProjectId]);

  useEffect(() => {
    setLocalWorkspaceProjectIds(initialWorkspaceProjectIds);
  }, [initialWorkspaceProjectIds]);

  const canSubmit =
    !assistantBusy &&
    !(
      localScope === "transcript" &&
      !hasProcessedSummary
    );

  function submitPrompt(textOverride?: string) {
    const text = (textOverride ?? localPrompt).trim();
    if (!text) {
      return;
    }

    onSubmit({
      text,
      scope: localScope,
      projectId: localProjectId,
      workspaceProjectIds: localWorkspaceProjectIds,
    });
    setLocalPrompt("");
  }

  function handleSuggestion(text: string) {
    setLocalPrompt(text);
    submitPrompt(text);
    requestAnimationFrame(() => assistantInputRef.current?.focus());
  }

  function toggleWorkspaceProject(projectId: string) {
    setLocalWorkspaceProjectIds((prev) =>
      prev.includes(projectId)
        ? prev.filter((entry) => entry !== projectId)
        : [...prev, projectId],
    );
  }

  const activeWorkspaceLabel = activeWorkspace
    ? `${activeWorkspace.name}${activeWorkspace.isPersonal ? " (Personal)" : ""}`
    : "No workspace selected";

  return (
    <section className="flex h-full flex-col gap-4 rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.28)]">
      <div className="rounded-[24px] border border-slate-200 bg-[#fafaf7] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-sm font-semibold text-slate-900">Voxly Tab</span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={
              localScope === "transcript" &&
              (assistantRefreshing || assistantHistoryLoading)
            }
            className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {localScope === "transcript"
              ? assistantRefreshing || assistantHistoryLoading
                ? "Refreshing..."
                : "Refresh"
              : "Clear"}
          </button>
        </div>
      </div>

      <div className="flex min-h-[420px] flex-1 flex-col rounded-[24px] border border-slate-200 bg-[#fafaf7] p-4">
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-orange-700">
              AI Assistant
            </p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">
              {localScope === "transcript"
                ? "Ask Voxly to refine the notes"
                : localScope === "project"
                  ? "Ask across this project"
                  : "Ask across the workspace"}
            </h3>
            <p className="mt-2 max-w-[18rem] truncate text-xs font-semibold text-slate-500">
              Current workspace:{" "}
              <span className="text-slate-800">{activeWorkspaceLabel}</span>
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {([
                ["transcript", "Transcript"],
                ["project", "Project"],
                ["workspace", "Workspace"],
              ] as const).map(([scopeId, label]) => (
                <button
                  key={scopeId}
                  type="button"
                  onClick={() => {
                    setLocalScope(scopeId);
                    setLocalPrompt("");
                  }}
                  className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                    localScope === scopeId
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {localScope === "project" ? (
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Project scope
                </span>
                <select
                  value={localProjectId}
                  onChange={(event) => setLocalProjectId(event.target.value)}
                  className="mt-2 w-full cursor-pointer rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none"
                >
                  <option value="all">Choose a project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {localScope === "workspace" ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Narrow to projects
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {projects.length ? (
                    projects.map((project) => {
                      const selected = localWorkspaceProjectIds.includes(project.id);
                      return (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => toggleWorkspaceProject(project.id)}
                          className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold ${
                            selected
                              ? "border-sky-200 bg-sky-50 text-sky-700"
                              : "border-slate-200 bg-white text-slate-700"
                          }`}
                        >
                          {project.name}
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-500">
                      Create a project to narrow workspace answers.
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex items-start gap-3 rounded-[24px] border border-orange-200 bg-[#fff4ec] p-4 shadow-sm">
              <span className="text-2xl">🤖</span>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {localScope === "transcript"
                    ? "How can I help with these notes?"
                    : localScope === "project"
                      ? "What should Voxly find across this project?"
                      : "What should Voxly synthesize across the workspace?"}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  {localScope === "transcript"
                    ? "I can directly edit your notes – add key points, update action items, change priorities, and more."
                    : "I can search across multiple transcripts, synthesize themes, and answer with grounded sources."}
                </p>
              </div>
            </div>

            {(localScope !== "transcript" || hasProcessedSummary) ? (
              <div className="mt-4 space-y-2">
                {suggestions[localScope].map((text) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => handleSuggestion(text)}
                    className="cursor-pointer w-full rounded-[20px] border border-slate-200 bg-[#fffdf9] px-4 py-3 text-left text-xs font-medium text-slate-700 shadow-sm transition-all hover:border-orange-300 hover:bg-[#fff4ec] hover:shadow-md active:scale-98"
                  >
                    {text}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-[20px] border border-dashed border-slate-200 bg-[#fcfbf8] px-4 py-4 text-xs leading-relaxed text-slate-500">
                Prompts will appear here after Start Voxly finishes and the
                recording has been processed.
              </div>
            )}

            {assistantMessages.length > 0 && (
              <div className="mt-4 space-y-4">
                {assistantMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {message.role === "assistant" && (
                      <div className="mr-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#f97316] shadow-md">
                        <span className="text-sm">🤖</span>
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                        message.role === "user"
                          ? "bg-slate-950 text-white"
                          : "border border-slate-200 bg-[#fffdf9] text-slate-800 shadow-slate-200"
                      }`}
                    >
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => (
                            <p className="text-sm leading-relaxed mb-2 last:mb-0 text-inherit">
                              {children}
                            </p>
                          ),
                          ul: ({ children }) => (
                            <ul className="text-sm leading-relaxed list-disc ml-4 mb-2 last:mb-0 text-inherit">
                              {children}
                            </ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="text-sm leading-relaxed list-decimal ml-4 mb-2 last:mb-0 text-inherit">
                              {children}
                            </ol>
                          ),
                          li: ({ children }) => (
                            <li className="text-sm leading-relaxed text-inherit">
                              {children}
                            </li>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-bold text-inherit">
                              {children}
                            </strong>
                          ),
                          em: ({ children }) => (
                            <em className="italic text-inherit">{children}</em>
                          ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                    {message.role === "user" && (
                      <div className="ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 shadow-md">
                        <span className="text-sm">👤</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
          <div className="flex items-center gap-2">
            <input
              placeholder={
                localScope === "transcript"
                  ? "Ask me to edit your notes..."
                  : localScope === "project"
                    ? "Ask across this project..."
                    : "Ask across the workspace..."
              }
              ref={assistantInputRef}
              value={localPrompt}
              disabled={!canSubmit}
              onChange={(event) => setLocalPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitPrompt();
                }
              }}
              className="flex-1 rounded-full border border-slate-200 bg-[#fcfbf8] px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none transition-all focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => submitPrompt()}
              disabled={!canSubmit}
              className="cursor-pointer rounded-full bg-[#f97316] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#ea580c] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Send
            </button>
          </div>
          {assistantError && <p className="text-xs text-red-600">{assistantError}</p>}
          {assistantHistoryLoading ? (
            <p className="text-xs text-slate-500">Loading notes history...</p>
          ) : null}
          <p className="text-xs leading-relaxed text-slate-500">
            {localScope === "transcript"
              ? hasProcessedSummary
                ? "Ready to help. Choose a suggestion or type your own request."
                : "Process a recording to unlock prompts and assistant edits."
              : localScope === "project"
                ? "Project answers use grounded retrieval across recordings in the selected project."
                : "Workspace answers search across your workspace, or just the projects you select above."}
          </p>
        </div>
      </div>
    </section>
  );
});

// ─── Comments state reducer ──────────────────────────────────────────────────
// Consolidates the four per-entity-type comment maps into a single keyed map.
// All entity IDs (transcription, task, project insight, workspace insight) are
// globally unique, so one map keyed by entityId covers all cases.

type CommentsAction =
  | { type: "SET"; entityId: string; comments: WorkspaceComment[] }
  | { type: "UPDATE"; commentId: string; next: WorkspaceComment }
  | { type: "DELETE"; commentId: string }
  | { type: "ADD"; entityId: string; comment: WorkspaceComment }
  | { type: "CLEAR" }
  | { type: "CLEAR_ENTITY"; entityId: string };

function commentsReducer(
  state: Record<string, WorkspaceComment[]>,
  action: CommentsAction,
): Record<string, WorkspaceComment[]> {
  switch (action.type) {
    case "SET":
      return { ...state, [action.entityId]: action.comments };
    case "ADD":
      return {
        ...state,
        [action.entityId]: [...(state[action.entityId] ?? []), action.comment],
      };
    case "UPDATE": {
      const next = { ...state };
      for (const key of Object.keys(next)) {
        const idx = next[key].findIndex((c) => c.id === action.commentId);
        if (idx !== -1) {
          const updated = [...next[key]];
          updated[idx] = action.next;
          next[key] = updated;
          break;
        }
      }
      return next;
    }
    case "DELETE": {
      const next = { ...state };
      for (const key of Object.keys(next)) {
        const filtered = next[key].filter((c) => c.id !== action.commentId);
        if (filtered.length !== next[key].length) {
          next[key] = filtered;
          break;
        }
      }
      return next;
    }
    case "CLEAR":
      return {};
    case "CLEAR_ENTITY": {
      const next = { ...state };
      delete next[action.entityId];
      return next;
    }
  }
}

export function TranscriptionClient({
  initialSurface = "overview",
  initialSettingsSection = "workspace",
  initialSettingsMode = "personal",
  initialProjectFilter = "all",
}: {
  initialSurface?:
    | "overview"
    | "upload"
    | "transcriptions"
    | "intelligence"
    | "operations"
    | "settings";
  initialSettingsSection?: SettingsSection;
  initialSettingsMode?: "workspace" | "personal";
  initialProjectFilter?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const fileInputId = useId();
  const resultAreaRef = useRef<HTMLElement | null>(null);
  const shouldScrollToSummaryRef = useRef(false);
  const listRequestAbortRef = useRef<AbortController | null>(null);
  const commentsRequestAbortControllersRef = useRef<Set<AbortController>>(new Set());
  const tasksRequestAbortRef = useRef<AbortController | null>(null);
  const assistantRequestAbortRef = useRef<AbortController | null>(null);
  const tipsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const uploadNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const uploadStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [items, setItems] = useState<Transcription[]>([]);
  const [allItems, setAllItems] = useState<Transcription[]>([]);
  const [overviewServerLoading, setOverviewServerLoading] = useState(false);
  const [workspaceSwitching, setWorkspaceSwitching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncedSearchQuery = "";
  const statusFilter = "all";
  const templateFilter = "all";
  const [projectFilter, setProjectFilter] = useState(initialProjectFilter);
  const [customTemplates, setCustomTemplates] = useState<SummaryTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectBusy, setProjectBusy] = useState(false);
  const [overviewUploadPanelVersion, setOverviewUploadPanelVersion] = useState(0);
  const [overviewUploadPanelStartExpanded, setOverviewUploadPanelStartExpanded] =
    useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberEntry[]>([]);
  const [workspaceInvites, setWorkspaceInvites] = useState<WorkspaceInviteEntry[]>([]);
  const [workspacePeopleLoading, setWorkspacePeopleLoading] = useState(true);
  const [workspaceActivity, setWorkspaceActivity] = useState<WorkspaceActivityEntry[]>([]);
  const [workspaceActivityLoading, setWorkspaceActivityLoading] = useState(true);
  const [activeWorkspace, setActiveWorkspace] = useState<ActiveWorkspaceDetails | null>(
    null,
  );
  const activeWorkspaceId = activeWorkspace?.id ?? null;
  const activeWorkspaceLabel = activeWorkspace
    ? `${activeWorkspace.name}${activeWorkspace.isPersonal ? " (Personal)" : ""}`
    : "No workspace selected";
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    email: string;
    name?: string | null;
  } | null>(null);
  const [workspaceSettingsBusy, setWorkspaceSettingsBusy] = useState(false);
  const [workspaceDraftName, setWorkspaceDraftName] = useState("");
  const [deletedWorkspaceName, setDeletedWorkspaceName] = useState<string | null>(null);
  const [workspaceDigestSettings, setWorkspaceDigestSettings] =
    useState<WorkspaceDigestSettings | null>(null);
  const [workspaceDigestLoading, setWorkspaceDigestLoading] = useState(true);
  const [workspaceDigestBusy, setWorkspaceDigestBusy] = useState<string | null>(null);
  const [workspaceDigestEnabled, setWorkspaceDigestEnabled] = useState(false);
  const [workspaceDigestCadence, setWorkspaceDigestCadence] = useState<
    "weekly" | "monthly"
  >("weekly");
  const [workspaceDigestReportType, setWorkspaceDigestReportType] = useState<
    "summary" | "new_insights" | "open_tasks" | "risk_watch"
  >("summary");
  const [workspaceDigestWeekday, setWorkspaceDigestWeekday] = useState("1");
  const [workspaceDigestDayOfMonth, setWorkspaceDigestDayOfMonth] = useState("1");
  const [workspaceDigestHour, setWorkspaceDigestHour] = useState("9");
  const [workspaceDigestRecipientScope, setWorkspaceDigestRecipientScope] =
    useState("managers");
  const [workspaceDigestSendEmail, setWorkspaceDigestSendEmail] = useState(true);
  const [workspaceDigestSendSlack, setWorkspaceDigestSendSlack] = useState(false);
  const [workspaceDigestTemplateName, setWorkspaceDigestTemplateName] = useState("");
  const [projectDigestSettings, setProjectDigestSettings] =
    useState<ProjectDigestSettings | null>(null);
  const [projectDigestLoading, setProjectDigestLoading] = useState(false);
  const [projectDigestBusy, setProjectDigestBusy] = useState<string | null>(null);
  const [projectDigestEnabled, setProjectDigestEnabled] = useState(false);
  const [projectDigestCadence, setProjectDigestCadence] = useState<
    "weekly" | "monthly"
  >("weekly");
  const [projectDigestReportType, setProjectDigestReportType] = useState<
    "summary" | "new_insights" | "open_tasks" | "risk_watch"
  >("summary");
  const [projectDigestWeekday, setProjectDigestWeekday] = useState("1");
  const [projectDigestDayOfMonth, setProjectDigestDayOfMonth] = useState("1");
  const [projectDigestHour, setProjectDigestHour] = useState("9");
  const [projectDigestRecipientScope, setProjectDigestRecipientScope] =
    useState("managers");
  const [projectDigestSendEmail, setProjectDigestSendEmail] = useState(true);
  const [projectDigestSendSlack, setProjectDigestSendSlack] = useState(false);
  const [projectDigestTemplateName, setProjectDigestTemplateName] = useState("");
  const [reportTemplates, setReportTemplates] = useState<RecurringReportTemplate[]>([]);
  const [reportTemplatesLoading, setReportTemplatesLoading] = useState(true);
  const [reportTemplateBusyKey, setReportTemplateBusyKey] = useState<string | null>(null);
  const [reportRuns, setReportRuns] = useState<RecurringReportRun[]>([]);
  const [reportRunsLoading, setReportRunsLoading] = useState(true);
  const [reportRunBusyId, setReportRunBusyId] = useState<string | null>(null);
  const [reportRunSummary, setReportRunSummary] = useState<ReportRunSummary | null>(null);
  const [reportRunSummaryLoading, setReportRunSummaryLoading] = useState(true);
  const [reportRunScopeFilter, setReportRunScopeFilter] = useState<
    "all" | "workspace" | "project"
  >("all");
  const [reportRunStatusFilter, setReportRunStatusFilter] = useState<
    "all" | "success" | "failed"
  >("all");
  const [reportRunExportBusy, setReportRunExportBusy] = useState<string | null>(null);
  const [workspaceSlackSettings, setWorkspaceSlackSettings] =
    useState<WorkspaceSlackSettings | null>(null);
  const [workspaceSlackLoading, setWorkspaceSlackLoading] = useState(true);
  const [workspaceSlackBusy, setWorkspaceSlackBusy] = useState<string | null>(null);
  const [workspaceSlackEnabled, setWorkspaceSlackEnabled] = useState(false);
  const [workspaceSlackSendDigests, setWorkspaceSlackSendDigests] = useState(true);
  const [workspaceSlackWebhookDraft, setWorkspaceSlackWebhookDraft] = useState("");
  const [workspaceSlackDestinations, setWorkspaceSlackDestinations] = useState<
    WorkspaceSlackDestination[]
  >([]);
  const [workspaceSlackDestinationName, setWorkspaceSlackDestinationName] = useState("");
  const [workspaceSlackDestinationWebhook, setWorkspaceSlackDestinationWebhook] =
    useState("");
  const [workspaceSlackDestinationBusy, setWorkspaceSlackDestinationBusy] = useState<
    string | null
  >(null);
  const [workspaceDigestSlackDestinationId, setWorkspaceDigestSlackDestinationId] =
    useState("default");
  const [projectDigestSlackDestinationId, setProjectDigestSlackDestinationId] =
    useState("default");
  const [workspaceNotionSettings, setWorkspaceNotionSettings] =
    useState<WorkspaceNotionSettings | null>(null);
  const [workspaceNotionLoading, setWorkspaceNotionLoading] = useState(true);
  const [workspaceNotionBusy, setWorkspaceNotionBusy] = useState<string | null>(null);
  const [workspaceNotionEnabled, setWorkspaceNotionEnabled] = useState(false);
  const [workspaceNotionTokenDraft, setWorkspaceNotionTokenDraft] = useState("");
  const [workspaceNotionParentPageDraft, setWorkspaceNotionParentPageDraft] =
    useState("");
  const [integrationError, setIntegrationError] = useState<string | null>(null);
  const [notificationPreferences, setNotificationPreferences] =
    useState<UserNotificationPreferences | null>(null);
  const [notificationPreferencesLoading, setNotificationPreferencesLoading] =
    useState(true);
  const [notificationPreferencesBusy, setNotificationPreferencesBusy] = useState(false);
  const [mentionEmailEnabled, setMentionEmailEnabled] = useState(true);
  const [mentionInAppEnabled, setMentionInAppEnabled] = useState(true);
  const [digestEmailEnabled, setDigestEmailEnabled] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [memberBusyId, setMemberBusyId] = useState<string | null>(null);
  const [ownerTransferMemberId, setOwnerTransferMemberId] = useState("");
  const [ownerTransferBusy, setOwnerTransferBusy] = useState(false);
  const [leaveWorkspaceBusy, setLeaveWorkspaceBusy] = useState(false);
  const [deleteWorkspaceBusy, setDeleteWorkspaceBusy] = useState(false);
  const [uploadProjectId, setUploadProjectId] = useState("none");
  const [file, setFile] = useState<File | null>(null);
  const [estimatedDurationSeconds, setEstimatedDurationSeconds] = useState<
    number | null
  >(null);
  const [durationLoading, setDurationLoading] = useState(false);
  const [uploadTemplate, setUploadTemplate] = useState("default");
  const [testDataLoading, setTestDataLoading] = useState(false);
  const [testDataStatus, setTestDataStatus] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Record<string, boolean>>(
    {},
  );
  const [focusedSummaryId, setFocusedSummaryId] = useState<string | null>(null);
  const [overviewDetailsAutoOpenToken, setOverviewDetailsAutoOpenToken] = useState(0);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantRefreshing, setAssistantRefreshing] = useState(false);
  const [assistantHistoryLoading, setAssistantHistoryLoading] = useState(false);
  const [assistantScope, setAssistantScope] = useState<AssistantScope>("transcript");
  const [assistantProjectId, setAssistantProjectId] = useState("all");
  const [assistantWorkspaceProjectIds, setAssistantWorkspaceProjectIds] = useState<
    string[]
  >([]);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [assistantSummary, setAssistantSummary] = useState<{
    decisions?: string[];
    keyPoints?: string[];
    nextSteps?: string[];
    actionItems?: ActionItem[];
  } | null>(null);
  const [assistantMessages, setAssistantMessages] =
    useState<AssistantMessage[]>(defaultAssistantMessages);
  const [completionTip, setCompletionTip] = useState<string | null>(null);
  const [uploadVisibilityNotice, setUploadVisibilityNotice] = useState<
    string | null
  >(null);
  const [uploadStatusNotice, setUploadStatusNotice] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState<string | null>(null);
  const [actionTasksByTranscription, setActionTasksByTranscription] = useState<
    Record<string, ActionTask[]>
  >({});
  const [workspaceTasks, setWorkspaceTasks] = useState<ActionTask[]>([]);
  const [workspaceTasksLoading, setWorkspaceTasksLoading] = useState(true);
  const [workspaceTaskStatusFilter, setWorkspaceTaskStatusFilter] = useState("all");
  const [workspaceTaskAssignmentFilter, setWorkspaceTaskAssignmentFilter] = useState(
    "all",
  );
  const [actionTaskBusyKey, setActionTaskBusyKey] = useState<string | null>(null);
  const [commentsById, dispatchComments] = useReducer(commentsReducer, {});
  const [commentBusyKey, setCommentBusyKey] = useState<string | null>(null);
  const [, setTranscriptionCommentDraft] = useState("");
  const [taskCommentDrafts, setTaskCommentDrafts] = useState<Record<string, string>>({});
  const [projectInsightCommentDrafts, setProjectInsightCommentDrafts] = useState<
    Record<string, string>
  >({});
  const [workspaceInsightCommentDrafts, setWorkspaceInsightCommentDrafts] = useState<
    Record<string, string>
  >({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentEditDrafts, setCommentEditDrafts] = useState<Record<string, string>>({});
  const [notifications, setNotifications] = useState<WorkspaceNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationBusyId, setNotificationBusyId] = useState<string | null>(null);
  const [intelligenceScope, setIntelligenceScope] = useState<"project" | "workspace">(
    "project",
  );
  const [intelligenceProjectId, setIntelligenceProjectId] = useState("all");
  const [workspaceIntelligenceProjectIds, setWorkspaceIntelligenceProjectIds] = useState<
    string[]
  >([]);
  const [intelligenceQuestion, setIntelligenceQuestion] = useState("");
  const [intelligenceBusy, setIntelligenceBusy] = useState(false);
  const [intelligenceResult, setIntelligenceResult] =
    useState<ProjectIntelligenceResponse | null>(null);
  const [intelligenceTitleDraft, setIntelligenceTitleDraft] = useState("");
  const [workspaceInsightTitleDraft, setWorkspaceInsightTitleDraft] = useState("");
  const [savedProjectInsights, setSavedProjectInsights] = useState<SavedProjectInsight[]>(
    [],
  );
  const [savedWorkspaceInsights, setSavedWorkspaceInsights] = useState<
    SavedWorkspaceInsight[]
  >([]);
  const [projectInsightsLoading, setProjectInsightsLoading] = useState(false);
  const [workspaceInsightsLoading, setWorkspaceInsightsLoading] = useState(false);
  const [projectInsightBusyKey, setProjectInsightBusyKey] = useState<string | null>(
    null,
  );
  const [workspaceInsightBusyKey, setWorkspaceInsightBusyKey] = useState<string | null>(
    null,
  );
  const [slackShareBusyKey, setSlackShareBusyKey] = useState<string | null>(null);
  const [notionShareBusyKey, setNotionShareBusyKey] = useState<string | null>(null);
  const [selectedProjectInsightId, setSelectedProjectInsightId] = useState<string | null>(
    null,
  );
  const [selectedWorkspaceInsightId, setSelectedWorkspaceInsightId] = useState<string | null>(
    null,
  );
  const [projectInsightFilter, setProjectInsightFilter] = useState("active");
  const [workspaceInsightFilter, setWorkspaceInsightFilter] = useState("active");
  const [workspaceSurface, setWorkspaceSurface] =
    useState<DashboardSurface>(initialSurface);
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>(initialSettingsSection);
  const lastWorkspaceIdRef = useRef<string | null>(null);

  const templateOptions = useMemo(
    () => [
      ...builtInTemplates,
      ...customTemplates.map((template) => ({
        id: `custom:${template.id}`,
        label: `${template.name} (Custom)`,
      })),
    ],
    [customTemplates],
  );
  const statusOptions = useMemo(
    () => [
      { id: "all", label: "All statuses" },
      { id: "uploading", label: "Uploading" },
      { id: "uploaded", label: "Uploaded" },
      { id: "processing", label: "Processing" },
      { id: "done", label: "Done" },
      { id: "error", label: "Error" },
    ],
    [],
  );
  const taskStatusOptions = useMemo(
    () => [
      { id: "all", label: "All tasks" },
      { id: "open", label: "Open" },
      { id: "in_progress", label: "In Progress" },
      { id: "done", label: "Done" },
    ],
    [],
  );
  const taskAssignmentOptions = useMemo(
    () => [
      { id: "all", label: "Everyone" },
      { id: "mine", label: "Assigned to me" },
      { id: "unassigned", label: "Unassigned" },
    ],
    [],
  );
  const projectInsightFilterOptions = useMemo(
    () => [
      { id: "active", label: "Active" },
      { id: "pinned", label: "Pinned" },
      { id: "archived", label: "Archived" },
      { id: "all", label: "All" },
    ],
    [],
  );
  const digestWeekdayOptions = [
    { id: "0", label: "Sunday" },
    { id: "1", label: "Monday" },
    { id: "2", label: "Tuesday" },
    { id: "3", label: "Wednesday" },
    { id: "4", label: "Thursday" },
    { id: "5", label: "Friday" },
    { id: "6", label: "Saturday" },
  ];
  const digestCadenceOptions = [
    { id: "weekly", label: "Weekly" },
    { id: "monthly", label: "Monthly" },
  ];
  const digestRecipientOptions = [
    { id: "managers", label: "Owners and admins" },
    { id: "all_members", label: "All active members" },
  ];
  const digestReportTypeOptions = [
    {
      id: "summary",
      label: "Summary report",
      description: "Blend recent insights with the current task picture.",
    },
    {
      id: "new_insights",
      label: "New insights",
      description: "Focus on the newest insights captured this week.",
    },
    {
      id: "open_tasks",
      label: "Open tasks",
      description: "Highlight unfinished work, owners, and follow-ups.",
    },
    {
      id: "risk_watch",
      label: "Risk watch",
      description: "Spot risky themes and unresolved follow-through.",
    },
  ];
  const browserTimeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );
  useEffect(() => {
    setWorkspaceSurface(initialSurface);
  }, [initialSurface]);
  useEffect(() => {
    setSettingsSection(initialSettingsSection);
  }, [initialSettingsSection]);
  useEffect(() => {
    setProjectFilter(initialProjectFilter || "all");
  }, [initialProjectFilter]);

  useEffect(() => {
    function applySurfaceFromPath() {
      const nextPath = window.location.pathname;
      if (nextPath === "/dashboard/transcriptions") {
        setWorkspaceSurface("transcriptions");
        setProjectFilter(new URLSearchParams(window.location.search).get("projectId") || "all");
        return;
      }
      if (nextPath === "/dashboard/settings") {
        const section = new URLSearchParams(window.location.search).get("section");
        setWorkspaceSurface("settings");
        setSettingsSection(
          section === "workspace" ||
            section === "delivery" ||
            section === "integrations" ||
            section === "access" ||
            section === "personal"
            ? section
            : "personal",
        );
        return;
      }
      if (nextPath === "/dashboard") {
        setWorkspaceSurface("overview");
        setProjectFilter("all");
      }
    }

    function handleSurfaceNavigation(event: Event) {
      const detail = (event as CustomEvent<{
        surface?: DashboardSurface;
        settingsSection?: SettingsSection;
        projectFilter?: string;
      }>).detail;

      if (!detail?.surface) {
        return;
      }

      // Overview is now owned by DashboardClient at /dashboard — navigate there.
      if (detail.surface === "overview") {
        router.push("/dashboard");
        return;
      }

      setWorkspaceSurface(detail.surface);
      if (detail.settingsSection) {
        setSettingsSection(detail.settingsSection);
      }
      if (typeof detail.projectFilter === "string") {
        setProjectFilter(detail.projectFilter);
      }
    }

    window.addEventListener("voxly:navigate-dashboard-surface", handleSurfaceNavigation);
    window.addEventListener("popstate", applySurfaceFromPath);
    return () => {
      window.removeEventListener(
        "voxly:navigate-dashboard-surface",
        handleSurfaceNavigation,
      );
      window.removeEventListener("popstate", applySurfaceFromPath);
    };
  }, []);
  const isDev = process.env.NODE_ENV !== "production";

  const sortedItems = useMemo(() => {
    return [...items].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [items]);

  const allSortedItems = useMemo(() => {
    return [...allItems].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [allItems]);

  const latestSummary = useMemo(() => {
    return allSortedItems.find((item) => item.status === "done") || null;
  }, [allSortedItems]);
  const focusedSummary = useMemo(() => {
    if (!focusedSummaryId) {
      return latestSummary;
    }

    return allSortedItems.find((item) => item.id === focusedSummaryId) || latestSummary;
  }, [allSortedItems, focusedSummaryId, latestSummary]);
  const displaySummary = assistantSummary || focusedSummary;
  const activeTranscriptionId = focusedSummary?.id || null;
  const hasProcessedSummary = focusedSummary?.status === "done";
  const isSettingsSurface = workspaceSurface === "settings";
  const isWorkspaceSettingsMode = initialSettingsMode === "workspace";
  const showCurrentWorkspaceLabel =
    workspaceSurface === "overview" ||
    workspaceSurface === "transcriptions" ||
    (workspaceSurface === "settings" && isWorkspaceSettingsMode);
  const currentActionTasks = useMemo(
    () =>
      activeTranscriptionId
        ? actionTasksByTranscription[activeTranscriptionId] || []
        : [],
    [activeTranscriptionId, actionTasksByTranscription],
  );
  const currentProjectInsightComments = useMemo(
    () =>
      selectedProjectInsightId
        ? commentsById[selectedProjectInsightId] || []
        : [],
    [commentsById, selectedProjectInsightId],
  );
  const currentWorkspaceInsightComments = useMemo(
    () =>
      selectedWorkspaceInsightId
        ? commentsById[selectedWorkspaceInsightId] || []
        : [],
    [commentsById, selectedWorkspaceInsightId],
  );
  const focusedSummaryHiddenByFilters =
    !!focusedSummaryId && !sortedItems.some((item) => item.id === focusedSummaryId);
  const isFocusedSummaryProcessing = !!(
    focusedSummary && processingIds[focusedSummary.id]
  ) || focusedSummary?.status === "processing";
  const canProcessFocusedSummary = !!focusedSummary && !isFocusedSummaryProcessing;
  const isOverviewDataResolving =
    workspaceSurface === "overview" && (workspaceSwitching || overviewServerLoading);
  const hasProjectScopedHistoryView =
    workspaceSurface === "transcriptions" && projectFilter !== "all";
  const currentRecordingText = useMemo(() => {
    if (!focusedSummary) {
      return "";
    }

    return (
      focusedSummary.keyPoints?.join(" ") ||
      focusedSummary.decisions?.join(" ") ||
      focusedSummary.nextSteps?.join(" ") ||
      focusedSummary.transcript ||
      ""
    );
  }, [focusedSummary]);
  const currentRecordingSnippet = useMemo(() => {
    if (!currentRecordingText) {
      return "";
    }

    return currentRecordingText.length > 220
      ? `${currentRecordingText.slice(0, 220).trim()}...`
      : currentRecordingText;
  }, [currentRecordingText]);
  const hasExpandableCurrentRecordingText = currentRecordingText.length > 0;
  const estimatedCredits =
    estimatedDurationSeconds && estimatedDurationSeconds > 0
      ? Math.max(1, Math.ceil(estimatedDurationSeconds / 60))
      : null;
  const hasEnoughEstimatedCredits =
    !estimatedCredits || !billing
      ? true
      : billing.creditsRemaining >= estimatedCredits;
  const ownershipTransferBlockedByBilling =
    Boolean(billing?.hasActiveSubscription) || (billing?.creditsRemaining ?? 0) > 0;
  const shouldShowGlobalError =
    Boolean(error) && error !== "Unauthorized" && error !== "Forbidden";
  const shouldShowBuyCreditsButton = isInsufficientCreditsError(error);
  const unreadNotificationsCount = notifications.filter((item) => !item.readAt).length;
  const currentUserAssigneeCandidates = useMemo(() => {
    const candidates = new Set<string>();
    if (currentUser?.email?.trim()) {
      candidates.add(currentUser.email.trim().toLowerCase());
    }
    if (currentUser?.name?.trim()) {
      candidates.add(currentUser.name.trim().toLowerCase());
    }
    return candidates;
  }, [currentUser]);
  const filteredWorkspaceTasks = useMemo(() => {
    return workspaceTasks.filter((task) => {
      if (workspaceTaskStatusFilter !== "all" && task.status !== workspaceTaskStatusFilter) {
        return false;
      }

      if (workspaceTaskAssignmentFilter === "mine") {
        const assignee = task.assignee?.trim().toLowerCase();
        return !!assignee && currentUserAssigneeCandidates.has(assignee);
      }

      if (workspaceTaskAssignmentFilter === "unassigned") {
        return !task.assignee?.trim();
      }

      return true;
    });
  }, [
    currentUserAssigneeCandidates,
    workspaceTaskAssignmentFilter,
    workspaceTaskStatusFilter,
    workspaceTasks,
  ]);
  const workspaceTaskCounts = useMemo(() => {
    return workspaceTasks.reduce(
      (acc, task) => {
        acc.total += 1;
        if (task.status === "open") {
          acc.open += 1;
        }
        if (task.status === "in_progress") {
          acc.inProgress += 1;
        }
        if (task.status === "done") {
          acc.done += 1;
        }
        return acc;
      },
      { total: 0, open: 0, inProgress: 0, done: 0 },
    );
  }, [workspaceTasks]);
  const filteredProjectInsights = useMemo(() => {
    return savedProjectInsights.filter((insight) => {
      if (projectInsightFilter === "pinned") {
        return Boolean(insight.isPinned) && !insight.archivedAt;
      }

      if (projectInsightFilter === "archived") {
        return Boolean(insight.archivedAt);
      }

      if (projectInsightFilter === "all") {
        return true;
      }

      return !insight.archivedAt;
    });
  }, [projectInsightFilter, savedProjectInsights]);
  const filteredWorkspaceInsights = useMemo(() => {
    return savedWorkspaceInsights.filter((insight) => {
      if (workspaceInsightFilter === "pinned") {
        return Boolean(insight.isPinned) && !insight.archivedAt;
      }

      if (workspaceInsightFilter === "archived") {
        return Boolean(insight.archivedAt);
      }

      if (workspaceInsightFilter === "all") {
        return true;
      }

      return !insight.archivedAt;
    });
  }, [savedWorkspaceInsights, workspaceInsightFilter]);
  const selectedProjectName = useMemo(() => {
    if (!focusedSummary?.projectId) {
      return "Unassigned";
    }

    return (
      projects.find((project) => project.id === focusedSummary.projectId)?.name ||
      "Project"
    );
  }, [focusedSummary?.projectId, projects]);
  const savedInsightCount = savedProjectInsights.length + savedWorkspaceInsights.length;
  const assistantScopeSuggestions: Record<AssistantScope, string[]> = {
    transcript: [
      "Summarize the meeting in 3 bullets",
      "List owners for each action item",
      "Draft a follow-up email for attendees",
      "Create a risk list from the discussion",
    ],
    project: [
      "What themes are recurring across this project?",
      "Summarize the key decisions across these recordings",
      "What open risks should we watch?",
      "List the main follow-ups still unresolved",
    ],
    workspace: [
      "What themes came up across the workspace?",
      "Which projects mention the most risks?",
      "Summarize open follow-ups across recordings",
      "What patterns are emerging this week?",
    ],
  };

  function upsertItemCollection(
    collection: Transcription[],
    nextItem: Transcription,
  ) {
    const existingIndex = collection.findIndex((item) => item.id === nextItem.id);
    if (existingIndex === -1) {
      return [nextItem, ...collection];
    }

    return collection.map((item) => (item.id === nextItem.id ? nextItem : item));
  }

  function upsertTranscriptionEverywhere(nextItem: Transcription) {
    setItems((prev) =>
      matchesCurrentFilters(nextItem) ? upsertItemCollection(prev, nextItem) : prev,
    );
    setAllItems((prev) => upsertItemCollection(prev, nextItem));
  }

  function sortTasksByPriority(tasks: ActionTask[]) {
    const statusRank: Record<ActionTask["status"], number> = {
      open: 0,
      in_progress: 1,
      done: 2,
    };

    return [...tasks].sort((a, b) => {
      const statusDelta = statusRank[a.status] - statusRank[b.status];
      if (statusDelta !== 0) {
        return statusDelta;
      }

      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  function upsertTaskCollection(collection: ActionTask[], nextTask: ActionTask) {
    const existingIndex = collection.findIndex((task) => task.id === nextTask.id);
    if (existingIndex === -1) {
      return sortTasksByPriority([...collection, nextTask]);
    }

    return sortTasksByPriority(
      collection.map((task) => (task.id === nextTask.id ? nextTask : task)),
    );
  }

  function matchesCurrentFilters(item: Transcription) {
    const trimmedQuery = debouncedSearchQuery.trim().toLowerCase();
    if (statusFilter !== "all" && item.status !== statusFilter) {
      return false;
    }
      if (templateFilter !== "all" && item.template !== templateFilter) {
        return false;
      }
      if (projectFilter !== "all" && item.projectId !== projectFilter) {
        return false;
      }
      if (!trimmedQuery) {
        return true;
      }

    const haystack = [
      item.fileName,
      item.transcript || "",
      ...(item.decisions || []),
      ...(item.keyPoints || []),
      ...(item.nextSteps || []),
      ...(item.actionItems || []).map((actionItem) => actionItem.text),
    ]
      .join("\n")
      .toLowerCase();

    return haystack.includes(trimmedQuery);
  }

  async function readMediaDuration(fileToRead: File) {
    setDurationLoading(true);
    try {
      const objectUrl = URL.createObjectURL(fileToRead);
      const media = document.createElement(
        fileToRead.type.startsWith("video/") ? "video" : "audio",
      );
      media.preload = "metadata";

      const duration = await new Promise<number | null>((resolve) => {
        const cleanup = () => {
          URL.revokeObjectURL(objectUrl);
          media.removeAttribute("src");
          media.load();
        };

        media.onloadedmetadata = () => {
          const nextDuration =
            Number.isFinite(media.duration) && media.duration > 0
              ? media.duration
              : null;
          cleanup();
          resolve(nextDuration);
        };

        media.onerror = () => {
          cleanup();
          resolve(null);
        };

        media.src = objectUrl;
      });

      setEstimatedDurationSeconds(duration);
    } finally {
      setDurationLoading(false);
    }
  }

  const loadItems = useCallback(async (options?: { showLoading?: boolean; force?: boolean }) => {
    const showLoading = options?.showLoading ?? true;
    const trimmedQuery = debouncedSearchQuery.trim();
    const cacheKey = buildTranscriptionsCacheKey({
      workspaceId: activeWorkspaceId,
      query: trimmedQuery,
      status: statusFilter,
      template: templateFilter,
      projectId: projectFilter,
    });
    if (!options?.force && showLoading) {
      const cachedItems = readSessionCache<Transcription[]>(cacheKey);
      if (cachedItems) {
        setItems(cachedItems);
        setAllItems((prev) => {
          const merged = new Map(prev.map((item) => [item.id, item]));
          for (const item of cachedItems) {
            merged.set(item.id, item);
          }
          return Array.from(merged.values());
        });
        setOverviewServerLoading(false);
        setWorkspaceSwitching(false);
        return cachedItems;
      }
    }

    if (listRequestAbortRef.current) {
      listRequestAbortRef.current.abort();
    }
    const abortController = new AbortController();
    listRequestAbortRef.current = abortController;

    if (showLoading) {
      setOverviewServerLoading(true);
    }
    setError(null);
    try {
      const params = new URLSearchParams();
      if (trimmedQuery) {
        params.set("q", trimmedQuery);
      }
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (templateFilter !== "all") {
        params.set("template", templateFilter);
      }
      if (projectFilter !== "all") {
        params.set("projectId", projectFilter);
      }

      const queryString = params.toString();
      const res = await fetch(
        queryString ? `/api/transcriptions?${queryString}` : "/api/transcriptions",
        { signal: abortController.signal },
      );
      const payload = (await res.json()) as ApiResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load transcriptions");
      }
      if (listRequestAbortRef.current !== abortController) {
        return null;
      }
      const nextItems = payload.items || [];
      setItems(nextItems);
      writeSessionCache(cacheKey, nextItems);
      setAllItems((prev) => {
        const merged = new Map(prev.map((item) => [item.id, item]));
        for (const item of nextItems) {
          merged.set(item.id, item);
        }
        return Array.from(merged.values());
      });
      setWorkspaceSwitching(false);
      return nextItems;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return null;
      }
      setError(err instanceof Error ? err.message : "Failed to load data");
      setWorkspaceSwitching(false);
      return null;
    } finally {
      if (listRequestAbortRef.current === abortController) {
        listRequestAbortRef.current = null;
      }
      if (showLoading) {
        setOverviewServerLoading(false);
      }
    }
  }, [activeWorkspaceId, debouncedSearchQuery, statusFilter, templateFilter, projectFilter]);

  async function loadTranscriptionById(id: string) {
    try {
      const res = await fetch(
        `/api/transcriptions?id=${encodeURIComponent(id)}&limit=1`,
        { cache: "no-store" },
      );
      const payload = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load transcription");
      }

      const item = payload.items?.[0] || null;
      if (item) {
        upsertTranscriptionEverywhere(item);
      }
      return item;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transcription");
      return null;
    }
  }

  async function loadBilling(options?: { force?: boolean }) {
    const cacheKey = buildScopedCacheKey(BILLING_CACHE_KEY, activeWorkspaceId);
    const cachedBilling = options?.force
      ? null
      : readSessionCache<BillingInfo | null>(cacheKey);
    if (cachedBilling !== null) {
      setBilling(cachedBilling);
      return;
    }

    try {
      const res = await fetch("/api/billing/subscription");
      const payload = (await res.json()) as BillingResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load billing");
      }

      const nextBilling = payload.billing || null;
      setBilling(nextBilling);
      writeSessionCache(cacheKey, nextBilling);
    } catch (err) {
      setBilling(null);
      const message =
        err instanceof Error ? err.message : "Failed to load billing";
      if (message === "Unauthorized") {
        return;
      }
      setError(message);
    }
  }

  async function loadTemplates() {
    const cacheKey = buildScopedCacheKey(TEMPLATES_CACHE_KEY, activeWorkspaceId);
    const cachedTemplates = readSessionCache<SummaryTemplate[]>(cacheKey);
    if (cachedTemplates) {
      setCustomTemplates(cachedTemplates);
      setTemplatesLoading(false);
      return;
    }

    setTemplatesLoading(true);
    try {
      const res = await fetch("/api/templates");
      const payload = (await res.json()) as TemplatesResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load templates");
      }

      const nextTemplates = payload.templates || [];
      setCustomTemplates(nextTemplates);
      writeSessionCache(cacheKey, nextTemplates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setTemplatesLoading(false);
    }
  }

  async function loadProjects(options?: { force?: boolean }) {
    const cacheKey = buildScopedCacheKey(PROJECTS_CACHE_KEY, activeWorkspaceId);
    const cachedProjects = options?.force
      ? null
      : readSessionCache<Project[]>(cacheKey);
    if (cachedProjects) {
      setProjects(cachedProjects);
      setProjectsLoading(false);
      return;
    }

    setProjectsLoading(true);
    try {
      const res = await fetch("/api/projects");
      const payload = (await res.json()) as ProjectsResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load projects");
      }

      const nextProjects = payload.projects || [];
      setProjects(nextProjects);
      writeSessionCache(cacheKey, nextProjects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setProjectsLoading(false);
    }
  }

  async function loadWorkspaces() {
    try {
      const res = await fetch("/api/workspaces");
      const payload = (await res.json()) as WorkspacesResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load workspaces");
      }

      setActiveWorkspace(payload.activeWorkspace || null);
      setCurrentUser(payload.currentUser || null);
      setWorkspaceDraftName(payload.activeWorkspace?.name || "");
      if (!payload.activeWorkspace) {
        setWorkspaceSwitching(false);
        setOverviewServerLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspaces");
      setWorkspaceSwitching(false);
    }
  }

  function resetWorkspaceScopedState() {
    setWorkspaceSwitching(true);
    listRequestAbortRef.current?.abort();
    commentsRequestAbortControllersRef.current.forEach((controller) =>
      controller.abort(),
    );
    tasksRequestAbortRef.current?.abort();
    assistantRequestAbortRef.current?.abort();
    listRequestAbortRef.current = null;
    commentsRequestAbortControllersRef.current.clear();
    tasksRequestAbortRef.current = null;
    assistantRequestAbortRef.current = null;
    setItems([]);
    setAllItems([]);
    setFocusedSummaryId(null);
    setProjectFilter("all");
    setUploadProjectId("none");
    setProjects([]);
    setCustomTemplates([]);
    setBilling(null);
    setActionTasksByTranscription({});
    setWorkspaceTasks([]);
    setWorkspaceMembers([]);
    setWorkspaceInvites([]);
    setWorkspaceActivity([]);
    setSavedProjectInsights([]);
    setSavedWorkspaceInsights([]);
    setSelectedProjectInsightId(null);
    setSelectedWorkspaceInsightId(null);
    setIntelligenceProjectId("all");
    setWorkspaceIntelligenceProjectIds([]);
    setAssistantProjectId("all");
    setAssistantWorkspaceProjectIds([]);
    setAssistantSummary(null);
    setAssistantMessages(defaultAssistantMessages);
    setProcessingIds({});
    dispatchComments({ type: "CLEAR" });
    setError(null);
    setProjectsLoading(true);
    setTemplatesLoading(true);
    setWorkspaceTasksLoading(true);
    setWorkspacePeopleLoading(true);
    setWorkspaceActivityLoading(true);
    setOverviewServerLoading(true);
  }

  async function loadWorkspaceDigestSettings() {
    const cacheKey = buildScopedCacheKey(WORKSPACE_DIGEST_CACHE_KEY, activeWorkspaceId);
    const cachedSettings = readSessionCache<WorkspaceDigestSettings>(
      cacheKey,
    );
    if (cachedSettings) {
      setWorkspaceDigestSettings(cachedSettings);
      setWorkspaceDigestEnabled(cachedSettings.enabled);
      setWorkspaceDigestCadence(cachedSettings.cadence);
      setWorkspaceDigestReportType(cachedSettings.reportType);
      setWorkspaceDigestWeekday(String(cachedSettings.weekday));
      setWorkspaceDigestDayOfMonth(String(cachedSettings.dayOfMonth));
      setWorkspaceDigestHour(String(cachedSettings.hourLocal));
      setWorkspaceDigestRecipientScope(cachedSettings.recipientScope);
      setWorkspaceDigestSendEmail(cachedSettings.sendEmail);
      setWorkspaceDigestSendSlack(cachedSettings.sendSlack);
      setWorkspaceDigestSlackDestinationId(cachedSettings.slackDestinationId || "default");
      setWorkspaceDigestLoading(false);
      return;
    }

    setWorkspaceDigestLoading(true);
    try {
      const res = await fetch("/api/workspaces/digest");
      const payload = (await res.json().catch(() => ({}))) as WorkspaceDigestResponse;
      if (!res.ok || !payload.settings) {
        throw new Error(payload?.error || "Failed to load digest settings");
      }

      setWorkspaceDigestSettings(payload.settings);
      setWorkspaceDigestEnabled(payload.settings.enabled);
      setWorkspaceDigestCadence(payload.settings.cadence);
      setWorkspaceDigestReportType(payload.settings.reportType);
      setWorkspaceDigestWeekday(String(payload.settings.weekday));
      setWorkspaceDigestDayOfMonth(String(payload.settings.dayOfMonth));
      setWorkspaceDigestHour(String(payload.settings.hourLocal));
      setWorkspaceDigestRecipientScope(payload.settings.recipientScope);
      setWorkspaceDigestSendEmail(payload.settings.sendEmail);
      setWorkspaceDigestSendSlack(payload.settings.sendSlack);
      setWorkspaceDigestSlackDestinationId(payload.settings.slackDestinationId || "default");
      writeSessionCache(cacheKey, payload.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load digest settings");
    } finally {
      setWorkspaceDigestLoading(false);
    }
  }

  async function loadReportTemplates() {
    const cacheKey = buildScopedCacheKey(REPORT_TEMPLATES_CACHE_KEY, activeWorkspaceId);
    const cachedTemplates = readSessionCache<RecurringReportTemplate[]>(
      cacheKey,
    );
    if (cachedTemplates) {
      setReportTemplates(cachedTemplates);
      setReportTemplatesLoading(false);
      return;
    }

    setReportTemplatesLoading(true);
    try {
      const res = await fetch("/api/report-templates");
      const payload = (await res.json().catch(() => ({}))) as ReportTemplatesResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load report templates");
      }

      const nextTemplates = payload.templates || [];
      setReportTemplates(nextTemplates);
      writeSessionCache(cacheKey, nextTemplates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report templates");
    } finally {
      setReportTemplatesLoading(false);
    }
  }

  const loadReportRuns = useCallback(async () => {
    setReportRunsLoading(true);
    try {
      const params = new URLSearchParams({
        scope: reportRunScopeFilter,
        status: reportRunStatusFilter,
        limit: "50",
      });
      const res = await fetch(`/api/report-runs?${params.toString()}`);
      const payload = (await res.json().catch(() => ({}))) as ReportRunsResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load report history");
      }

      setReportRuns(payload.runs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report history");
    } finally {
      setReportRunsLoading(false);
    }
  }, [reportRunScopeFilter, reportRunStatusFilter]);

  const loadReportRunSummary = useCallback(async () => {
    setReportRunSummaryLoading(true);
    try {
      const res = await fetch("/api/report-runs/summary?days=30");
      const payload = (await res.json().catch(() => ({}))) as ReportRunSummaryResponse;
      if (!res.ok || !payload.summary) {
        throw new Error(payload?.error || "Failed to load report analytics");
      }

      setReportRunSummary(payload.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report analytics");
    } finally {
      setReportRunSummaryLoading(false);
    }
  }, []);

  async function handleExportReportRuns(format: "csv" | "md") {
    setReportRunExportBusy(format);
    setError(null);

    try {
      const params = new URLSearchParams({
        scope: reportRunScopeFilter,
        status: reportRunStatusFilter,
        format,
      });
      const res = await fetch(`/api/report-runs/export?${params.toString()}`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to export report history");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = format === "csv" ? "report-history.csv" : "report-history.md";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showUploadStatusNotice(
        format === "csv" ? "Report history exported as CSV." : "Report history exported as Markdown.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export report history");
    } finally {
      setReportRunExportBusy(null);
    }
  }

  async function handleRetryReportRun(runId: string) {
    setReportRunBusyId(runId);
    setError(null);

    try {
      const res = await fetch(`/api/report-runs/${encodeURIComponent(runId)}/retry`, {
        method: "POST",
      });
      const payload = (await res.json().catch(() => ({}))) as ReportRunsResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to retry report run");
      }

      await Promise.all([loadReportRuns(), loadWorkspaceActivity(), loadNotifications()]);
      await loadReportRunSummary();
      const deliveryParts = [
        payload.result?.emailRecipientCount
          ? `emailed ${payload.result.emailRecipientCount} recipient${payload.result.emailRecipientCount === 1 ? "" : "s"}`
          : null,
        payload.result?.slackDelivered ? "posted to Slack" : null,
      ].filter(Boolean);
      showUploadStatusNotice(
        deliveryParts.length
          ? `Report retry ${deliveryParts.join(" and ")}.`
          : "Report retry completed.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retry report run");
    } finally {
      setReportRunBusyId(null);
    }
  }

  const loadProjectDigestSettings = useCallback(async (projectId: string) => {
    if (!projectId || projectId === "all") {
      setProjectDigestSettings(null);
      setProjectDigestEnabled(false);
      setProjectDigestCadence("weekly");
      setProjectDigestReportType("summary");
      setProjectDigestWeekday("1");
      setProjectDigestDayOfMonth("1");
      setProjectDigestHour("9");
      setProjectDigestRecipientScope("managers");
      setProjectDigestSendEmail(true);
      setProjectDigestSendSlack(false);
      setProjectDigestSlackDestinationId("default");
      return;
    }

    setProjectDigestLoading(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/digest`);
      const payload = (await res.json().catch(() => ({}))) as ProjectDigestResponse;
      if (!res.ok || !payload.settings) {
        throw new Error(payload?.error || "Failed to load project digest settings");
      }

      setProjectDigestSettings(payload.settings);
      setProjectDigestEnabled(payload.settings.enabled);
      setProjectDigestCadence(payload.settings.cadence);
      setProjectDigestReportType(payload.settings.reportType);
      setProjectDigestWeekday(String(payload.settings.weekday));
      setProjectDigestDayOfMonth(String(payload.settings.dayOfMonth));
      setProjectDigestHour(String(payload.settings.hourLocal));
      setProjectDigestRecipientScope(payload.settings.recipientScope);
      setProjectDigestSendEmail(payload.settings.sendEmail);
      setProjectDigestSendSlack(payload.settings.sendSlack);
      setProjectDigestSlackDestinationId(payload.settings.slackDestinationId || "default");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load project digest settings",
      );
    } finally {
      setProjectDigestLoading(false);
    }
  }, []);

  async function loadWorkspaceSlackSettings() {
    const cacheKey = buildScopedCacheKey(WORKSPACE_SLACK_CACHE_KEY, activeWorkspaceId);
    const cachedSettings = readSessionCache<WorkspaceSlackSettings>(
      cacheKey,
    );
    if (cachedSettings) {
      setWorkspaceSlackSettings(cachedSettings);
      setWorkspaceSlackEnabled(cachedSettings.enabled);
      setWorkspaceSlackSendDigests(cachedSettings.sendDigests);
      setWorkspaceSlackWebhookDraft("");
      setWorkspaceSlackLoading(false);
      return;
    }

    setWorkspaceSlackLoading(true);
    try {
      const res = await fetch("/api/workspaces/slack");
      const payload = (await res.json().catch(() => ({}))) as WorkspaceSlackResponse;
      if (!res.ok || !payload.settings) {
        throw new Error(payload?.error || "Failed to load Slack settings");
      }

      setWorkspaceSlackSettings(payload.settings);
      setWorkspaceSlackEnabled(payload.settings.enabled);
      setWorkspaceSlackSendDigests(payload.settings.sendDigests);
      setWorkspaceSlackWebhookDraft("");
      writeSessionCache(cacheKey, payload.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Slack settings");
    } finally {
      setWorkspaceSlackLoading(false);
    }
  }

  async function loadWorkspaceSlackDestinations() {
    const cacheKey = buildScopedCacheKey(
      WORKSPACE_SLACK_DESTINATIONS_CACHE_KEY,
      activeWorkspaceId,
    );
    const cachedDestinations = readSessionCache<WorkspaceSlackDestination[]>(
      cacheKey,
    );
    if (cachedDestinations) {
      setWorkspaceSlackDestinations(cachedDestinations);
      return;
    }

    try {
      const res = await fetch("/api/workspaces/slack/destinations");
      const payload = (await res.json().catch(() => ({}))) as WorkspaceSlackDestinationsResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load Slack destinations");
      }

      const nextDestinations = payload.destinations || [];
      setWorkspaceSlackDestinations(nextDestinations);
      writeSessionCache(cacheKey, nextDestinations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Slack destinations");
    }
  }

  async function loadNotificationPreferences() {
    const cachedPreferences = readSessionCache<UserNotificationPreferences>(
      NOTIFICATION_PREFERENCES_CACHE_KEY,
    );
    if (cachedPreferences) {
      setNotificationPreferences(cachedPreferences);
      setMentionEmailEnabled(cachedPreferences.mentionEmailEnabled);
      setMentionInAppEnabled(cachedPreferences.mentionInAppEnabled);
      setDigestEmailEnabled(cachedPreferences.digestEmailEnabled);
      setNotificationPreferencesLoading(false);
      return;
    }

    setNotificationPreferencesLoading(true);
    try {
      const res = await fetch("/api/notifications/preferences");
      const payload = (await res.json().catch(() => ({}))) as UserNotificationPreferencesResponse;
      if (!res.ok || !payload.preferences) {
        throw new Error(payload?.error || "Failed to load notification preferences");
      }

      setNotificationPreferences(payload.preferences);
      setMentionEmailEnabled(payload.preferences.mentionEmailEnabled);
      setMentionInAppEnabled(payload.preferences.mentionInAppEnabled);
      setDigestEmailEnabled(payload.preferences.digestEmailEnabled);
      writeSessionCache(NOTIFICATION_PREFERENCES_CACHE_KEY, payload.preferences);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load notification preferences",
      );
    } finally {
      setNotificationPreferencesLoading(false);
    }
  }

  async function loadWorkspaceNotionSettings() {
    const cacheKey = buildScopedCacheKey(WORKSPACE_NOTION_CACHE_KEY, activeWorkspaceId);
    const cachedSettings = readSessionCache<WorkspaceNotionSettings>(
      cacheKey,
    );
    if (cachedSettings) {
      setWorkspaceNotionSettings(cachedSettings);
      setWorkspaceNotionEnabled(cachedSettings.enabled);
      setWorkspaceNotionTokenDraft("");
      setWorkspaceNotionParentPageDraft(cachedSettings.parentPageId || "");
      setWorkspaceNotionLoading(false);
      return;
    }

    setWorkspaceNotionLoading(true);
    try {
      const res = await fetch("/api/workspaces/notion");
      const payload = (await res.json().catch(() => ({}))) as WorkspaceNotionResponse;
      if (!res.ok || !payload.settings) {
        throw new Error(payload?.error || "Failed to load Notion settings");
      }

      setWorkspaceNotionSettings(payload.settings);
      setWorkspaceNotionEnabled(payload.settings.enabled);
      setWorkspaceNotionTokenDraft("");
      setWorkspaceNotionParentPageDraft(payload.settings.parentPageId || "");
      writeSessionCache(cacheKey, payload.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Notion settings");
    } finally {
      setWorkspaceNotionLoading(false);
    }
  }

  async function loadWorkspacePeople() {
    const cacheKey = buildScopedCacheKey(WORKSPACE_PEOPLE_CACHE_KEY, activeWorkspaceId);
    const cachedPeople = readSessionCache<{
      members: WorkspaceMemberEntry[];
      invites: WorkspaceInviteEntry[];
    }>(cacheKey);
    if (cachedPeople) {
      setWorkspaceMembers(cachedPeople.members);
      setWorkspaceInvites(cachedPeople.invites);
      setWorkspacePeopleLoading(false);
      return;
    }

    setWorkspacePeopleLoading(true);
    try {
      const [membersRes, invitesRes] = await Promise.all([
        fetch("/api/workspaces/members"),
        fetch("/api/workspaces/invites"),
      ]);

      const membersPayload = (await membersRes.json()) as WorkspaceMembersResponse;
      const invitesPayload = (await invitesRes.json()) as WorkspaceInvitesResponse;

      if (!membersRes.ok) {
        throw new Error(membersPayload?.error || "Failed to load workspace members");
      }
      if (!invitesRes.ok) {
        throw new Error(invitesPayload?.error || "Failed to load workspace invites");
      }

      const nextPeople = {
        members: membersPayload.members || [],
        invites: invitesPayload.invites || [],
      };
      setWorkspaceMembers(nextPeople.members);
      setWorkspaceInvites(nextPeople.invites);
      writeSessionCache(cacheKey, nextPeople);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load workspace people",
      );
    } finally {
      setWorkspacePeopleLoading(false);
    }
  }

  async function loadWorkspaceActivity() {
    const cacheKey = buildScopedCacheKey(WORKSPACE_ACTIVITY_CACHE_KEY, activeWorkspaceId);
    const cachedActivity = readSessionCache<WorkspaceActivityEntry[]>(
      cacheKey,
    );
    if (cachedActivity) {
      setWorkspaceActivity(cachedActivity);
      setWorkspaceActivityLoading(false);
      return;
    }

    setWorkspaceActivityLoading(true);
    try {
      const res = await fetch("/api/workspaces/activity");
      const payload = (await res.json()) as WorkspaceActivityResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load workspace activity");
      }

      const nextActivity = payload.activity || [];
      setWorkspaceActivity(nextActivity);
      writeSessionCache(cacheKey, nextActivity);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load workspace activity",
      );
    } finally {
      setWorkspaceActivityLoading(false);
    }
  }

  async function loadWorkspaceTasks() {
    const cacheKey = buildScopedCacheKey(WORKSPACE_TASKS_CACHE_KEY, activeWorkspaceId);
    const cachedTasks = readSessionCache<ActionTask[]>(cacheKey);
    if (cachedTasks) {
      setWorkspaceTasks(cachedTasks);
      setWorkspaceTasksLoading(false);
      return;
    }

    setWorkspaceTasksLoading(true);
    try {
      const res = await fetch("/api/tasks");
      const payload = (await res.json().catch(() => ({}))) as TasksResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load workspace tasks");
      }

      const nextTasks = payload.tasks || [];
      setWorkspaceTasks(nextTasks);
      writeSessionCache(cacheKey, nextTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspace tasks");
    } finally {
      setWorkspaceTasksLoading(false);
    }
  }

  const loadProjectInsights = useCallback(async (projectId: string) => {
    if (!projectId || projectId === "all") {
      setSavedProjectInsights([]);
      setSelectedProjectInsightId(null);
      return;
    }

    setProjectInsightsLoading(true);
    try {
      const res = await fetch(
        `/api/intelligence/project/insights?projectId=${encodeURIComponent(projectId)}`,
      );
      const payload = (await res.json().catch(() => ({}))) as ProjectInsightsResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load saved insights");
      }

      setSavedProjectInsights(sortProjectInsights(payload.insights || []));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load saved insights");
    } finally {
      setProjectInsightsLoading(false);
    }
  }, []);

  const loadWorkspaceInsights = useCallback(async () => {
    setWorkspaceInsightsLoading(true);
    try {
      const res = await fetch("/api/intelligence/workspace/insights");
      const payload = (await res.json().catch(() => ({}))) as WorkspaceInsightsResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load workspace insights");
      }

      setSavedWorkspaceInsights(
        sortProjectInsights(payload.insights || []) as SavedWorkspaceInsight[],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspace insights");
    } finally {
      setWorkspaceInsightsLoading(false);
    }
  }, []);

  async function loadNotifications() {
    setNotificationsLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const payload = (await res.json()) as NotificationsResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load notifications");
      }

      setNotifications(payload.notifications || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      setNotificationsLoading(false);
    }
  }

  useEffect(() => {
    const tombstone = readDeletedWorkspaceTombstone();
    if (!tombstone) {
      return;
    }

    setDeletedWorkspaceName(tombstone.name);
    setActiveWorkspace(null);
    setWorkspaceDraftName("");
    setItems([]);
    setAllItems([]);
    setProjects([]);
  }, []);

  useEffect(() => {
    function handleWorkspaceSwitched() {
      clearDeletedWorkspaceTombstone();
      setDeletedWorkspaceName(null);
      resetWorkspaceScopedState();
      void loadWorkspaces();
    }

    window.addEventListener("voxly:workspace-switched", handleWorkspaceSwitched);
    return () => {
      window.removeEventListener("voxly:workspace-switched", handleWorkspaceSwitched);
    };
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId) {
      return;
    }

    if (
      lastWorkspaceIdRef.current &&
      lastWorkspaceIdRef.current !== activeWorkspaceId
    ) {
      resetWorkspaceScopedState();
    }

    lastWorkspaceIdRef.current = activeWorkspaceId;
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!activeWorkspaceId) {
      return;
    }

    void loadItems();
  }, [activeWorkspaceId, loadItems]);

  useEffect(() => {
    if (!projects.length) {
      setIntelligenceProjectId("all");
      setWorkspaceIntelligenceProjectIds([]);
      return;
    }

    if (projectFilter !== "all" && projects.some((project) => project.id === projectFilter)) {
      setIntelligenceProjectId(projectFilter);
      setWorkspaceIntelligenceProjectIds([projectFilter]);
      return;
    }

    setIntelligenceProjectId((prev) => {
      if (prev !== "all" && projects.some((project) => project.id === prev)) {
        return prev;
      }

      return projects[0]?.id || "all";
    });
    setWorkspaceIntelligenceProjectIds((prev) =>
      prev.filter((projectId) => projects.some((project) => project.id === projectId)),
    );
  }, [projectFilter, projects]);

  useEffect(() => {
    if (intelligenceProjectId === "all") {
      setSavedProjectInsights([]);
      setSelectedProjectInsightId(null);
      return;
    }

    void loadProjectInsights(intelligenceProjectId);
  }, [intelligenceProjectId, loadProjectInsights]);

  useEffect(() => {
    if (assistantScope !== "workspace") {
      return;
    }

    void loadWorkspaceInsights();
  }, [assistantScope, loadWorkspaceInsights]);

  useEffect(() => {
    if (intelligenceScope !== "project") {
      return;
    }

    void loadProjectDigestSettings(intelligenceProjectId);
  }, [intelligenceProjectId, intelligenceScope, loadProjectDigestSettings]);

  useEffect(() => {
    void loadWorkspaces();
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId) {
      return;
    }

    void loadBilling();
    void loadTemplates();
    void loadProjects();
    // Workspace-scoped loaders intentionally rerun only when the active workspace changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!isSettingsSurface || !activeWorkspaceId) {
      return;
    }

    if (settingsSection === "delivery") {
      void loadWorkspaceDigestSettings();
      void loadReportTemplates();
      void loadReportRuns();
      void loadReportRunSummary();
      return;
    }

    if (settingsSection === "integrations") {
      void loadWorkspaceSlackSettings();
      void loadWorkspaceSlackDestinations();
      void loadWorkspaceNotionSettings();
      return;
    }

    if (settingsSection === "access") {
      void loadWorkspacePeople();
      void loadWorkspaceActivity();
      return;
    }

    if (settingsSection === "personal") {
      void loadNotificationPreferences();
    }
    // Settings loaders intentionally rerun only for workspace/section changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeWorkspaceId,
    isSettingsSurface,
    settingsSection,
    loadReportRunSummary,
    loadReportRuns,
  ]);

  useEffect(() => {
    if (
      !shouldScrollToSummaryRef.current ||
      !focusedSummaryId ||
      !focusedSummary ||
      focusedSummary.status !== "done"
    ) {
      return;
    }

    shouldScrollToSummaryRef.current = false;
    resultAreaRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [focusedSummary, focusedSummaryId]);

  useEffect(() => {
    return () => {
      if (listRequestAbortRef.current) {
        listRequestAbortRef.current.abort();
      }
      if (uploadNoticeTimeoutRef.current) {
        clearTimeout(uploadNoticeTimeoutRef.current);
      }
      if (uploadStatusTimeoutRef.current) {
        clearTimeout(uploadStatusTimeoutRef.current);
      }
      if (tipsTimeoutRef.current) {
        clearTimeout(tipsTimeoutRef.current);
      }
    };
  }, []);

  function showCompletionTip(message: string) {
    setCompletionTip(message);

    if (tipsTimeoutRef.current) {
      clearTimeout(tipsTimeoutRef.current);
    }

    tipsTimeoutRef.current = setTimeout(() => {
      setCompletionTip(null);
      tipsTimeoutRef.current = null;
    }, 4500);
  }

  function showUploadVisibilityNotice(message: string) {
    setUploadVisibilityNotice(message);

    if (uploadNoticeTimeoutRef.current) {
      clearTimeout(uploadNoticeTimeoutRef.current);
    }

    uploadNoticeTimeoutRef.current = setTimeout(() => {
      setUploadVisibilityNotice(null);
      uploadNoticeTimeoutRef.current = null;
    }, 5000);
  }

  function showUploadStatusNotice(message: string) {
    setUploadStatusNotice(message);

    if (uploadStatusTimeoutRef.current) {
      clearTimeout(uploadStatusTimeoutRef.current);
    }

    uploadStatusTimeoutRef.current = setTimeout(() => {
      setUploadStatusNotice(null);
      uploadStatusTimeoutRef.current = null;
    }, 4500);
  }

  function showCopyStatus(message: string) {
    setCopyStatus(message);
    window.setTimeout(() => {
      setCopyStatus((current) => (current === message ? null : current));
    }, 2500);
  }

  function buildInsightTitle(question: string) {
    const trimmed = question.trim();
    if (!trimmed) {
      return "Project insight";
    }

    const withoutTrailingPunctuation = trimmed.replace(/[.?!]+$/, "");
    return withoutTrailingPunctuation.length > 80
      ? `${withoutTrailingPunctuation.slice(0, 77)}...`
      : withoutTrailingPunctuation;
  }

  function sortProjectInsights(insights: SavedProjectInsight[]) {
    return [...insights].sort((a, b) => {
      if (Boolean(a.archivedAt) !== Boolean(b.archivedAt)) {
        return a.archivedAt ? 1 : -1;
      }

      if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
        return a.isPinned ? -1 : 1;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  function buildSummaryText(
    item:
      | Pick<Transcription, "decisions" | "keyPoints" | "nextSteps" | "actionItems">
      | null,
  ) {
    if (!item) {
      return "";
    }

    const sections = [
      {
        title: "Decisions",
        items: item.decisions || [],
      },
      {
        title: "Key Points",
        items: item.keyPoints || [],
      },
      {
        title: "Next Steps",
        items: item.nextSteps || [],
      },
    ];

    const summarySections = sections
      .map((section) => {
        const body = section.items.length
          ? section.items.map((entry) => `- ${entry}`).join("\n")
          : "- None";
        return `${section.title}\n${body}`;
      })
      .join("\n\n");

    const actionItems = item.actionItems?.length
      ? item.actionItems
          .map(
            (actionItem) =>
              `- ${actionItem.text} [${actionItem.priority || "MEDIUM"}] @${
                actionItem.assignee || "Unassigned"
              }`,
          )
          .join("\n")
      : "- None";

    return [
      summarySections,
      "",
      `Action Items\n${actionItems}`,
    ].join("\n");
  }

  async function handleCopyText(label: string, value: string) {
    if (!value.trim()) {
      return;
    }

    await navigator.clipboard.writeText(value);
    showCopyStatus(`${label} copied.`);
  }

  async function handleCopyInsightForNotion(
    scope: "project" | "workspace",
    insightId: string,
  ) {
    setError(null);
    try {
      const res = await fetch(
        scope === "project"
          ? `/api/intelligence/project/insights/${encodeURIComponent(insightId)}/export`
          : `/api/intelligence/workspace/insights/${encodeURIComponent(insightId)}/export`,
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to copy Notion export");
      }

      const markdown = await res.text();
      await handleCopyText("Notion export", markdown);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to copy Notion export");
    }
  }

  async function handleExportInsightMarkdown(
    scope: "project" | "workspace",
    insightId: string,
  ) {
    setExportBusy(`insight:${scope}:${insightId}`);
    setError(null);

    try {
      const res = await fetch(
        scope === "project"
          ? `/api/intelligence/project/insights/${encodeURIComponent(insightId)}/export`
          : `/api/intelligence/workspace/insights/${encodeURIComponent(insightId)}/export`,
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Insight export failed");
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Insight export failed");
    } finally {
      setExportBusy(null);
    }
  }

  const loadAssistantMessages = useCallback(async (transcriptionId: string) => {
    const requestWorkspaceId = activeWorkspaceId;
    assistantRequestAbortRef.current?.abort();
    const abortController = new AbortController();
    assistantRequestAbortRef.current = abortController;
    setAssistantHistoryLoading(true);
    setAssistantError(null);

    try {
      const res = await fetch(
        `/api/assistant/chat?transcriptionId=${encodeURIComponent(transcriptionId)}`,
        { signal: abortController.signal },
      );
      const payload = await res.json().catch(() => ({}));
      if (
        assistantRequestAbortRef.current !== abortController ||
        requestWorkspaceId !== activeWorkspaceId
      ) {
        return;
      }
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load assistant history");
      }

      const nextMessages = Array.isArray(payload?.messages)
        ? (payload.messages as AssistantMessage[])
        : [];
      setAssistantMessages(
        nextMessages.length
          ? [...defaultAssistantMessages, ...nextMessages]
          : defaultAssistantMessages,
      );
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setAssistantMessages(defaultAssistantMessages);
      setAssistantError(
        err instanceof Error ? err.message : "Failed to load assistant history.",
      );
    } finally {
      if (assistantRequestAbortRef.current === abortController) {
        assistantRequestAbortRef.current = null;
        setAssistantHistoryLoading(false);
      }
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    setAssistantSummary(null);
    setAssistantError(null);

    if (assistantScope !== "transcript") {
      return;
    }

    if (!activeTranscriptionId) {
      setAssistantMessages(defaultAssistantMessages);
      return;
    }

    void loadAssistantMessages(activeTranscriptionId);
  }, [activeTranscriptionId, assistantScope, loadAssistantMessages]);

  useEffect(() => {
    if (focusedSummary?.projectId && assistantProjectId === "all") {
      setAssistantProjectId(focusedSummary.projectId);
    }
  }, [focusedSummary?.projectId, assistantProjectId]);

  const loadComments = useCallback(async (input: {
    transcriptionId?: string;
    taskId?: string;
    projectInsightId?: string;
    workspaceInsightId?: string;
  }) => {
    const requestWorkspaceId = activeWorkspaceId;
    const params = new URLSearchParams();
    if (input.transcriptionId) {
      params.set("transcriptionId", input.transcriptionId);
    }
    if (input.taskId) {
      params.set("taskId", input.taskId);
    }
    if (input.projectInsightId) {
      params.set("projectInsightId", input.projectInsightId);
    }
    if (input.workspaceInsightId) {
      params.set("workspaceInsightId", input.workspaceInsightId);
    }

    const abortController = new AbortController();
    commentsRequestAbortControllersRef.current.add(abortController);
    try {
      const res = await fetch(`/api/comments?${params.toString()}`, {
        signal: abortController.signal,
      });
      const payload = (await res.json()) as CommentsResponse;
      if (
        !commentsRequestAbortControllersRef.current.has(abortController) ||
        requestWorkspaceId !== activeWorkspaceId
      ) {
        return;
      }
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load comments");
      }

      const entityId =
        input.transcriptionId ??
        input.taskId ??
        input.projectInsightId ??
        input.workspaceInsightId;
      if (entityId) {
        dispatchComments({ type: "SET", entityId, comments: payload.comments || [] });
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load comments");
    } finally {
      commentsRequestAbortControllersRef.current.delete(abortController);
    }
  }, [activeWorkspaceId]);

  const loadActionTasks = useCallback(async (transcriptionId: string) => {
    const requestWorkspaceId = activeWorkspaceId;
    try {
      tasksRequestAbortRef.current?.abort();
      const abortController = new AbortController();
      tasksRequestAbortRef.current = abortController;
      const res = await fetch(
        `/api/tasks?transcriptionId=${encodeURIComponent(transcriptionId)}`,
        { signal: abortController.signal },
      );
      const payload = (await res.json().catch(() => ({}))) as TasksResponse;
      if (
        tasksRequestAbortRef.current !== abortController ||
        requestWorkspaceId !== activeWorkspaceId
      ) {
        return;
      }
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load tasks");
      }

      setActionTasksByTranscription((prev) => ({
        ...prev,
        [transcriptionId]: payload.tasks || [],
      }));
      await Promise.all(
        (payload.tasks || []).map((task) => loadComments({ taskId: task.id })),
      );
      if (tasksRequestAbortRef.current === abortController) {
        tasksRequestAbortRef.current = null;
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    }
  }, [activeWorkspaceId, loadComments]);

  useEffect(() => {
    if (!activeTranscriptionId) {
      return;
    }

    void loadActionTasks(activeTranscriptionId);
  }, [activeTranscriptionId, loadActionTasks]);

  useEffect(() => {
    if (!activeTranscriptionId) {
      return;
    }

    void loadComments({ transcriptionId: activeTranscriptionId });
  }, [activeTranscriptionId, loadComments]);

  useEffect(() => {
    if (!selectedProjectInsightId) {
      return;
    }

    void loadComments({ projectInsightId: selectedProjectInsightId });
  }, [selectedProjectInsightId, loadComments]);

  useEffect(() => {
    if (!selectedWorkspaceInsightId) {
      return;
    }

    void loadComments({ workspaceInsightId: selectedWorkspaceInsightId });
  }, [selectedWorkspaceInsightId, loadComments]);

  useEffect(() => {
    if (workspaceSurface !== "overview") {
      return;
    }

    const pendingFocusId = window.sessionStorage.getItem("voxly:overview-focus");
    if (!pendingFocusId) {
      return;
    }

    setFocusedSummaryId(pendingFocusId);
    window.sessionStorage.removeItem("voxly:overview-focus");
  }, [workspaceSurface]);

  function pollForProcessedResult(id: string): Promise<Awaited<ReturnType<typeof loadTranscriptionById>>> {
    return new Promise((resolve) => {
      let attempt = 0;
      let lastSeenId: string | null = null;

      async function tick() {
        const item = await loadTranscriptionById(id);

        if (!item) {
          scheduleNext();
          return;
        }

        // Only call setState when the focused item actually changes
        if (item.id !== lastSeenId) {
          lastSeenId = item.id;
          setFocusedSummaryId(item.id);
        }

        if (item.status === "done" || item.status === "error") {
          clearTranscriptionCaches();
          void loadBilling({ force: true });
          resolve(item);
          return;
        }

        attempt += 1;
        if (attempt >= 30) {
          resolve(null);
          return;
        }

        scheduleNext();
      }

      function scheduleNext() {
        // Gradual backoff: 2s → 2.2s → 2.4s … capped at 8s
        const delay = Math.min(2000 + attempt * 200, 8000);
        window.setTimeout(() => void tick(), delay);
      }

      void tick();
    });
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    setAssistantError(null);
    setAssistantSummary(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      formData.append("template", uploadTemplate);
      if (uploadProjectId !== "none") {
        formData.append("projectId", uploadProjectId);
      }
      if (estimatedDurationSeconds) {
        formData.append(
          "estimatedDurationSeconds",
          String(estimatedDurationSeconds),
        );
      }

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Upload failed");
      }
      clearTranscriptionCaches();
      clearScopedCache(BILLING_CACHE_KEY, activeWorkspaceId);
      const uploadedProjectId =
        typeof payload?.projectId === "string" && payload.projectId.trim()
          ? payload.projectId
          : uploadProjectId === "none"
            ? null
            : uploadProjectId;
      const optimisticItem: Transcription | null = payload?.transcriptionId
        ? {
            id: payload.transcriptionId,
            fileName: file.name,
            status: payload?.processedInline ? "done" : payload?.queued ? "processing" : "uploaded",
            template: uploadTemplate,
            projectId: uploadedProjectId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            duration: estimatedDurationSeconds
              ? Math.round(estimatedDurationSeconds)
              : null,
            transcript: null,
            decisions: [],
            keyPoints: [],
            nextSteps: [],
            actionItems: [],
          }
        : null;

      if (optimisticItem) {
        upsertTranscriptionEverywhere(optimisticItem);
        setFocusedSummaryId(optimisticItem.id);
        shouldScrollToSummaryRef.current = true;
        if (!matchesCurrentFilters(optimisticItem)) {
          showUploadVisibilityNotice(
            "Your upload was added, but it is hidden by the current search or filters.",
          );
        }
      }

      setFile(null);
      setEstimatedDurationSeconds(null);
      setOverviewUploadPanelStartExpanded(false);
      setOverviewUploadPanelVersion((prev) => prev + 1);
      const initialItem =
        payload?.transcriptionId
          ? await loadTranscriptionById(payload.transcriptionId)
          : null;
      if (initialItem?.id) {
        setFocusedSummaryId(initialItem.id);
      }
      await loadBilling({ force: true });
      setUploading(false);

      if (payload?.transcriptionId) {
        router.push(`/session/${payload.transcriptionId}`);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  }

  async function handleLoadTestData() {
    setError(null);
    setTestDataStatus(null);
    setTestDataLoading(true);

    try {
      const res = await fetch(
        `/api/transcriptions/training-data?template=${encodeURIComponent(uploadTemplate)}`,
      );
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load test data");
      }
      setTestDataStatus("Test data loaded successfully.");
      clearTranscriptionCaches();
      await loadItems({ force: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load test data");
    } finally {
      setTestDataLoading(false);
    }
  }

  async function handleProcess(
    id: string,
    template?: string | null,
    trackInParent = true,
  ) {
    setError(null);
    setAssistantError(null);
    setAssistantSummary(null);
    shouldScrollToSummaryRef.current = true;
    setFocusedSummaryId(id);
    setOverviewUploadPanelStartExpanded(false);
    setOverviewUploadPanelVersion((prev) => prev + 1);
    if (trackInParent) {
      setProcessingIds((prev) => ({ ...prev, [id]: true }));
    }
    try {
      const res = await fetch("/api/transcriptions/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcriptionId: id,
          template: template || undefined,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Processing failed");
      }
      clearTranscriptionCaches();
      clearScopedCache(BILLING_CACHE_KEY, activeWorkspaceId);
      let currentItem = await loadTranscriptionById(id);
      await loadBilling({ force: true });

      window.sessionStorage.setItem("voxly:overview-focus", id);
      setWorkspaceSurface("overview");

      if (pathname !== "/dashboard") {
        router.push("/dashboard");
      }

      if (
        payload?.queued ||
        currentItem?.status === "processing" ||
        currentItem?.status === "uploaded"
      ) {
        currentItem = await pollForProcessedResult(id);
      }

      if (currentItem?.status === "done") {
        shouldScrollToSummaryRef.current = true;
        setFocusedSummaryId(currentItem.id);
        setOverviewDetailsAutoOpenToken((prev) => prev + 1);
        showCompletionTip(
          "Voxly is ready. Try a prompt below to summarize, assign owners, or draft a follow-up.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
    } finally {
      if (trackInParent) {
        setProcessingIds((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm(
      "Delete this transcription from history? This cannot be undone.",
    );
    if (!confirmed) return;

    setError(null);
    try {
      const res = await fetch("/api/transcriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Delete failed");
      }

      setAllItems((prev) => prev.filter((item) => item.id !== id));
      if (focusedSummaryId === id) {
        setFocusedSummaryId(null);
        setAssistantSummary(null);
      }
      setActionTasksByTranscription((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      clearTranscriptionCaches();
      await loadItems({ force: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function handleRefreshNotes() {
    if (assistantScope !== "transcript") {
      setAssistantSummary(null);
      setAssistantError(null);
      setAssistantMessages(defaultAssistantMessages);
      return;
    }

    setAssistantRefreshing(true);
    setAssistantError(null);

    try {
      const nextItems = await loadItems({ showLoading: false, force: true });
      setAssistantSummary(null);

      const nextFocusedSummary =
        (focusedSummaryId
          ? nextItems?.find((item) => item.id === focusedSummaryId) || null
          : null) ||
        nextItems?.find((item) => item.status === "done") ||
        null;

      if (!nextFocusedSummary) {
        setAssistantError("No saved notes are available to refresh yet.");
        return;
      }

      shouldScrollToSummaryRef.current = true;
      setFocusedSummaryId(nextFocusedSummary.id);
      await loadAssistantMessages(nextFocusedSummary.id);
    } catch (err) {
      setAssistantError(
        err instanceof Error ? err.message : "Failed to refresh notes.",
      );
    } finally {
      setAssistantRefreshing(false);
    }
  }

  async function handleAssistantSubmitWithContext(input: {
    text: string;
    scope: AssistantScope;
    projectId: string;
    workspaceProjectIds: string[];
  }) {
    const text = input.text.trim();
    const activeSummary = focusedSummary;
    if (!text) return;

    if (input.scope === "transcript" && !activeSummary) {
      setAssistantError("No summary available yet.");
      return;
    }
    if (input.scope === "project" && input.projectId === "all") {
      setAssistantError("Choose a project before asking across recordings.");
      return;
    }

    setAssistantBusy(true);
    setAssistantError(null);
    setAssistantScope(input.scope);
    setAssistantProjectId(input.projectId);
    setAssistantWorkspaceProjectIds(input.workspaceProjectIds);
    const nextMessages: typeof assistantMessages = [
      ...assistantMessages,
      { role: "user", content: text },
    ];
    setAssistantMessages(nextMessages);
    try {
      if (input.scope !== "transcript") {
        const endpoint =
          input.scope === "workspace"
            ? "/api/intelligence/workspace"
            : "/api/intelligence/project";
        const body =
          input.scope === "workspace"
            ? {
                question: text,
                ...(input.workspaceProjectIds.length
                  ? { projectIds: input.workspaceProjectIds }
                  : {}),
              }
            : {
                projectId: input.projectId,
                question: text,
              };

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = (await res.json().catch(() => ({}))) as ProjectIntelligenceResponse;
        if (!res.ok) {
          throw new Error(
            payload?.error ||
              (input.scope === "workspace"
                ? "Assistant workspace query failed"
                : "Assistant project query failed"),
          );
        }

        const assistantReply = formatIntelligenceAssistantReply(payload);
        setAssistantMessages((prev) => [
          ...prev,
          { role: "assistant", content: assistantReply },
        ]);

        setIntelligenceScope(input.scope === "workspace" ? "workspace" : "project");
        setIntelligenceQuestion(text);
        setIntelligenceResult(payload);
        setSelectedProjectInsightId(null);
        setSelectedWorkspaceInsightId(null);
        if (input.scope === "project") {
          setIntelligenceProjectId(input.projectId);
          setIntelligenceTitleDraft(buildInsightTitle(text));
        } else {
          setWorkspaceIntelligenceProjectIds(input.workspaceProjectIds);
          setIntelligenceTitleDraft("");
        }
        return;
      }

      const transcriptSummary = activeSummary;
      if (!transcriptSummary) {
        throw new Error("No summary available yet.");
      }

      const summaryPayload = {
        decisions: transcriptSummary.decisions || [],
        keyPoints: transcriptSummary.keyPoints || [],
        nextSteps: transcriptSummary.nextSteps || [],
        actionItems: transcriptSummary.actionItems || [],
      };

      const [editResp, chatResp] = await Promise.all([
        fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text, summary: summaryPayload }),
        }).then(async (response) => ({
          ok: response.ok,
          data: await response.json().catch(() => ({})),
        })),
        fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcriptionId: transcriptSummary.id,
            messages: nextMessages,
            summary: summaryPayload,
          }),
        }).then(async (response) => ({
          ok: response.ok,
          data: await response.json().catch(() => ({})),
        })),
      ]);

      if (!editResp.ok) {
        throw new Error(editResp.data?.error || "Assistant edit failed");
      }
      if (!chatResp.ok) {
        throw new Error(chatResp.data?.error || "Assistant chat failed");
      }

      const updatedSummary = editResp.data?.summary || null;
      setAssistantSummary(updatedSummary);
      if (updatedSummary && activeSummary?.id) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === activeSummary.id
              ? {
                  ...item,
                  decisions: updatedSummary.decisions || [],
                  keyPoints: updatedSummary.keyPoints || [],
                  nextSteps: updatedSummary.nextSteps || [],
                  actionItems: updatedSummary.actionItems || [],
                }
              : item,
          ),
        );
        setAllItems((prev) =>
          prev.map((item) =>
            item.id === activeSummary.id
              ? {
                  ...item,
                  decisions: updatedSummary.decisions || [],
                  keyPoints: updatedSummary.keyPoints || [],
                  nextSteps: updatedSummary.nextSteps || [],
                  actionItems: updatedSummary.actionItems || [],
                }
              : item,
          ),
        );
      }
      const assistantReply = chatResp.data?.message || "(No reply)";
      setAssistantMessages((prev) => {
        const newMessages: typeof assistantMessages = [
          ...prev,
          { role: "assistant", content: assistantReply },
        ];
        return newMessages;
      });
    } catch (err) {
      setAssistantError(
        err instanceof Error ? err.message : "Assistant request failed",
      );
      setAssistantMessages((prev) => {
        const errorMessages: typeof assistantMessages = [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I couldn't update the notes. Please try again.",
          },
        ];
        return errorMessages;
      });
    } finally {
      setAssistantBusy(false);
    }
  }

  async function handleCreateTemplate(input: {
    name: string;
    baseTemplate: string;
    promptInstructions: string;
  }) {
    setTemplateBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: input.name,
          baseTemplate: input.baseTemplate,
          promptInstructions: input.promptInstructions,
        }),
      });
      const payload = (await res.json()) as TemplatesResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to create template");
      }

      clearScopedCache(TEMPLATES_CACHE_KEY, activeWorkspaceId);
      await loadTemplates();
      if (payload.template?.id) {
        setUploadTemplate(`custom:${payload.template.id}`);
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template");
      return false;
    } finally {
      setTemplateBusy(false);
    }
  }

  async function handleCreateProject(input: {
    name: string;
    description: string;
  }) {
    setProjectBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: input.name,
          description: input.description,
        }),
      });
      const payload = (await res.json()) as ProjectsResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to create project");
      }

      clearScopedCache(PROJECTS_CACHE_KEY, activeWorkspaceId);
      clearSessionCacheKey(WORKSPACES_CACHE_KEY);
      await loadProjects({ force: true });
      if (payload.project?.id) {
        setUploadProjectId(payload.project.id);
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      return false;
    } finally {
      setProjectBusy(false);
    }
  }

  async function handleAssignProject(transcriptionId: string, projectId: string) {
    setError(null);
    try {
      const nextProjectId = projectId === "none" ? null : projectId;
      const res = await fetch("/api/transcriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: transcriptionId, projectId: nextProjectId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to update project");
      }

      setItems((prev) =>
        prev.map((item) =>
          item.id === transcriptionId ? { ...item, projectId: nextProjectId } : item,
        ),
      );
      setAllItems((prev) =>
        prev.map((item) =>
          item.id === transcriptionId ? { ...item, projectId: nextProjectId } : item,
        ),
      );
      clearTranscriptionCaches();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project");
      return false;
    }
  }

  async function handleInviteWorkspaceMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviteBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/workspaces/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      });
      const payload = (await res.json()) as WorkspaceInvitesResponse;
      if (!res.ok || !payload.invite) {
        throw new Error(payload?.error || "Failed to send invite");
      }

      setInviteEmail("");
      setInviteRole("member");
      setWorkspaceInvites((prev) => [payload.invite!, ...prev]);
      clearScopedCache(WORKSPACE_PEOPLE_CACHE_KEY, activeWorkspaceId);
      clearScopedCache(WORKSPACE_ACTIVITY_CACHE_KEY, activeWorkspaceId);
      await loadWorkspaceActivity();
      showUploadStatusNotice("Invitation sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleRenameWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = workspaceDraftName.trim();
    if (!nextName || !activeWorkspace || nextName === activeWorkspace.name) {
      return;
    }

    setWorkspaceSettingsBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/workspaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });
      const payload = (await res.json().catch(() => ({}))) as WorkspacesResponse;
      if (!res.ok || !payload.workspace) {
        throw new Error(payload?.error || "Failed to update workspace");
      }

      setActiveWorkspace(payload.workspace);
      setWorkspaceDraftName(payload.workspace.name);
      clearSessionCacheKey(WORKSPACES_CACHE_KEY);
      clearScopedCache(WORKSPACE_ACTIVITY_CACHE_KEY, activeWorkspaceId);
      await loadWorkspaceActivity();
      showUploadStatusNotice("Workspace updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update workspace");
    } finally {
      setWorkspaceSettingsBusy(false);
    }
  }

  async function handleSaveWorkspaceDigestSettings(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setWorkspaceDigestBusy("save");
    setError(null);

    try {
      const res = await fetch("/api/workspaces/digest", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: workspaceDigestEnabled,
          cadence: workspaceDigestCadence,
          reportType: workspaceDigestReportType,
          weekday: Number(workspaceDigestWeekday),
          dayOfMonth: Number(workspaceDigestDayOfMonth),
          hourLocal: Number(workspaceDigestHour),
          timezone: browserTimeZone,
          recipientScope: workspaceDigestRecipientScope,
          sendEmail: workspaceDigestSendEmail,
          sendSlack: workspaceDigestSendSlack,
          slackDestinationId:
            workspaceDigestSlackDestinationId === "default"
              ? undefined
              : workspaceDigestSlackDestinationId,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as WorkspaceDigestResponse;
      if (!res.ok || !payload.settings) {
        throw new Error(payload?.error || "Failed to save digest settings");
      }

      setWorkspaceDigestSettings(payload.settings);
      setWorkspaceDigestEnabled(payload.settings.enabled);
      setWorkspaceDigestCadence(payload.settings.cadence);
      setWorkspaceDigestReportType(payload.settings.reportType);
      setWorkspaceDigestWeekday(String(payload.settings.weekday));
      setWorkspaceDigestDayOfMonth(String(payload.settings.dayOfMonth));
      setWorkspaceDigestHour(String(payload.settings.hourLocal));
      setWorkspaceDigestRecipientScope(payload.settings.recipientScope);
      setWorkspaceDigestSendEmail(payload.settings.sendEmail);
      setWorkspaceDigestSendSlack(payload.settings.sendSlack);
      writeSessionCache(
        buildScopedCacheKey(WORKSPACE_DIGEST_CACHE_KEY, activeWorkspaceId),
        payload.settings,
      );
      clearScopedCache(WORKSPACE_ACTIVITY_CACHE_KEY, activeWorkspaceId);
      await loadWorkspaceActivity();
      showUploadStatusNotice("Workspace digest settings updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save digest settings");
    } finally {
      setWorkspaceDigestBusy(null);
    }
  }

  async function handleSaveProjectDigestSettings(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!intelligenceProjectId || intelligenceProjectId === "all") {
      return;
    }

    setProjectDigestBusy("save");
    setError(null);

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(intelligenceProjectId)}/digest`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: projectDigestEnabled,
          cadence: projectDigestCadence,
          reportType: projectDigestReportType,
          weekday: Number(projectDigestWeekday),
          dayOfMonth: Number(projectDigestDayOfMonth),
          hourLocal: Number(projectDigestHour),
          timezone: browserTimeZone,
          recipientScope: projectDigestRecipientScope,
          sendEmail: projectDigestSendEmail,
          sendSlack: projectDigestSendSlack,
          slackDestinationId:
            projectDigestSlackDestinationId === "default"
              ? undefined
              : projectDigestSlackDestinationId,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as ProjectDigestResponse;
      if (!res.ok || !payload.settings) {
        throw new Error(payload?.error || "Failed to save project digest settings");
      }

      setProjectDigestSettings(payload.settings);
      setProjectDigestEnabled(payload.settings.enabled);
      setProjectDigestCadence(payload.settings.cadence);
      setProjectDigestReportType(payload.settings.reportType);
      setProjectDigestWeekday(String(payload.settings.weekday));
      setProjectDigestDayOfMonth(String(payload.settings.dayOfMonth));
      setProjectDigestHour(String(payload.settings.hourLocal));
      setProjectDigestRecipientScope(payload.settings.recipientScope);
      setProjectDigestSendEmail(payload.settings.sendEmail);
      setProjectDigestSendSlack(payload.settings.sendSlack);
      await loadWorkspaceActivity();
      showUploadStatusNotice("Project digest settings updated.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save project digest settings",
      );
    } finally {
      setProjectDigestBusy(null);
    }
  }

  async function handleSendProjectDigestNow() {
    if (!intelligenceProjectId || intelligenceProjectId === "all") {
      return;
    }

    setProjectDigestBusy("send");
    setError(null);

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(intelligenceProjectId)}/digest`, {
        method: "POST",
      });
      const payload = (await res.json().catch(() => ({}))) as ProjectDigestResponse;
      if (!res.ok || !payload.result) {
        throw new Error(payload?.error || "Failed to send project digest");
      }

      if (payload.settings) {
        setProjectDigestSettings(payload.settings);
      }
      await Promise.all([loadWorkspaceActivity(), loadNotifications(), loadReportRuns()]);
      await loadReportRunSummary();
      const deliveryParts = [
        payload.result.emailRecipientCount
          ? `emailed ${payload.result.emailRecipientCount} recipient${payload.result.emailRecipientCount === 1 ? "" : "s"}`
          : null,
        payload.result.slackDelivered ? "posted to Slack" : null,
      ].filter(Boolean);
      showUploadStatusNotice(
        deliveryParts.length
          ? `Project report ${deliveryParts.join(" and ")}.`
          : "Project report sent.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send project digest");
    } finally {
      setProjectDigestBusy(null);
    }
  }

  async function handleSendWorkspaceDigestNow() {
    setWorkspaceDigestBusy("send");
    setError(null);

    try {
      const res = await fetch("/api/workspaces/digest", {
        method: "POST",
      });
      const payload = (await res.json().catch(() => ({}))) as WorkspaceDigestResponse;
      if (!res.ok || !payload.result) {
        throw new Error(payload?.error || "Failed to send workspace digest");
      }

      if (payload.settings) {
        setWorkspaceDigestSettings(payload.settings);
      }
      await Promise.all([loadWorkspaceActivity(), loadNotifications(), loadReportRuns()]);
      await loadReportRunSummary();
      const deliveryParts = [
        payload.result.emailRecipientCount
          ? `emailed ${payload.result.emailRecipientCount} recipient${payload.result.emailRecipientCount === 1 ? "" : "s"}`
          : null,
        payload.result.slackDelivered ? "posted to Slack" : null,
      ].filter(Boolean);
      const slackSkipped = workspaceDigestSendSlack && !payload.result.slackDelivered;
      showUploadStatusNotice(
        deliveryParts.length
          ? `Workspace report ${deliveryParts.join(" and ")}.${slackSkipped ? " Slack delivery was skipped — check your Slack integration in Settings." : ""}`
          : "Workspace report sent.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send workspace digest");
    } finally {
      setWorkspaceDigestBusy(null);
    }
  }

  function applyReportTemplate(template: RecurringReportTemplate) {
    if (template.targetScope === "workspace") {
      setWorkspaceDigestCadence(template.cadence);
      setWorkspaceDigestReportType(template.reportType);
      setWorkspaceDigestWeekday(String(template.weekday));
      setWorkspaceDigestDayOfMonth(String(template.dayOfMonth));
      setWorkspaceDigestHour(String(template.hourLocal));
      setWorkspaceDigestRecipientScope(template.recipientScope);
      setWorkspaceDigestSendEmail(template.sendEmail);
      setWorkspaceDigestSendSlack(template.sendSlack);
      setWorkspaceDigestSlackDestinationId(template.slackDestinationId || "default");
      showUploadStatusNotice(`Applied workspace template "${template.name}".`);
      return;
    }

    setProjectDigestCadence(template.cadence);
    setProjectDigestReportType(template.reportType);
    setProjectDigestWeekday(String(template.weekday));
    setProjectDigestDayOfMonth(String(template.dayOfMonth));
    setProjectDigestHour(String(template.hourLocal));
    setProjectDigestRecipientScope(template.recipientScope);
    setProjectDigestSendEmail(template.sendEmail);
    setProjectDigestSendSlack(template.sendSlack);
    setProjectDigestSlackDestinationId(template.slackDestinationId || "default");
    showUploadStatusNotice(`Applied project template "${template.name}".`);
  }

  async function handleSaveReportTemplate(targetScope: "workspace" | "project") {
    const name =
      targetScope === "workspace"
        ? workspaceDigestTemplateName.trim()
        : projectDigestTemplateName.trim();
    if (!name) {
      setError("Template name is required");
      return;
    }

    setReportTemplateBusyKey(`save:${targetScope}`);
    setError(null);

    try {
      const res = await fetch("/api/report-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          targetScope,
          cadence: targetScope === "workspace" ? workspaceDigestCadence : projectDigestCadence,
          reportType:
            targetScope === "workspace" ? workspaceDigestReportType : projectDigestReportType,
          weekday: Number(
            targetScope === "workspace" ? workspaceDigestWeekday : projectDigestWeekday,
          ),
          dayOfMonth: Number(
            targetScope === "workspace"
              ? workspaceDigestDayOfMonth
              : projectDigestDayOfMonth,
          ),
          hourLocal: Number(
            targetScope === "workspace" ? workspaceDigestHour : projectDigestHour,
          ),
          timezone: browserTimeZone,
          recipientScope:
            targetScope === "workspace"
              ? workspaceDigestRecipientScope
              : projectDigestRecipientScope,
          sendEmail:
            targetScope === "workspace"
              ? workspaceDigestSendEmail
              : projectDigestSendEmail,
          sendSlack:
            targetScope === "workspace"
              ? workspaceDigestSendSlack
              : projectDigestSendSlack,
          slackDestinationId:
            targetScope === "workspace"
              ? workspaceDigestSlackDestinationId === "default"
                ? undefined
                : workspaceDigestSlackDestinationId
              : projectDigestSlackDestinationId === "default"
                ? undefined
                : projectDigestSlackDestinationId,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as ReportTemplatesResponse;
      if (!res.ok || !payload.template) {
        throw new Error(payload?.error || "Failed to save report template");
      }

      setReportTemplates((prev) => [payload.template as RecurringReportTemplate, ...prev]);
      clearScopedCache(REPORT_TEMPLATES_CACHE_KEY, activeWorkspaceId);
      clearScopedCache(WORKSPACE_ACTIVITY_CACHE_KEY, activeWorkspaceId);
      if (targetScope === "workspace") {
        setWorkspaceDigestTemplateName("");
      } else {
        setProjectDigestTemplateName("");
      }
      await loadWorkspaceActivity();
      showUploadStatusNotice(`Saved ${targetScope} report template.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save report template");
    } finally {
      setReportTemplateBusyKey(null);
    }
  }

  async function handleDeleteReportTemplate(templateId: string) {
    setReportTemplateBusyKey(`delete:${templateId}`);
    setError(null);

    try {
      const res = await fetch(`/api/report-templates/${encodeURIComponent(templateId)}`, {
        method: "DELETE",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to delete report template");
      }

      setReportTemplates((prev) => prev.filter((template) => template.id !== templateId));
      clearScopedCache(REPORT_TEMPLATES_CACHE_KEY, activeWorkspaceId);
      clearScopedCache(WORKSPACE_ACTIVITY_CACHE_KEY, activeWorkspaceId);
      await loadWorkspaceActivity();
      showUploadStatusNotice("Report template deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete report template");
    } finally {
      setReportTemplateBusyKey(null);
    }
  }

  async function handleCreateSlackDestination() {
    if (!workspaceSlackDestinationName.trim() || !workspaceSlackDestinationWebhook.trim()) {
      setError("Slack destination name and webhook are required");
      return;
    }

    setWorkspaceSlackDestinationBusy("create");
    setError(null);

    try {
      const res = await fetch("/api/workspaces/slack/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workspaceSlackDestinationName.trim(),
          webhookUrl: workspaceSlackDestinationWebhook.trim(),
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as WorkspaceSlackDestinationsResponse;
      if (!res.ok || !payload.destination) {
        throw new Error(payload?.error || "Failed to create Slack destination");
      }

      setWorkspaceSlackDestinations((prev) => {
        const next = [payload.destination as WorkspaceSlackDestination, ...prev];
        writeSessionCache(
          buildScopedCacheKey(WORKSPACE_SLACK_DESTINATIONS_CACHE_KEY, activeWorkspaceId),
          next,
        );
        return next;
      });
      setWorkspaceSlackDestinationName("");
      setWorkspaceSlackDestinationWebhook("");
      clearScopedCache(WORKSPACE_ACTIVITY_CACHE_KEY, activeWorkspaceId);
      await loadWorkspaceActivity();
      showUploadStatusNotice("Slack destination saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create Slack destination");
    } finally {
      setWorkspaceSlackDestinationBusy(null);
    }
  }

  async function handleDeleteSlackDestination(destinationId: string) {
    setWorkspaceSlackDestinationBusy(`delete:${destinationId}`);
    setError(null);

    try {
      const res = await fetch(
        `/api/workspaces/slack/destinations/${encodeURIComponent(destinationId)}`,
        { method: "DELETE" },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to delete Slack destination");
      }

      setWorkspaceSlackDestinations((prev) => {
        const next = prev.filter((destination) => destination.id !== destinationId);
        writeSessionCache(
          buildScopedCacheKey(WORKSPACE_SLACK_DESTINATIONS_CACHE_KEY, activeWorkspaceId),
          next,
        );
        return next;
      });
      if (workspaceDigestSlackDestinationId === destinationId) {
        setWorkspaceDigestSlackDestinationId("default");
      }
      if (projectDigestSlackDestinationId === destinationId) {
        setProjectDigestSlackDestinationId("default");
      }
      clearScopedCache(WORKSPACE_ACTIVITY_CACHE_KEY, activeWorkspaceId);
      await loadWorkspaceActivity();
      showUploadStatusNotice("Slack destination deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete Slack destination");
    } finally {
      setWorkspaceSlackDestinationBusy(null);
    }
  }

  async function handleSaveWorkspaceSlackSettings(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setWorkspaceSlackBusy("save");
    setError(null);

    try {
      const res = await fetch("/api/workspaces/slack", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: workspaceSlackEnabled,
          sendDigests: workspaceSlackSendDigests,
          webhookUrl: workspaceSlackWebhookDraft.trim() || undefined,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as WorkspaceSlackResponse;
      if (!res.ok || !payload.settings) {
        throw new Error(payload?.error || "Failed to save Slack settings");
      }

      setWorkspaceSlackSettings(payload.settings);
      setWorkspaceSlackEnabled(payload.settings.enabled);
      setWorkspaceSlackSendDigests(payload.settings.sendDigests);
      setWorkspaceSlackWebhookDraft("");
      writeSessionCache(
        buildScopedCacheKey(WORKSPACE_SLACK_CACHE_KEY, activeWorkspaceId),
        payload.settings,
      );
      clearScopedCache(WORKSPACE_ACTIVITY_CACHE_KEY, activeWorkspaceId);
      await loadWorkspaceActivity();
      showUploadStatusNotice("Slack integration updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save Slack settings");
    } finally {
      setWorkspaceSlackBusy(null);
    }
  }

  async function handleSendSlackTest() {
    setWorkspaceSlackBusy("test");
    setError(null);

    try {
      const res = await fetch("/api/workspaces/slack", {
        method: "POST",
      });
      const payload = (await res.json().catch(() => ({}))) as WorkspaceSlackResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to send Slack test");
      }

      if (payload.settings) {
        setWorkspaceSlackSettings(payload.settings);
        writeSessionCache(
          buildScopedCacheKey(WORKSPACE_SLACK_CACHE_KEY, activeWorkspaceId),
          payload.settings,
        );
      }
      clearScopedCache(WORKSPACE_ACTIVITY_CACHE_KEY, activeWorkspaceId);
      await loadWorkspaceActivity();
      showUploadStatusNotice("Slack test message sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send Slack test");
    } finally {
      setWorkspaceSlackBusy(null);
    }
  }

  async function handleDeleteWorkspaceSlackSettings() {
    if (!workspaceSlackSettings?.configured) {
      return;
    }

    const confirmed = window.confirm(
      "Disconnect Slack for this workspace? Voxly will remove the saved Slack webhook and stop posting to the default Slack destination.",
    );
    if (!confirmed) {
      return;
    }

    setWorkspaceSlackBusy("delete");
    setError(null);

    try {
      const res = await fetch("/api/workspaces/slack", {
        method: "DELETE",
      });
      const payload = (await res.json().catch(() => ({}))) as WorkspaceSlackResponse;
      if (!res.ok || !payload.settings) {
        throw new Error(payload?.error || "Failed to disconnect Slack");
      }

      setWorkspaceSlackSettings(payload.settings);
      setWorkspaceSlackEnabled(payload.settings.enabled);
      setWorkspaceSlackSendDigests(payload.settings.sendDigests);
      setWorkspaceSlackWebhookDraft("");
      writeSessionCache(
        buildScopedCacheKey(WORKSPACE_SLACK_CACHE_KEY, activeWorkspaceId),
        payload.settings,
      );
      clearScopedCache(WORKSPACE_ACTIVITY_CACHE_KEY, activeWorkspaceId);
      await loadWorkspaceActivity();
      showUploadStatusNotice("Slack integration disconnected.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect Slack");
    } finally {
      setWorkspaceSlackBusy(null);
    }
  }

  async function handleSaveNotificationPreferences(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setNotificationPreferencesBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mentionEmailEnabled,
          mentionInAppEnabled,
          digestEmailEnabled,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as UserNotificationPreferencesResponse;
      if (!res.ok || !payload.preferences) {
        throw new Error(payload?.error || "Failed to save notification preferences");
      }

      setNotificationPreferences(payload.preferences);
      setMentionEmailEnabled(payload.preferences.mentionEmailEnabled);
      setMentionInAppEnabled(payload.preferences.mentionInAppEnabled);
      setDigestEmailEnabled(payload.preferences.digestEmailEnabled);
      writeSessionCache(NOTIFICATION_PREFERENCES_CACHE_KEY, payload.preferences);
      showUploadStatusNotice("Notification preferences updated.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save notification preferences",
      );
    } finally {
      setNotificationPreferencesBusy(false);
    }
  }

  async function handleSaveWorkspaceNotionSettings(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setWorkspaceNotionBusy("save");
    setError(null);
    setIntegrationError(null);

    try {
      const res = await fetch("/api/workspaces/notion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: workspaceNotionEnabled,
          apiToken: workspaceNotionTokenDraft.trim() || undefined,
          parentPageId: workspaceNotionParentPageDraft.trim() || undefined,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as WorkspaceNotionResponse;
      if (!res.ok || !payload.settings) {
        throw new Error(payload?.error || "Failed to save Notion settings");
      }

      setWorkspaceNotionSettings(payload.settings);
      setWorkspaceNotionEnabled(payload.settings.enabled);
      setWorkspaceNotionTokenDraft("");
      setWorkspaceNotionParentPageDraft(payload.settings.parentPageId || "");
      writeSessionCache(
        buildScopedCacheKey(WORKSPACE_NOTION_CACHE_KEY, activeWorkspaceId),
        payload.settings,
      );
      clearScopedCache(WORKSPACE_ACTIVITY_CACHE_KEY, activeWorkspaceId);
      await loadWorkspaceActivity();
      showUploadStatusNotice("Notion integration updated.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save Notion settings";
      setError(message);
      setIntegrationError(message);
    } finally {
      setWorkspaceNotionBusy(null);
    }
  }

  async function handleValidateWorkspaceNotion() {
    setWorkspaceNotionBusy("validate");
    setError(null);
    setIntegrationError(null);

    try {
      const tokenDraft = workspaceNotionTokenDraft.trim();
      const parentPageDraft = workspaceNotionParentPageDraft.trim();
      const shouldSaveBeforeValidate =
        Boolean(tokenDraft) ||
        Boolean(parentPageDraft) ||
        workspaceNotionSettings?.enabled !== workspaceNotionEnabled ||
        workspaceNotionSettings?.parentPageId !== parentPageDraft;

      if (shouldSaveBeforeValidate) {
        const saveRes = await fetch("/api/workspaces/notion", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled: workspaceNotionEnabled,
            apiToken: tokenDraft || undefined,
            parentPageId: parentPageDraft || undefined,
          }),
        });
        const savePayload = (await saveRes.json().catch(() => ({}))) as WorkspaceNotionResponse;
        if (!saveRes.ok || !savePayload.settings) {
          throw new Error(savePayload?.error || "Failed to save Notion settings");
        }

        setWorkspaceNotionSettings(savePayload.settings);
        setWorkspaceNotionEnabled(savePayload.settings.enabled);
        setWorkspaceNotionTokenDraft("");
        setWorkspaceNotionParentPageDraft(savePayload.settings.parentPageId || "");
        writeSessionCache(
          buildScopedCacheKey(WORKSPACE_NOTION_CACHE_KEY, activeWorkspaceId),
          savePayload.settings,
        );
      }

      const res = await fetch("/api/workspaces/notion", {
        method: "POST",
      });
      const payload = (await res.json().catch(() => ({}))) as WorkspaceNotionResponse;
      if (!res.ok || !payload.settings) {
        throw new Error(payload?.error || "Failed to validate Notion connection");
      }

      setWorkspaceNotionSettings(payload.settings);
      setWorkspaceNotionEnabled(payload.settings.enabled);
      writeSessionCache(
        buildScopedCacheKey(WORKSPACE_NOTION_CACHE_KEY, activeWorkspaceId),
        payload.settings,
      );
      clearScopedCache(WORKSPACE_ACTIVITY_CACHE_KEY, activeWorkspaceId);
      await loadWorkspaceActivity();
      showUploadStatusNotice("Notion connection verified.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to validate Notion connection";
      setError(message);
      setIntegrationError(message);
    } finally {
      setWorkspaceNotionBusy(null);
    }
  }

  async function handleDeleteWorkspaceNotionSettings() {
    if (!workspaceNotionSettings?.configured) {
      return;
    }

    const confirmed = window.confirm(
      "Disconnect Notion for this workspace? Voxly will remove the saved Notion token and parent page ID, and stop publishing insights to Notion.",
    );
    if (!confirmed) {
      return;
    }

    setWorkspaceNotionBusy("delete");
    setError(null);
    setIntegrationError(null);

    try {
      const res = await fetch("/api/workspaces/notion", {
        method: "DELETE",
      });
      const payload = (await res.json().catch(() => ({}))) as WorkspaceNotionResponse;
      if (!res.ok || !payload.settings) {
        throw new Error(payload?.error || "Failed to disconnect Notion");
      }

      setWorkspaceNotionSettings(payload.settings);
      setWorkspaceNotionEnabled(payload.settings.enabled);
      setWorkspaceNotionTokenDraft("");
      setWorkspaceNotionParentPageDraft("");
      writeSessionCache(
        buildScopedCacheKey(WORKSPACE_NOTION_CACHE_KEY, activeWorkspaceId),
        payload.settings,
      );
      clearScopedCache(WORKSPACE_ACTIVITY_CACHE_KEY, activeWorkspaceId);
      await loadWorkspaceActivity();
      showUploadStatusNotice("Notion integration disconnected.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to disconnect Notion";
      setError(message);
      setIntegrationError(message);
    } finally {
      setWorkspaceNotionBusy(null);
    }
  }

  async function handlePublishProjectInsightToNotion(insightId: string) {
    setNotionShareBusyKey(`project:${insightId}`);
    setError(null);

    try {
      const res = await fetch(
        `/api/intelligence/project/insights/${encodeURIComponent(insightId)}/notion`,
        {
          method: "POST",
        },
      );
      const payload = (await res.json().catch(() => ({}))) as WorkspaceNotionResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to publish insight to Notion");
      }

      await Promise.all([loadWorkspaceActivity(), loadWorkspaceNotionSettings()]);
      showUploadStatusNotice("Project insight published to Notion.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish insight to Notion");
    } finally {
      setNotionShareBusyKey(null);
    }
  }

  async function handlePublishWorkspaceInsightToNotion(insightId: string) {
    setNotionShareBusyKey(`workspace:${insightId}`);
    setError(null);

    try {
      const res = await fetch(
        `/api/intelligence/workspace/insights/${encodeURIComponent(insightId)}/notion`,
        {
          method: "POST",
        },
      );
      const payload = (await res.json().catch(() => ({}))) as WorkspaceNotionResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to publish insight to Notion");
      }

      await Promise.all([loadWorkspaceActivity(), loadWorkspaceNotionSettings()]);
      showUploadStatusNotice("Workspace insight published to Notion.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish insight to Notion");
    } finally {
      setNotionShareBusyKey(null);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    setInviteBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/workspaces/invites/${encodeURIComponent(inviteId)}`, {
        method: "DELETE",
      });
      const payload = (await res.json().catch(() => ({}))) as WorkspaceInvitesResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to revoke invite");
      }

      setWorkspaceInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
      clearScopedCache(WORKSPACE_PEOPLE_CACHE_KEY, activeWorkspaceId);
      clearScopedCache(WORKSPACE_ACTIVITY_CACHE_KEY, activeWorkspaceId);
      await loadWorkspaceActivity();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke invite");
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleResendInvite(inviteId: string) {
    setInviteBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/workspaces/invites/${encodeURIComponent(inviteId)}`, {
        method: "PATCH",
      });
      const payload = (await res.json().catch(() => ({}))) as WorkspaceInvitesResponse;
      if (!res.ok || !payload.invite) {
        throw new Error(payload?.error || "Failed to resend invite");
      }

      setWorkspaceInvites((prev) =>
        prev.map((invite) => (invite.id === inviteId ? payload.invite! : invite)),
      );
      clearScopedCache(WORKSPACE_PEOPLE_CACHE_KEY, activeWorkspaceId);
      clearScopedCache(WORKSPACE_ACTIVITY_CACHE_KEY, activeWorkspaceId);
      await loadWorkspaceActivity();
      showUploadStatusNotice("Invitation resent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend invite");
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleUpdateWorkspaceMemberRole(
    memberId: string,
    role: string,
  ) {
    setMemberBusyId(memberId);
    setError(null);

    try {
      const res = await fetch(`/api/workspaces/members/${encodeURIComponent(memberId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to update member role");
      }

      setWorkspaceMembers((prev) =>
        prev.map((member) =>
          member.id === memberId ? { ...member, role } : member,
        ),
      );
      clearScopedCache(WORKSPACE_PEOPLE_CACHE_KEY, activeWorkspaceId);
      clearScopedCache(WORKSPACE_ACTIVITY_CACHE_KEY, activeWorkspaceId);
      await loadWorkspaceActivity();
      showUploadStatusNotice("Member role updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update member");
    } finally {
      setMemberBusyId(null);
    }
  }

  async function handleRemoveWorkspaceMember(memberId: string) {
    setMemberBusyId(memberId);
    setError(null);

    try {
      const res = await fetch(`/api/workspaces/members/${encodeURIComponent(memberId)}`, {
        method: "DELETE",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to remove member");
      }

      setWorkspaceMembers((prev) => prev.filter((member) => member.id !== memberId));
      clearScopedCache(WORKSPACE_PEOPLE_CACHE_KEY, activeWorkspaceId);
      clearScopedCache(WORKSPACE_ACTIVITY_CACHE_KEY, activeWorkspaceId);
      await loadWorkspaceActivity();
      showUploadStatusNotice("Member removed from workspace.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setMemberBusyId(null);
    }
  }

  async function handleTransferWorkspaceOwnership() {
    if (!ownerTransferMemberId) {
      return;
    }

    setOwnerTransferBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/workspaces/owner", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: ownerTransferMemberId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to transfer ownership");
      }

      setWorkspaceMembers((prev) =>
        prev.map((member) =>
          member.id === ownerTransferMemberId
            ? { ...member, role: "owner" }
            : member.role === "owner"
              ? { ...member, role: "admin" }
              : member,
        ),
      );
      setOwnerTransferMemberId("");
      clearWorkspaceAdminCaches();
      await Promise.all([
        loadWorkspaces(),
        loadWorkspaceActivity(),
        loadWorkspaceDigestSettings(),
        loadReportTemplates(),
        loadReportRuns(),
        loadWorkspaceSlackSettings(),
        loadWorkspaceSlackDestinations(),
        loadWorkspaceNotionSettings(),
      ]);
      showUploadStatusNotice("Workspace ownership transferred.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to transfer ownership");
    } finally {
      setOwnerTransferBusy(false);
    }
  }

  async function handleLeaveWorkspace() {
    setLeaveWorkspaceBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/workspaces/leave", {
        method: "POST",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to leave workspace");
      }

      setFocusedSummaryId(null);
      setAssistantSummary(null);
      setAssistantMessages(defaultAssistantMessages);
      setActionTasksByTranscription({});
      setWorkspaceTasks([]);
      dispatchComments({ type: "CLEAR" });
      setIntelligenceResult(null);
      setIntelligenceQuestion("");
      setWorkspaceIntelligenceProjectIds([]);
      setSavedWorkspaceInsights([]);
      setSelectedWorkspaceInsightId(null);
      clearTranscriptionCaches();
      clearScopedCache(PROJECTS_CACHE_KEY, activeWorkspaceId);
      clearScopedCache(BILLING_CACHE_KEY, activeWorkspaceId);
      clearWorkspaceAdminCaches();
      await Promise.all([
        loadWorkspaces(),
        loadItems({ force: true }),
        loadProjects({ force: true }),
        loadTemplates(),
        loadWorkspacePeople(),
        loadWorkspaceActivity(),
        loadWorkspaceTasks(),
        loadWorkspaceDigestSettings(),
        loadReportTemplates(),
        loadReportRuns(),
        loadWorkspaceSlackSettings(),
        loadWorkspaceSlackDestinations(),
        loadWorkspaceNotionSettings(),
      ]);
      showUploadStatusNotice("You left the workspace.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave workspace");
    } finally {
      setLeaveWorkspaceBusy(false);
    }
  }

  async function handleDeleteWorkspace() {
    if (!activeWorkspace) {
      return;
    }

    const confirmation = window.prompt(
      `Type ${activeWorkspace.name} to permanently delete this workspace and all of its projects and recordings.`,
    );
    if (confirmation !== activeWorkspace.name) {
      if (confirmation !== null) {
        setError("Workspace deletion cancelled because the name did not match.");
      }
      return;
    }

    setDeleteWorkspaceBusy(true);
    setError(null);

    try {
      const deletedName = activeWorkspace.name;
      const res = await fetch("/api/workspaces", {
        method: "DELETE",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to delete workspace");
      }

      setFocusedSummaryId(null);
      setAssistantSummary(null);
      setAssistantMessages(defaultAssistantMessages);
      setActionTasksByTranscription({});
      setWorkspaceTasks([]);
      dispatchComments({ type: "CLEAR" });
      setIntelligenceResult(null);
      setIntelligenceQuestion("");
      setWorkspaceIntelligenceProjectIds([]);
      setSavedWorkspaceInsights([]);
      setSelectedWorkspaceInsightId(null);
      setItems([]);
      setAllItems([]);
      setProjects([]);
      setActiveWorkspace(null);
      setWorkspaceDraftName("");
      writeDeletedWorkspaceTombstone({
        id: activeWorkspace.id,
        name: deletedName,
        deletedAt: Date.now(),
      });
      window.dispatchEvent(
        new CustomEvent("voxly:workspace-deleted", {
          detail: { workspaceId: activeWorkspace.id },
        }),
      );
      clearTranscriptionCaches();
      clearScopedCache(PROJECTS_CACHE_KEY, activeWorkspaceId);
      clearScopedCache(BILLING_CACHE_KEY, activeWorkspaceId);
      clearWorkspaceAdminCaches();
      setDeletedWorkspaceName(deletedName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete workspace");
    } finally {
      setDeleteWorkspaceBusy(false);
    }
  }

  async function handleCreateActionTask(input: {
    title: string;
    priority?: string;
    assignee?: string;
    dueDate?: string;
    sourceActionIndex?: number;
  }) {
    if (!activeTranscriptionId) {
      setError("Choose a transcription before creating a task.");
      return null;
    }

    setError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcriptionId: activeTranscriptionId,
          title: input.title,
          priority: input.priority,
          assignee: input.assignee || undefined,
          dueDate: input.dueDate || undefined,
          sourceActionIndex: input.sourceActionIndex,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as TasksResponse;
      if (!res.ok || !payload.task) {
        throw new Error(payload?.error || "Failed to create task");
      }

      setActionTasksByTranscription((prev) => ({
        ...prev,
        [activeTranscriptionId]: upsertTaskCollection(
          prev[activeTranscriptionId] || [],
          payload.task!,
        ),
      }));
      setWorkspaceTasks((prev) => {
        const next = upsertTaskCollection(prev, payload.task!);
        writeSessionCache(buildScopedCacheKey(WORKSPACE_TASKS_CACHE_KEY, activeWorkspaceId), next);
        return next;
      });
      showCopyStatus("Task saved.");
      return payload.task;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
      return null;
    }
  }

  async function handleUpdateActionTask(
    taskId: string,
    updates: Partial<Pick<ActionTask, "status" | "assignee" | "dueDate">>,
  ) {
    setActionTaskBusyKey(`update:${taskId}`);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const payload = (await res.json().catch(() => ({}))) as TasksResponse;
      if (!res.ok || !payload.task) {
        throw new Error(payload?.error || "Failed to update task");
      }

      setActionTasksByTranscription((prev) => ({
        ...prev,
        [payload.task!.transcriptionId]: upsertTaskCollection(
          prev[payload.task!.transcriptionId] || [],
          payload.task!,
        ),
      }));
      setWorkspaceTasks((prev) => {
        const next = upsertTaskCollection(prev, payload.task!);
        writeSessionCache(buildScopedCacheKey(WORKSPACE_TASKS_CACHE_KEY, activeWorkspaceId), next);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    } finally {
      setActionTaskBusyKey(null);
    }
  }

  async function handleDeleteActionTask(taskId: string) {
    const knownTask =
      workspaceTasks.find((task) => task.id === taskId) ||
      currentActionTasks.find((task) => task.id === taskId);
    const transcriptionId = knownTask?.transcriptionId || activeTranscriptionId;

    if (!transcriptionId) {
      return;
    }

    setActionTaskBusyKey(`delete:${taskId}`);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: "DELETE",
      });
      const payload = (await res.json().catch(() => ({}))) as TasksResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to delete task");
      }

      setActionTasksByTranscription((prev) => ({
        ...prev,
        [transcriptionId]: (prev[transcriptionId] || []).filter(
          (task) => task.id !== taskId,
        ),
      }));
      setWorkspaceTasks((prev) => {
        const next = prev.filter((task) => task.id !== taskId);
        writeSessionCache(buildScopedCacheKey(WORKSPACE_TASKS_CACHE_KEY, activeWorkspaceId), next);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    } finally {
      setActionTaskBusyKey(null);
    }
  }

  function handleOpenTranscriptionById(transcriptionId: string) {
    shouldScrollToSummaryRef.current = true;
    setAssistantSummary(null);
    setFocusedSummaryId(transcriptionId);
  }

  function handleOpenTaskTranscript(task: ActionTask) {
    handleOpenTranscriptionById(task.transcriptionId);
  }

  function scrollToSection(sectionId: string) {
    if (sectionId === "upload") {
      setOverviewUploadPanelStartExpanded(true);
      setOverviewUploadPanelVersion((prev) => prev + 1);
    }

    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function handleProjectIntelligenceSuggestion(question: string) {
    setIntelligenceQuestion(question);
  }

  async function handleProjectIntelligenceSubmit(questionOverride?: string) {
    const question = (questionOverride ?? intelligenceQuestion).trim();

    if (intelligenceScope === "project" && intelligenceProjectId === "all") {
      setError("Choose a project before asking across recordings.");
      return;
    }

    if (!question) {
      setError("Enter a question for project intelligence.");
      return;
    }

    setIntelligenceBusy(true);
    setError(null);
    try {
      const res = await fetch(
        intelligenceScope === "workspace"
          ? "/api/intelligence/workspace"
          : "/api/intelligence/project",
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          intelligenceScope === "workspace"
            ? {
                question,
                ...(workspaceIntelligenceProjectIds.length
                  ? { projectIds: workspaceIntelligenceProjectIds }
                  : {}),
              }
            : {
                projectId: intelligenceProjectId,
                question,
              },
        ),
      },
      );
      const payload = (await res.json().catch(() => ({}))) as ProjectIntelligenceResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to answer project question");
      }

      setIntelligenceQuestion(question);
      setIntelligenceResult(payload);
      setSelectedProjectInsightId(null);
      setIntelligenceTitleDraft(
        intelligenceScope === "project" ? buildInsightTitle(question) : "",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : intelligenceScope === "workspace"
            ? "Failed to answer workspace question"
            : "Failed to answer project question",
      );
    } finally {
      setIntelligenceBusy(false);
    }
  }

  function handleToggleWorkspaceIntelligenceProject(projectId: string) {
    setWorkspaceIntelligenceProjectIds((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId],
    );
  }

  async function handleSaveProjectInsight() {
    if (
      !intelligenceResult?.answer ||
      intelligenceScope !== "project" ||
      intelligenceProjectId === "all"
    ) {
      return;
    }

    const title = intelligenceTitleDraft.trim() || buildInsightTitle(intelligenceQuestion);
    setProjectInsightBusyKey("save");
    setError(null);
    try {
      const res = await fetch("/api/intelligence/project/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: intelligenceProjectId,
          title,
          question: intelligenceQuestion,
          answer: intelligenceResult.answer,
          confidenceNote: intelligenceResult.confidenceNote || undefined,
          sources: intelligenceResult.sources || [],
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as ProjectInsightsResponse;
      if (!res.ok || !payload.insight) {
        throw new Error(payload?.error || "Failed to save project insight");
      }

      setSavedProjectInsights((prev) =>
        sortProjectInsights([payload.insight!, ...prev]),
      );
      setSelectedProjectInsightId(payload.insight.id);
      setIntelligenceTitleDraft(payload.insight.title);
      showUploadStatusNotice("Project insight saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save project insight");
    } finally {
      setProjectInsightBusyKey(null);
    }
  }

  async function handleSaveWorkspaceInsight() {
    if (!intelligenceResult?.answer || intelligenceScope !== "workspace") {
      return;
    }

    const title =
      workspaceInsightTitleDraft.trim() || buildInsightTitle(intelligenceQuestion);

    setWorkspaceInsightBusyKey("save");
    setError(null);
    try {
      const res = await fetch("/api/intelligence/workspace/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          question: intelligenceQuestion,
          answer: intelligenceResult.answer,
          confidenceNote: intelligenceResult.confidenceNote || undefined,
          projectIds: workspaceIntelligenceProjectIds,
          sources: intelligenceResult.sources || [],
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as WorkspaceInsightsResponse;
      if (!res.ok || !payload.insight) {
        throw new Error(payload?.error || "Failed to save workspace insight");
      }

      setSavedWorkspaceInsights((prev) =>
        sortProjectInsights([payload.insight!, ...prev]) as SavedWorkspaceInsight[],
      );
      setSelectedWorkspaceInsightId(payload.insight.id);
      setWorkspaceInsightTitleDraft(payload.insight.title);
      showUploadStatusNotice("Workspace insight saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save workspace insight");
    } finally {
      setWorkspaceInsightBusyKey(null);
    }
  }

  function handleOpenSavedProjectInsight(insight: SavedProjectInsight) {
    setSelectedProjectInsightId(insight.id);
    setIntelligenceQuestion(insight.question);
    setIntelligenceTitleDraft(insight.title);
    setIntelligenceResult({
      ok: true,
      answer: insight.answer,
      confidenceNote: insight.confidenceNote || undefined,
      sources: insight.sources || [],
    });
  }

  function handleOpenSavedWorkspaceInsight(insight: SavedWorkspaceInsight) {
    setSelectedWorkspaceInsightId(insight.id);
    setIntelligenceScope("workspace");
    setIntelligenceQuestion(insight.question);
    setWorkspaceInsightTitleDraft(insight.title);
    setWorkspaceIntelligenceProjectIds(insight.projectIds || []);
    setIntelligenceResult({
      ok: true,
      answer: insight.answer,
      confidenceNote: insight.confidenceNote || undefined,
      sources: insight.sources || [],
    });
  }

  async function handleDeleteProjectInsight(insightId: string) {
    setProjectInsightBusyKey(`delete:${insightId}`);
    setError(null);
    try {
      const res = await fetch(
        `/api/intelligence/project/insights/${encodeURIComponent(insightId)}`,
        {
          method: "DELETE",
        },
      );
      const payload = (await res.json().catch(() => ({}))) as ProjectInsightsResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to delete project insight");
      }

      setSavedProjectInsights((prev) => prev.filter((insight) => insight.id !== insightId));
      if (selectedProjectInsightId === insightId) {
        setSelectedProjectInsightId(null);
      }
      showUploadStatusNotice("Project insight deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project insight");
    } finally {
      setProjectInsightBusyKey(null);
    }
  }

  async function handleToggleProjectInsightPinned(insight: SavedProjectInsight) {
    setProjectInsightBusyKey(`pin:${insight.id}`);
    setError(null);
    try {
      const res = await fetch(
        `/api/intelligence/project/insights/${encodeURIComponent(insight.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isPinned: !insight.isPinned,
          }),
        },
      );
      const payload = (await res.json().catch(() => ({}))) as ProjectInsightsResponse;
      if (!res.ok || !payload.insight) {
        throw new Error(payload?.error || "Failed to update project insight");
      }

      setSavedProjectInsights((prev) =>
        sortProjectInsights(
          prev.map((entry) => (entry.id === insight.id ? payload.insight! : entry)),
        ),
      );
      showUploadStatusNotice(
        payload.insight.isPinned ? "Insight pinned." : "Insight unpinned.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update project insight",
      );
    } finally {
      setProjectInsightBusyKey(null);
    }
  }

  async function handleToggleWorkspaceInsightPinned(insight: SavedWorkspaceInsight) {
    setWorkspaceInsightBusyKey(`pin:${insight.id}`);
    setError(null);
    try {
      const res = await fetch(
        `/api/intelligence/workspace/insights/${encodeURIComponent(insight.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isPinned: !insight.isPinned,
          }),
        },
      );
      const payload = (await res.json().catch(() => ({}))) as WorkspaceInsightsResponse;
      if (!res.ok || !payload.insight) {
        throw new Error(payload?.error || "Failed to update workspace insight");
      }

      setSavedWorkspaceInsights((prev) =>
        sortProjectInsights(
          prev.map((entry) => (entry.id === insight.id ? payload.insight! : entry)),
        ) as SavedWorkspaceInsight[],
      );
      showUploadStatusNotice(
        payload.insight.isPinned ? "Workspace insight pinned." : "Workspace insight unpinned.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update workspace insight",
      );
    } finally {
      setWorkspaceInsightBusyKey(null);
    }
  }

  async function handleToggleProjectInsightArchived(insight: SavedProjectInsight) {
    setProjectInsightBusyKey(`archive:${insight.id}`);
    setError(null);
    try {
      const res = await fetch(
        `/api/intelligence/project/insights/${encodeURIComponent(insight.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            archived: !insight.archivedAt,
          }),
        },
      );
      const payload = (await res.json().catch(() => ({}))) as ProjectInsightsResponse;
      if (!res.ok || !payload.insight) {
        throw new Error(payload?.error || "Failed to update project insight");
      }

      setSavedProjectInsights((prev) =>
        sortProjectInsights(
          prev.map((entry) => (entry.id === insight.id ? payload.insight! : entry)),
        ),
      );

      if (selectedProjectInsightId === insight.id && payload.insight.archivedAt) {
        setSelectedProjectInsightId(insight.id);
      }

      showUploadStatusNotice(
        payload.insight.archivedAt ? "Insight archived." : "Insight restored.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update project insight",
      );
    } finally {
      setProjectInsightBusyKey(null);
    }
  }

  async function handleToggleWorkspaceInsightArchived(insight: SavedWorkspaceInsight) {
    setWorkspaceInsightBusyKey(`archive:${insight.id}`);
    setError(null);
    try {
      const res = await fetch(
        `/api/intelligence/workspace/insights/${encodeURIComponent(insight.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            archived: !insight.archivedAt,
          }),
        },
      );
      const payload = (await res.json().catch(() => ({}))) as WorkspaceInsightsResponse;
      if (!res.ok || !payload.insight) {
        throw new Error(payload?.error || "Failed to update workspace insight");
      }

      setSavedWorkspaceInsights((prev) =>
        sortProjectInsights(
          prev.map((entry) => (entry.id === insight.id ? payload.insight! : entry)),
        ) as SavedWorkspaceInsight[],
      );
      showUploadStatusNotice(
        payload.insight.archivedAt
          ? "Workspace insight archived."
          : "Workspace insight restored.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update workspace insight",
      );
    } finally {
      setWorkspaceInsightBusyKey(null);
    }
  }

  async function handleDeleteWorkspaceInsight(insightId: string) {
    setWorkspaceInsightBusyKey(`delete:${insightId}`);
    setError(null);
    try {
      const res = await fetch(
        `/api/intelligence/workspace/insights/${encodeURIComponent(insightId)}`,
        {
          method: "DELETE",
        },
      );
      const payload = (await res.json().catch(() => ({}))) as WorkspaceInsightsResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to delete workspace insight");
      }

      setSavedWorkspaceInsights((prev) => prev.filter((insight) => insight.id !== insightId));
      if (selectedWorkspaceInsightId === insightId) {
        setSelectedWorkspaceInsightId(null);
      }
      showUploadStatusNotice("Workspace insight deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete workspace insight");
    } finally {
      setWorkspaceInsightBusyKey(null);
    }
  }

  async function handleShareProjectInsightToSlack(insightId: string) {
    setSlackShareBusyKey(`project:${insightId}`);
    setError(null);

    try {
      const res = await fetch(
        `/api/intelligence/project/insights/${encodeURIComponent(insightId)}/slack`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to share insight to Slack");
      }

      await loadWorkspaceActivity();
      showUploadStatusNotice("Project insight shared to Slack.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to share insight to Slack");
    } finally {
      setSlackShareBusyKey(null);
    }
  }

  async function handleShareWorkspaceInsightToSlack(insightId: string) {
    setSlackShareBusyKey(`workspace:${insightId}`);
    setError(null);

    try {
      const res = await fetch(
        `/api/intelligence/workspace/insights/${encodeURIComponent(insightId)}/slack`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to share insight to Slack");
      }

      await loadWorkspaceActivity();
      showUploadStatusNotice("Workspace insight shared to Slack.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to share insight to Slack");
    } finally {
      setSlackShareBusyKey(null);
    }
  }

  async function handleCreateComment(input: {
    content: string;
    transcriptionId?: string;
    taskId?: string;
    projectInsightId?: string;
    workspaceInsightId?: string;
  }) {
    const content = input.content.trim();
    if (!content) {
      return;
    }

    const key = input.taskId
      ? `task:${input.taskId}`
      : input.projectInsightId
        ? `insight:${input.projectInsightId}`
        : input.workspaceInsightId
          ? `workspace-insight:${input.workspaceInsightId}`
      : input.transcriptionId
        ? `transcription:${input.transcriptionId}`
        : "comment";

    setCommentBusyKey(key);
    setError(null);

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          transcriptionId: input.transcriptionId,
          taskId: input.taskId,
          projectInsightId: input.projectInsightId,
          workspaceInsightId: input.workspaceInsightId,
        }),
      });
      const payload = (await res.json()) as CommentsResponse;
      if (!res.ok || !payload.comment) {
        throw new Error(payload?.error || "Failed to add comment");
      }

      if (input.transcriptionId) {
        dispatchComments({ type: "ADD", entityId: input.transcriptionId, comment: payload.comment! });
        setTranscriptionCommentDraft("");
      }

      if (input.taskId) {
        dispatchComments({ type: "ADD", entityId: input.taskId, comment: payload.comment! });
        setTaskCommentDrafts((prev) => ({ ...prev, [input.taskId!]: "" }));
      }

      if (input.projectInsightId) {
        dispatchComments({ type: "ADD", entityId: input.projectInsightId, comment: payload.comment! });
        setProjectInsightCommentDrafts((prev) => ({ ...prev, [input.projectInsightId!]: "" }));
      }

      if (input.workspaceInsightId) {
        dispatchComments({ type: "ADD", entityId: input.workspaceInsightId, comment: payload.comment! });
        setWorkspaceInsightCommentDrafts((prev) => ({ ...prev, [input.workspaceInsightId!]: "" }));
      }

      showUploadStatusNotice("Comment added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add comment");
    } finally {
      setCommentBusyKey(null);
    }
  }

  async function handleUpdateComment(commentId: string, content: string) {
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    setCommentBusyKey(`edit:${commentId}`);
    setError(null);

    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(commentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      const payload = (await res.json()) as CommentsResponse;
      if (!res.ok || !payload.comment) {
        throw new Error(payload?.error || "Failed to update comment");
      }

      const nextComment = payload.comment;
      dispatchComments({ type: "UPDATE", commentId, next: nextComment });
      setEditingCommentId(null);
      showUploadStatusNotice("Comment updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update comment");
    } finally {
      setCommentBusyKey(null);
    }
  }

  async function handleDeleteComment(commentId: string) {
    setCommentBusyKey(`delete:${commentId}`);
    setError(null);

    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(commentId)}`, {
        method: "DELETE",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to delete comment");
      }

      dispatchComments({ type: "DELETE", commentId });
      if (editingCommentId === commentId) {
        setEditingCommentId(null);
      }
      showUploadStatusNotice("Comment deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete comment");
    } finally {
      setCommentBusyKey(null);
    }
  }

  async function handleMarkNotificationRead(notificationId?: string) {
    setNotificationBusyId(notificationId || "all");
    setError(null);

    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notificationId ? { notificationId } : {}),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to update notifications");
      }

      setNotifications((prev) =>
        prev.map((item) =>
          !notificationId || item.id === notificationId
            ? { ...item, readAt: new Date().toISOString() }
            : item,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update notifications",
      );
    } finally {
      setNotificationBusyId(null);
    }
  }

  const surfaceMeta: Record<
    | "overview"
    | "upload"
    | "transcriptions"
    | "intelligence"
    | "operations"
    | "settings",
    {
      eyebrow: string;
      title: string;
      description: string;
      status: string;
    }
  > = {
    overview: {
      eyebrow: "Overview",
      title: "Current workspace",
      description:
        "Start with a new upload or continue reviewing the current recording without bouncing between separate pages.",
      status: "Assistant ready",
    },
    upload: {
      eyebrow: "Upload Flow",
      title: "Add a recording to Voxly",
      description:
        "Choose a template, upload your file, and let Voxly process the transcript in the background.",
      status: "Ready to upload",
    },
    transcriptions: {
      eyebrow: "History",
      title: "Search and manage history",
      description:
        "Filter your transcript history, reopen recent work, and jump back into a recording without losing context.",
      status: `${items.length} loaded`,
    },
    intelligence: {
      eyebrow: "Workspace Intelligence",
      title: "Ask across transcripts",
      description:
        "Synthesize themes across a project or your full workspace with grounded, cited answers.",
      status: "AI search ready",
    },
    operations: {
      eyebrow: "Operations",
      title: "Run the workspace",
      description:
        "Track tasks, mentions, report runs, and delivery health from one operational surface.",
      status: "Ops tracking live",
    },
    settings: {
      eyebrow: "Settings",
      title: isWorkspaceSettingsMode ? "Workspace settings" : "Personal settings",
      description:
        isWorkspaceSettingsMode
          ? "Manage this workspace's identity, access, integrations, reports, and deletion."
          : "Manage preferences that follow you across workspaces.",
      status: "Admin controls ready",
    },
  };

  const activeSurfaceMeta = surfaceMeta[workspaceSurface];
  const isOverviewSurface = workspaceSurface === "overview";
  const settingsSectionMeta: SettingsSectionMeta = {
    workspace: {
      label: "Workspace Settings",
      description: "Name, owner, role, deletion, and core workspace identity",
    },
    delivery: {
      label: "Delivery",
      description: "Recurring reports and reusable report templates",
    },
    integrations: {
      label: "Integrations",
      description: "Slack, Notion, and routing destinations",
    },
    access: {
      label: "Access",
      description: "Members, invites, ownership, and audit activity",
    },
    personal: {
      label: "Personal Settings",
      description: "Your mention and digest preferences across all workspaces",
    },
  };
  const visibleSettingsSections: SettingsSection[] = isWorkspaceSettingsMode
    ? ["workspace", "delivery", "integrations", "access"]
    : ["personal"];
  const currentSettingsMeta = settingsSectionMeta[settingsSection];
  const showPersonalSettings =
    workspaceSurface === "settings" && settingsSection === "personal";
  const showWorkspaceSettings =
    workspaceSurface === "settings" && settingsSection === "workspace";
  const showDeliverySettings =
    workspaceSurface === "settings" && settingsSection === "delivery";
  const showIntegrationSettings =
    workspaceSurface === "settings" && settingsSection === "integrations";
  const showAccessSettings =
    workspaceSurface === "settings" && settingsSection === "access";
  const showOperationsSurface = workspaceSurface === "operations";
  const handleUploadFileChange = useStableCallback((nextFile: File | null) => {
    setFile(nextFile);
    setEstimatedDurationSeconds(null);
    if (nextFile) {
      void readMediaDuration(nextFile);
    }
  });
  const handleOverviewCopySummary = useStableCallback(() => {
    void handleCopyText(
      "Summary",
      buildSummaryText(displaySummary || focusedSummary),
    );
  });
  const handleOverviewStartUpload = useStableCallback(() => {
    scrollToSection("upload");
  });
  const handleOverviewTaskCommentDraftChange = useStableCallback(
    (taskId: string, value: string) => {
      setTaskCommentDrafts((prev) => ({ ...prev, [taskId]: value }));
    },
  );
  const handleCreateOverviewTaskComment = useStableCallback(
    (input: { taskId: string; content: string }) =>
      handleCreateComment({ taskId: input.taskId, content: input.content }),
  );
  const stableHandleLoadTestData = useStableCallback(handleLoadTestData);
  const stableHandleCreateTemplate = useStableCallback(handleCreateTemplate);
  const stableHandleCreateProject = useStableCallback(handleCreateProject);
  const stableHandleUpload = useStableCallback(handleUpload);
  const stableHandleProcess = useStableCallback(handleProcess);
  const stableHandleCreateActionTask = useStableCallback(handleCreateActionTask);
  const stableHandleUpdateActionTask = useStableCallback(handleUpdateActionTask);
  const stableHandleDeleteActionTask = useStableCallback(handleDeleteActionTask);
  const stableHandleOpenTaskTranscript = useStableCallback(handleOpenTaskTranscript);
  const stableHandleMarkNotificationRead = useStableCallback(handleMarkNotificationRead);
  const stableHandleExportReportRuns = useStableCallback(handleExportReportRuns);
  const stableHandleRetryReportRun = useStableCallback(handleRetryReportRun);
  const stableHandleAssignProject = useStableCallback(handleAssignProject);
  const stableHandleDelete = useStableCallback(handleDelete);
  const stableHandleToggleProjectInsightPinned = useStableCallback(
    handleToggleProjectInsightPinned,
  );
  const stableHandleToggleProjectInsightArchived = useStableCallback(
    handleToggleProjectInsightArchived,
  );
  const stableHandleOpenSavedProjectInsight = useStableCallback(
    handleOpenSavedProjectInsight,
  );
  const stableHandleToggleWorkspaceInsightPinned = useStableCallback(
    handleToggleWorkspaceInsightPinned,
  );
  const stableHandleToggleWorkspaceInsightArchived = useStableCallback(
    handleToggleWorkspaceInsightArchived,
  );
  const stableHandleOpenSavedWorkspaceInsight = useStableCallback(
    handleOpenSavedWorkspaceInsight,
  );
  const stableHandleCopyInsightForNotion = useStableCallback(
    handleCopyInsightForNotion,
  );
  const stableHandleExportInsightMarkdown = useStableCallback(
    handleExportInsightMarkdown,
  );
  const stableHandlePublishProjectInsightToNotion = useStableCallback(
    handlePublishProjectInsightToNotion,
  );
  const stableHandlePublishWorkspaceInsightToNotion = useStableCallback(
    handlePublishWorkspaceInsightToNotion,
  );
  const stableHandleShareProjectInsightToSlack = useStableCallback(
    handleShareProjectInsightToSlack,
  );
  const stableHandleShareWorkspaceInsightToSlack = useStableCallback(
    handleShareWorkspaceInsightToSlack,
  );
  const stableHandleDeleteProjectInsight = useStableCallback(handleDeleteProjectInsight);
  const stableHandleDeleteWorkspaceInsight = useStableCallback(
    handleDeleteWorkspaceInsight,
  );
  const stableHandleUpdateComment = useStableCallback(handleUpdateComment);
  const stableHandleDeleteComment = useStableCallback(handleDeleteComment);
  const stableHandleCreateComment = useStableCallback(handleCreateComment);
  const stableHandleRefreshNotes = useStableCallback(() => void handleRefreshNotes());
  const stableHandleAssistantSubmit = useStableCallback(
    (input: { text: string; scope: AssistantScope; projectId: string; workspaceProjectIds: string[] }) =>
      void handleAssistantSubmitWithContext(input),
  );
  const stableHandleIntelligenceProjectChange = useStableCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      setIntelligenceProjectId(value);
      startTransition(() => {
        setSelectedProjectInsightId(null);
        setIntelligenceResult(null);
        setIntelligenceTitleDraft("");
      });
    },
  );
  const sharedUploadBodyProps = useMemo<UploadPanelBodyProps>(
    () => ({
      activeWorkspace,
      fileInputId,
      file,
      onFileChange: handleUploadFileChange,
      estimatedDurationSeconds,
      isDev,
      testDataLoading,
      testDataStatus,
      onLoadTestData: stableHandleLoadTestData,
      uploadTemplate,
      onUploadTemplateChange: setUploadTemplate,
      templateOptions,
      templatesStatusText: templatesLoading
        ? "Loading templates..."
        : customTemplates.length
          ? `${customTemplates.length} custom template${customTemplates.length === 1 ? "" : "s"}`
          : "No custom templates yet.",
      templateBusy,
      onCreateTemplate: stableHandleCreateTemplate,
      uploadProjectId,
      onUploadProjectIdChange: setUploadProjectId,
      projects,
      projectsStatusText: projectsLoading
        ? "Loading projects..."
        : projects.length
          ? `${projects.length} project${projects.length === 1 ? "" : "s"}`
          : "No projects yet.",
      projectBusy,
      onCreateProject: stableHandleCreateProject,
      onUpload: stableHandleUpload,
      uploading,
      durationLoading,
      hasEnoughEstimatedCredits,
      estimatedCredits,
      billing,
    }),
    [
      activeWorkspace,
      billing,
      customTemplates.length,
      durationLoading,
      estimatedCredits,
      estimatedDurationSeconds,
      file,
      fileInputId,
      handleUploadFileChange,
      hasEnoughEstimatedCredits,
      isDev,
      projectBusy,
      projects,
      projectsLoading,
      stableHandleCreateProject,
      stableHandleCreateTemplate,
      stableHandleLoadTestData,
      stableHandleUpload,
      templateBusy,
      templateOptions,
      templatesLoading,
      testDataLoading,
      testDataStatus,
      uploadProjectId,
      uploadTemplate,
      uploading,
    ],
  );
  const overviewCurrentRecordingProps = useMemo<OverviewCurrentRecordingProps>(
    () => ({
      activeWorkspace,
      focusedSummary,
      displaySummary,
      selectedProjectName,
      currentRecordingText,
      currentRecordingSnippet,
      hasExpandableCurrentRecordingText,
      focusedSummaryHiddenByFilters,
      isFocusedSummaryProcessing,
      canProcessFocusedSummary,
      currentActionTasks,
      activeTranscriptionId,
      actionTaskBusyKey,
      taskCommentsById: commentsById,
      taskCommentDrafts,
      commentBusyKey,
      detailsAutoOpenToken: overviewDetailsAutoOpenToken,
      onProcess: stableHandleProcess,
      onCopySummary: handleOverviewCopySummary,
      onStartUpload: handleOverviewStartUpload,
      onCreateActionTask: stableHandleCreateActionTask,
      onUpdateActionTask: stableHandleUpdateActionTask,
      onDeleteActionTask: stableHandleDeleteActionTask,
      onTaskCommentDraftChange: handleOverviewTaskCommentDraftChange,
      onCreateTaskComment: handleCreateOverviewTaskComment,
    }),
    [
      activeTranscriptionId,
      activeWorkspace,
      actionTaskBusyKey,
      canProcessFocusedSummary,
      commentBusyKey,
      currentActionTasks,
      currentRecordingSnippet,
      currentRecordingText,
      displaySummary,
      focusedSummary,
      focusedSummaryHiddenByFilters,
      handleCreateOverviewTaskComment,
      handleOverviewCopySummary,
      handleOverviewStartUpload,
      handleOverviewTaskCommentDraftChange,
      hasExpandableCurrentRecordingText,
      isFocusedSummaryProcessing,
      overviewDetailsAutoOpenToken,
      selectedProjectName,
      stableHandleCreateActionTask,
      stableHandleDeleteActionTask,
      stableHandleProcess,
      stableHandleUpdateActionTask,
      taskCommentDrafts,
      commentsById,
    ],
  );
  const historySurfaceProps = useMemo<HistorySurfaceProps>(
    () => ({
      isActive: workspaceSurface === "transcriptions",
      activeWorkspaceId,
      activeWorkspace,
      initialProjectFilter,
      statusOptions,
      templateOptions,
      projects,
      onAssignProject: stableHandleAssignProject,
      onDelete: stableHandleDelete,
    }),
    [
      activeWorkspace,
      activeWorkspaceId,
      initialProjectFilter,
      projects,
      stableHandleAssignProject,
      stableHandleDelete,
      statusOptions,
      templateOptions,
      workspaceSurface,
    ],
  );
  const workspaceTasksSurfaceProps = useMemo<WorkspaceTasksSurfaceProps>(
    () => ({
      isActive: showOperationsSurface,
      workspaceTaskCounts,
      workspaceTaskStatusFilter,
      workspaceTaskAssignmentFilter,
      taskStatusOptions,
      taskAssignmentOptions,
      workspaceTasksLoading,
      filteredWorkspaceTasks,
      actionTaskBusyKey,
      onWorkspaceTaskStatusFilterChange: setWorkspaceTaskStatusFilter,
      onWorkspaceTaskAssignmentFilterChange: setWorkspaceTaskAssignmentFilter,
      onUpdateActionTask: stableHandleUpdateActionTask,
      onDeleteActionTask: stableHandleDeleteActionTask,
      onOpenTaskTranscript: stableHandleOpenTaskTranscript,
    }),
    [
      actionTaskBusyKey,
      filteredWorkspaceTasks,
      showOperationsSurface,
      stableHandleDeleteActionTask,
      stableHandleOpenTaskTranscript,
      stableHandleUpdateActionTask,
      taskAssignmentOptions,
      taskStatusOptions,
      workspaceTaskAssignmentFilter,
      workspaceTaskCounts,
      workspaceTaskStatusFilter,
      workspaceTasksLoading,
    ],
  );
  const operationsActivitySurfaceProps = useMemo<OperationsActivitySurfaceProps>(
    () => ({
      isActive: showOperationsSurface,
      unreadNotificationsCount,
      notificationBusyId,
      reportRunSummaryLoading,
      reportRunSummary,
      notificationsLoading,
      notifications,
      reportRunScopeFilter,
      reportRunStatusFilter,
      reportRunExportBusy,
      reportRunsLoading,
      reportRuns,
      reportRunBusyId,
      canManageWorkspace: Boolean(activeWorkspace?.canManage),
      onMarkNotificationRead: stableHandleMarkNotificationRead,
      onReportRunScopeFilterChange: setReportRunScopeFilter,
      onReportRunStatusFilterChange: setReportRunStatusFilter,
      onExportReportRuns: stableHandleExportReportRuns,
      onRetryReportRun: stableHandleRetryReportRun,
    }),
    [
      activeWorkspace?.canManage,
      notificationBusyId,
      notifications,
      notificationsLoading,
      reportRunBusyId,
      reportRunExportBusy,
      reportRunScopeFilter,
      reportRunStatusFilter,
      reportRunSummary,
      reportRunSummaryLoading,
      reportRuns,
      reportRunsLoading,
      showOperationsSurface,
      stableHandleExportReportRuns,
      stableHandleMarkNotificationRead,
      stableHandleRetryReportRun,
      unreadNotificationsCount,
    ],
  );
  const savedInsightsPanelProps = useMemo<SavedInsightsPanelProps>(
    () => ({
      intelligenceScope,
      activeWorkspace,
      currentUser,
      projectInsightFilterOptions,
      projectInsightFilter,
      workspaceInsightFilter,
      filteredProjectInsights,
      filteredWorkspaceInsights,
      projectInsightsLoading,
      workspaceInsightsLoading,
      selectedProjectInsightId,
      selectedWorkspaceInsightId,
      projectInsightBusyKey,
      workspaceInsightBusyKey,
      exportBusy,
      notionShareBusyKey,
      slackShareBusyKey,
      workspaceNotionSettings,
      workspaceSlackSettings,
      currentProjectInsightComments,
      currentWorkspaceInsightComments,
      editingCommentId,
      commentEditDrafts,
      commentBusyKey,
      projectInsightCommentDrafts,
      workspaceInsightCommentDrafts,
      setProjectInsightFilter,
      setWorkspaceInsightFilter,
      setEditingCommentId,
      setCommentEditDrafts,
      setProjectInsightCommentDrafts,
      setWorkspaceInsightCommentDrafts,
      handleToggleProjectInsightPinned: stableHandleToggleProjectInsightPinned,
      handleToggleProjectInsightArchived: stableHandleToggleProjectInsightArchived,
      handleOpenSavedProjectInsight: stableHandleOpenSavedProjectInsight,
      handleToggleWorkspaceInsightPinned: stableHandleToggleWorkspaceInsightPinned,
      handleToggleWorkspaceInsightArchived: stableHandleToggleWorkspaceInsightArchived,
      handleOpenSavedWorkspaceInsight: stableHandleOpenSavedWorkspaceInsight,
      handleCopyInsightForNotion: stableHandleCopyInsightForNotion,
      handleExportInsightMarkdown: stableHandleExportInsightMarkdown,
      handlePublishProjectInsightToNotion: stableHandlePublishProjectInsightToNotion,
      handlePublishWorkspaceInsightToNotion:
        stableHandlePublishWorkspaceInsightToNotion,
      handleShareProjectInsightToSlack: stableHandleShareProjectInsightToSlack,
      handleShareWorkspaceInsightToSlack: stableHandleShareWorkspaceInsightToSlack,
      handleDeleteProjectInsight: stableHandleDeleteProjectInsight,
      handleDeleteWorkspaceInsight: stableHandleDeleteWorkspaceInsight,
      handleUpdateComment: stableHandleUpdateComment,
      handleDeleteComment: stableHandleDeleteComment,
      handleCreateComment: stableHandleCreateComment,
    }),
    [
      activeWorkspace,
      commentBusyKey,
      commentEditDrafts,
      currentProjectInsightComments,
      currentUser,
      currentWorkspaceInsightComments,
      editingCommentId,
      exportBusy,
      filteredProjectInsights,
      filteredWorkspaceInsights,
      intelligenceScope,
      notionShareBusyKey,
      projectInsightBusyKey,
      projectInsightCommentDrafts,
      projectInsightFilter,
      projectInsightFilterOptions,
      projectInsightsLoading,
      selectedProjectInsightId,
      selectedWorkspaceInsightId,
      slackShareBusyKey,
      stableHandleCopyInsightForNotion,
      stableHandleCreateComment,
      stableHandleDeleteComment,
      stableHandleDeleteProjectInsight,
      stableHandleDeleteWorkspaceInsight,
      stableHandleExportInsightMarkdown,
      stableHandleOpenSavedProjectInsight,
      stableHandleOpenSavedWorkspaceInsight,
      stableHandlePublishProjectInsightToNotion,
      stableHandlePublishWorkspaceInsightToNotion,
      stableHandleShareProjectInsightToSlack,
      stableHandleShareWorkspaceInsightToSlack,
      stableHandleToggleProjectInsightArchived,
      stableHandleToggleProjectInsightPinned,
      stableHandleToggleWorkspaceInsightArchived,
      stableHandleToggleWorkspaceInsightPinned,
      stableHandleUpdateComment,
      workspaceInsightBusyKey,
      workspaceInsightCommentDrafts,
      workspaceInsightFilter,
      workspaceInsightsLoading,
      workspaceNotionSettings,
      workspaceSlackSettings,
    ],
  );

  return (
    <div className="relative">
      {completionTip ? (
        <div className="pointer-events-none fixed left-1/2 top-24 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2">
          <div className="rounded-[22px] border border-emerald-200 bg-emerald-50/95 px-4 py-3 text-sm text-emerald-900 shadow-[0_18px_48px_-24px_rgba(16,185,129,0.75)] backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                !
              </div>
              <div>
                <p className="font-bold">Tips unlocked</p>
                <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                  {completionTip}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {uploadVisibilityNotice ? (
        <div className="pointer-events-none fixed left-1/2 top-44 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2">
          <div className="rounded-[22px] border border-amber-200 bg-amber-50/95 px-4 py-3 text-sm text-amber-900 shadow-[0_18px_48px_-24px_rgba(245,158,11,0.75)] backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-700">
                i
              </div>
              <div>
                <p className="font-bold">Upload added</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-800">
                  {uploadVisibilityNotice}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {uploadStatusNotice ? (
        <div className="pointer-events-none fixed left-1/2 top-56 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2">
          <div className="rounded-[22px] border border-sky-200 bg-sky-50/95 px-4 py-3 text-sm text-sky-900 shadow-[0_18px_48px_-24px_rgba(14,165,233,0.55)] backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-sky-100 font-bold text-sky-700">
                i
              </div>
              <div>
                <p className="font-bold">Upload complete</p>
                <p className="mt-1 text-xs leading-relaxed text-sky-800">
                  {uploadStatusNotice}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {copyStatus ? (
        <div className="pointer-events-none fixed left-1/2 top-72 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
          <div className="rounded-[18px] border border-slate-200 bg-white/95 px-4 py-3 text-sm font-semibold text-slate-900 shadow-[0_18px_48px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
            {copyStatus}
          </div>
        </div>
      ) : null}

      {deletedWorkspaceName ? (
        <section className="mx-auto max-w-3xl rounded-[28px] border border-slate-200 bg-white px-6 py-12 text-center shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)] sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-600">
            Deleted
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {deletedWorkspaceName} has been deleted.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-600">
            The workspace is empty now. Its projects, recordings, tasks,
            comments, saved insights, and processing uploads were removed.
          </p>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
            Choose another workspace from the sidebar when you are ready to
            continue.
          </p>
        </section>
      ) : (
      <div
        className={`grid grid-cols-1 items-start gap-6 ${
          workspaceSurface === "settings"
            ? ""
            : "lg:grid-cols-[minmax(0,1fr)_360px]"
        }`}
      >
      <div
        className={`min-w-0 space-y-5 ${
          workspaceSurface === "settings" ? "mx-auto w-full max-w-5xl" : ""
        }`}
      >
        <section
          className={`overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_48px_-34px_rgba(15,23,42,0.2)] ${
            hasProjectScopedHistoryView || isOverviewSurface ? "hidden" : ""
          }`}
        >
          <div
            className={`border-b border-slate-200 px-4 sm:px-5 ${
              workspaceSurface === "transcriptions"
                ? "py-3 sm:py-4"
                : workspaceSurface === "overview"
                  ? "py-2"
                  : "py-4"
            }`}
          >
            <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
              {workspaceSurface === "overview" ? <div /> : (
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                    {workspaceSurface === "settings"
                      ? isWorkspaceSettingsMode
                        ? "Workspace Settings"
                        : "Personal Settings"
                      : activeSurfaceMeta.eyebrow}
                  </p>
                  <h1
                    className={`truncate font-semibold tracking-tight text-slate-950 ${
                      workspaceSurface === "transcriptions"
                        ? "mt-1 text-[1.25rem] sm:text-[1.4rem]"
                        : "mt-2 text-[1.75rem] sm:text-[2rem]"
                    }`}
                  >
                    {workspaceSurface === "settings"
                      ? currentSettingsMeta.label
                      : activeSurfaceMeta.title}
                  </h1>
                  <p
                    className={`max-w-3xl text-sm text-slate-600 ${
                      workspaceSurface === "transcriptions"
                        ? "mt-1 leading-5"
                        : "mt-2 leading-6"
                    }`}
                  >
                    {workspaceSurface === "settings"
                      ? currentSettingsMeta.description
                      : activeSurfaceMeta.description}
                  </p>
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {showCurrentWorkspaceLabel ? (
                  <div className="min-w-[240px]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Current Workspace
                    </p>
                    <div className="mt-1.5 rounded-[16px] border border-slate-200 bg-[#f8f8f5] px-4 py-2.5 text-sm font-medium text-slate-900">
                      {activeWorkspaceLabel}
                    </div>
                  </div>
                ) : null}
                {workspaceSurface === "settings" ||
                workspaceSurface === "transcriptions" ||
                workspaceSurface === "overview" ? null : (
                  <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                    {activeSurfaceMeta.status}
                  </div>
                )}
              </div>
            </div>
          </div>

          {workspaceSurface === "settings" ? (
            <SettingsSurfaceNav
              activeSection={settingsSection}
              visibleSections={visibleSettingsSections}
              sectionMeta={settingsSectionMeta}
              onSectionChange={setSettingsSection}
            />
          ) : isOverviewSurface ? (
            <div className="border-t border-slate-200 px-4 py-3 sm:px-5">
              <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-[0.95rem] font-semibold text-slate-900">
                    {focusedSummary?.fileName || "Start with a new recording"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="rounded-full border border-slate-200 bg-[#fcfbf8] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                      {focusedSummary?.status || "waiting"}
                    </span>
                    {focusedSummary?.template ? (
                      <span className="rounded-full border border-slate-200 bg-[#fcfbf8] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                        {focusedSummary.template}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-slate-200 bg-[#fcfbf8] px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      {selectedProjectName}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-[#fcfbf8] px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      {items.length} uploads
                    </span>
                    <span className="rounded-full border border-slate-200 bg-[#fcfbf8] px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      {savedInsightCount} insights
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => scrollToSection("upload")}
                    className="cursor-pointer rounded-full bg-slate-950 px-3.5 py-1.5 text-[11px] font-semibold text-white"
                  >
                    Start Upload
                  </button>
                  <Link
                    href="/dashboard/transcriptions"
                    className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[11px] font-semibold text-slate-700"
                  >
                    Open History
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </section>
        <section
          className={`${
            workspaceSurface === "overview"
              ? "hidden"
              : workspaceSurface === "transcriptions"
                ? ""
                : "rounded-[24px] border border-white/80 bg-white/88 p-5 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.28)]"
          }`}
        >
          <Suspense fallback={null}>
            <OperationsActivitySurface {...operationsActivitySurfaceProps} />
          </Suspense>

          {showPersonalSettings ? (
          <Suspense fallback={null}>
            <PersonalSettingsSection
              notificationPreferences={notificationPreferences}
              notificationPreferencesLoading={notificationPreferencesLoading}
              notificationPreferencesBusy={notificationPreferencesBusy}
              mentionEmailEnabled={mentionEmailEnabled}
              mentionInAppEnabled={mentionInAppEnabled}
              digestEmailEnabled={digestEmailEnabled}
              onMentionEmailChange={setMentionEmailEnabled}
              onMentionInAppChange={setMentionInAppEnabled}
              onDigestEmailChange={setDigestEmailEnabled}
              onSubmit={handleSaveNotificationPreferences}
            />
          </Suspense>
          ) : null}

          {showWorkspaceSettings ? (
          <Suspense fallback={null}>
            <WorkspaceSettingsSection
              activeWorkspace={activeWorkspace}
              activeWorkspaceLabel={activeWorkspaceLabel}
              workspaceDraftName={workspaceDraftName}
              workspaceSettingsBusy={workspaceSettingsBusy}
              deleteWorkspaceBusy={deleteWorkspaceBusy}
              onWorkspaceDraftNameChange={setWorkspaceDraftName}
              onSubmit={handleRenameWorkspace}
              onDeleteWorkspace={handleDeleteWorkspace}
            />
          </Suspense>
          ) : null}

          {showDeliverySettings ? (
          <Suspense fallback={null}>
          <DeliverySettingsSection
            activeWorkspace={activeWorkspace}
            workspaceDigestSettings={workspaceDigestSettings}
            workspaceDigestEnabled={workspaceDigestEnabled}
            workspaceDigestCadence={workspaceDigestCadence}
            workspaceDigestWeekday={workspaceDigestWeekday}
            workspaceDigestDayOfMonth={workspaceDigestDayOfMonth}
            workspaceDigestHour={workspaceDigestHour}
            workspaceDigestReportType={workspaceDigestReportType}
            workspaceDigestRecipientScope={workspaceDigestRecipientScope}
            workspaceDigestSendEmail={workspaceDigestSendEmail}
            workspaceDigestSendSlack={workspaceDigestSendSlack}
            workspaceDigestSlackDestinationId={workspaceDigestSlackDestinationId}
            workspaceDigestTemplateName={workspaceDigestTemplateName}
            workspaceDigestLoading={workspaceDigestLoading}
            workspaceDigestBusy={workspaceDigestBusy}
            reportTemplates={reportTemplates}
            reportTemplatesLoading={reportTemplatesLoading}
            reportTemplateBusyKey={reportTemplateBusyKey}
            workspaceSlackDestinations={workspaceSlackDestinations}
            slackIntegrationConfigured={
              (workspaceSlackSettings?.configured === true && workspaceSlackSettings?.enabled === true) ||
              workspaceSlackDestinations.length > 0
            }
            onNavigateToSlackIntegration={() => setSettingsSection("integrations")}
            browserTimeZone={browserTimeZone}
            digestWeekdayOptions={digestWeekdayOptions}
            digestCadenceOptions={digestCadenceOptions}
            digestRecipientOptions={digestRecipientOptions}
            digestReportTypeOptions={digestReportTypeOptions}
            intelligenceScope={intelligenceScope}
            intelligenceProjectId={intelligenceProjectId}
            onWorkspaceDigestEnabledChange={setWorkspaceDigestEnabled}
            onWorkspaceDigestCadenceChange={setWorkspaceDigestCadence}
            onWorkspaceDigestWeekdayChange={setWorkspaceDigestWeekday}
            onWorkspaceDigestDayOfMonthChange={setWorkspaceDigestDayOfMonth}
            onWorkspaceDigestHourChange={setWorkspaceDigestHour}
            onWorkspaceDigestReportTypeChange={setWorkspaceDigestReportType}
            onWorkspaceDigestRecipientScopeChange={setWorkspaceDigestRecipientScope}
            onWorkspaceDigestSendEmailChange={setWorkspaceDigestSendEmail}
            onWorkspaceDigestSendSlackChange={setWorkspaceDigestSendSlack}
            onWorkspaceDigestSlackDestinationIdChange={setWorkspaceDigestSlackDestinationId}
            onWorkspaceDigestTemplateNameChange={setWorkspaceDigestTemplateName}
            onSubmit={handleSaveWorkspaceDigestSettings}
            onSendNow={handleSendWorkspaceDigestNow}
            onSaveReportTemplate={handleSaveReportTemplate}
            onApplyReportTemplate={applyReportTemplate}
            onDeleteReportTemplate={handleDeleteReportTemplate}
          />
          </Suspense>
          ) : null}

          {showIntegrationSettings ? (
          <Suspense fallback={null}>
          <IntegrationSettingsSection
            activeWorkspace={activeWorkspace}
            activeWorkspaceLabel={activeWorkspaceLabel}
            workspaceSlackSettings={workspaceSlackSettings}
            workspaceSlackWebhookDraft={workspaceSlackWebhookDraft}
            workspaceSlackLoading={workspaceSlackLoading}
            workspaceSlackBusy={workspaceSlackBusy}
            workspaceSlackEnabled={workspaceSlackEnabled}
            workspaceSlackSendDigests={workspaceSlackSendDigests}
            workspaceNotionSettings={workspaceNotionSettings}
            workspaceNotionLoading={workspaceNotionLoading}
            workspaceNotionBusy={workspaceNotionBusy}
            workspaceNotionEnabled={workspaceNotionEnabled}
            workspaceNotionTokenDraft={workspaceNotionTokenDraft}
            workspaceNotionParentPageDraft={workspaceNotionParentPageDraft}
            integrationError={integrationError}
            onWorkspaceSlackWebhookDraftChange={setWorkspaceSlackWebhookDraft}
            onWorkspaceSlackEnabledChange={setWorkspaceSlackEnabled}
            onWorkspaceSlackSendDigestsChange={setWorkspaceSlackSendDigests}
            onWorkspaceNotionTokenDraftChange={setWorkspaceNotionTokenDraft}
            onWorkspaceNotionParentPageDraftChange={setWorkspaceNotionParentPageDraft}
            onWorkspaceNotionEnabledChange={setWorkspaceNotionEnabled}
            onSlackSubmit={handleSaveWorkspaceSlackSettings}
            onSendSlackTest={handleSendSlackTest}
            onDeleteSlackSettings={handleDeleteWorkspaceSlackSettings}
            onNotionSubmit={handleSaveWorkspaceNotionSettings}
            onValidateNotion={handleValidateWorkspaceNotion}
            onDeleteNotionSettings={handleDeleteWorkspaceNotionSettings}
          />
          </Suspense>
          ) : null}

          {showAccessSettings ? (
          <Suspense fallback={null}>
          <AccessSettingsSection
            activeWorkspace={activeWorkspace}
            activeWorkspaceLabel={activeWorkspaceLabel}
            inviteEmail={inviteEmail}
            inviteRole={inviteRole}
            inviteBusy={inviteBusy}
            memberBusyId={memberBusyId}
            ownerTransferMemberId={ownerTransferMemberId}
            ownerTransferBusy={ownerTransferBusy}
            leaveWorkspaceBusy={leaveWorkspaceBusy}
            workspaceMembers={workspaceMembers}
            workspaceInvites={workspaceInvites}
            workspacePeopleLoading={workspacePeopleLoading}
            workspaceActivity={workspaceActivity}
            workspaceActivityLoading={workspaceActivityLoading}
            ownershipTransferBlockedByBilling={ownershipTransferBlockedByBilling}
            onInviteEmailChange={setInviteEmail}
            onInviteRoleChange={setInviteRole}
            onOwnerTransferMemberIdChange={setOwnerTransferMemberId}
            onInviteSubmit={handleInviteWorkspaceMember}
            onUpdateMemberRole={handleUpdateWorkspaceMemberRole}
            onRemoveMember={handleRemoveWorkspaceMember}
            onResendInvite={handleResendInvite}
            onRevokeInvite={handleRevokeInvite}
            onTransferOwnership={handleTransferWorkspaceOwnership}
            onLeaveWorkspace={handleLeaveWorkspace}
          />
          </Suspense>
          ) : null}
          <Suspense fallback={null}>
            <WorkspaceTasksSurface {...workspaceTasksSurfaceProps} />
          </Suspense>
          <div
            id="intelligence"
            className={`mt-5 rounded-[22px] border border-slate-200 bg-[#fcfbf8] p-4 ${
              workspaceSurface === "intelligence" ? "" : "hidden"
            }`}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Workspace Intelligence
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                  Ask across projects or the whole workspace
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Search for themes, decisions, and follow-ups across processed
                  recordings in one project or across the entire workspace.
                  Answers stay grounded in transcript excerpts and cite their sources.
                </p>
              </div>
              <div className="max-w-md rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                Use this for multi-recording questions like recurring themes,
                decision summaries, or open follow-ups across interviews, meetings,
                and active projects.
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)_auto]">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Scope
                </span>
                <select
                  value={intelligenceScope}
                  onChange={(event) =>
                    setIntelligenceScope(
                      event.target.value === "workspace" ? "workspace" : "project",
                    )
                  }
                  className="mt-2 w-full cursor-pointer rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300"
                >
                  <option value="project">Project</option>
                  <option value="workspace">Workspace</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Project
                </span>
                <select
                  value={intelligenceProjectId}
                  onChange={stableHandleIntelligenceProjectChange}
                  disabled={intelligenceScope === "workspace"}
                  className="mt-2 w-full cursor-pointer rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300"
                >
                  <option value="all" disabled>
                    Choose a project
                  </option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Question
                </span>
                <input
                  type="text"
                  value={intelligenceQuestion}
                  onChange={(event) => setIntelligenceQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleProjectIntelligenceSubmit();
                    }
                  }}
                  placeholder="What recurring concerns came up across these calls?"
                  className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => void handleProjectIntelligenceSubmit()}
                  disabled={
                    intelligenceBusy ||
                    (intelligenceScope === "project" &&
                      intelligenceProjectId === "all") ||
                    !intelligenceQuestion.trim()
                  }
                  className="cursor-pointer rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {intelligenceBusy
                    ? "Thinking..."
                    : intelligenceScope === "workspace"
                      ? "Ask Workspace"
                      : "Ask Project"}
                </button>
              </div>
            </div>
            {intelligenceScope === "workspace" ? (
              <div className="mt-4 rounded-[18px] border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Workspace Project Scope
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Leave this empty to search the whole workspace, or narrow the
                      answer to selected projects only.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">
                    {workspaceIntelligenceProjectIds.length
                      ? `${workspaceIntelligenceProjectIds.length} selected`
                      : "All workspace projects"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {projects.map((project) => {
                    const selected = workspaceIntelligenceProjectIds.includes(project.id);
                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => handleToggleWorkspaceIntelligenceProject(project.id)}
                        className={`cursor-pointer rounded-full border px-4 py-2 text-xs font-semibold ${
                          selected
                            ? "border-slate-900 bg-slate-950 text-white"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        {project.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <Suspense fallback={null}>
            <ProjectDigestPanel
              intelligenceScope={intelligenceScope}
              intelligenceProjectId={intelligenceProjectId}
              activeWorkspace={activeWorkspace}
              projectDigestSettings={projectDigestSettings}
              projectDigestEnabled={projectDigestEnabled}
              projectDigestLoading={projectDigestLoading}
              projectDigestCadence={projectDigestCadence}
              projectDigestReportType={projectDigestReportType}
              projectDigestRecipientScope={projectDigestRecipientScope}
              projectDigestSendEmail={projectDigestSendEmail}
              projectDigestSendSlack={projectDigestSendSlack}
              projectDigestSlackDestinationId={projectDigestSlackDestinationId}
              projectDigestWeekday={projectDigestWeekday}
              projectDigestDayOfMonth={projectDigestDayOfMonth}
              projectDigestHour={projectDigestHour}
              projectDigestBusy={projectDigestBusy}
              projectDigestTemplateName={projectDigestTemplateName}
              reportTemplateBusyKey={reportTemplateBusyKey}
              workspaceSlackDestinations={workspaceSlackDestinations}
              workspaceSlackDestinationName={workspaceSlackDestinationName}
              workspaceSlackDestinationWebhook={workspaceSlackDestinationWebhook}
              workspaceSlackDestinationBusy={workspaceSlackDestinationBusy}
              digestReportTypeOptions={digestReportTypeOptions}
              digestCadenceOptions={digestCadenceOptions}
              digestRecipientOptions={digestRecipientOptions}
              digestWeekdayOptions={digestWeekdayOptions}
              setProjectDigestEnabled={setProjectDigestEnabled}
              setProjectDigestCadence={setProjectDigestCadence}
              setProjectDigestReportType={setProjectDigestReportType}
              setProjectDigestRecipientScope={setProjectDigestRecipientScope}
              setProjectDigestSendEmail={setProjectDigestSendEmail}
              setProjectDigestSendSlack={setProjectDigestSendSlack}
              setProjectDigestSlackDestinationId={setProjectDigestSlackDestinationId}
              setProjectDigestWeekday={setProjectDigestWeekday}
              setProjectDigestDayOfMonth={setProjectDigestDayOfMonth}
              setProjectDigestHour={setProjectDigestHour}
              setProjectDigestTemplateName={setProjectDigestTemplateName}
              setWorkspaceSlackDestinationName={setWorkspaceSlackDestinationName}
              setWorkspaceSlackDestinationWebhook={setWorkspaceSlackDestinationWebhook}
              handleSaveProjectDigestSettings={handleSaveProjectDigestSettings}
              handleSendProjectDigestNow={handleSendProjectDigestNow}
              handleSaveReportTemplate={handleSaveReportTemplate}
              handleCreateSlackDestination={handleCreateSlackDestination}
              handleDeleteSlackDestination={handleDeleteSlackDestination}
            />
            </Suspense>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                "Summarize this project in five bullets.",
                "What recurring themes came up across these recordings?",
                "Which action items are still open across this project?",
                "What concerns or risks were mentioned most often?",
              ].map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => {
                    handleProjectIntelligenceSuggestion(question);
                    void handleProjectIntelligenceSubmit(question);
                  }}
                  disabled={
                    intelligenceBusy ||
                    (intelligenceScope === "project" &&
                      intelligenceProjectId === "all")
                  }
                  className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </div>
            {intelligenceResult ? (
              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.9fr)]">
                <div className="rounded-[20px] border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Answer
                    </h4>
                    {intelligenceResult.coverage ? (
                      <span className="text-xs font-semibold text-slate-400">
                        {intelligenceResult.coverage.transcriptCount} transcripts ·{" "}
                        {intelligenceResult.coverage.chunkCount} excerpts
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 prose prose-sm max-w-none text-slate-700">
                    <ReactMarkdown>{intelligenceResult.answer || ""}</ReactMarkdown>
                  </div>
                  {intelligenceResult.confidenceNote ? (
                    <p className="mt-4 rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      {intelligenceResult.confidenceNote}
                    </p>
                  ) : null}
                  <div className="mt-4 rounded-[18px] border border-slate-200 bg-[#fcfbf8] p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                      <label className="flex-1">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Save Insight
                        </span>
                        <input
                          type="text"
                          value={
                            intelligenceScope === "project"
                              ? intelligenceTitleDraft
                              : workspaceInsightTitleDraft
                          }
                          onChange={(event) =>
                            intelligenceScope === "project"
                              ? setIntelligenceTitleDraft(event.target.value)
                              : setWorkspaceInsightTitleDraft(event.target.value)
                          }
                          placeholder="Name this insight for the team"
                          className="mt-2 w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          void (intelligenceScope === "project"
                            ? handleSaveProjectInsight()
                            : handleSaveWorkspaceInsight())
                        }
                        disabled={
                          (intelligenceScope === "project"
                            ? projectInsightBusyKey === "save"
                            : workspaceInsightBusyKey === "save") ||
                          !intelligenceResult.answer ||
                          (intelligenceScope === "project" &&
                            intelligenceProjectId === "all")
                        }
                        className="cursor-pointer rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {(intelligenceScope === "project"
                          ? projectInsightBusyKey === "save"
                          : workspaceInsightBusyKey === "save")
                          ? "Saving..."
                          : intelligenceScope === "project"
                            ? "Save Insight"
                            : "Save Workspace Insight"}
                      </button>
                    </div>
                    <p className="mt-3 text-xs leading-6 text-slate-500">
                      {intelligenceScope === "project"
                        ? "Saved insights keep the answer, question, and cited excerpts so the project team can reopen them later without rerunning AI."
                        : "Saved workspace insights keep the answer, scope, and cited excerpts so the whole team can reopen them later without rerunning AI."}
                    </p>
                  </div>
                </div>
                <div className="rounded-[20px] border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Sources
                    </h4>
                    <span className="text-xs font-semibold text-slate-400">
                      {intelligenceResult.sources?.length || 0}
                    </span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {intelligenceResult.sources?.length ? (
                      intelligenceResult.sources.map((source) => (
                        <div
                          key={source.sourceId}
                          className="rounded-[16px] border border-slate-200 bg-[#fcfbf8] px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {source.fileName}
                              </p>
                              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                {source.sourceId}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenTranscriptionById(source.transcriptionId)}
                              className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700"
                            >
                              Open Transcript
                            </button>
                          </div>
                          <p className="mt-3 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                            {source.excerpt}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">
                        No source excerpts were returned for this answer.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-[20px] border border-dashed border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-500">
                Pick a project and ask a question to synthesize multiple processed
                transcripts with source citations.
              </div>
            )}
            <Suspense fallback={null}>
              <SavedInsightsPanel {...savedInsightsPanelProps} />
            </Suspense>
          </div>
        </section>
        {isOverviewSurface ? (
          <OverviewSurface
            resultAreaRef={resultAreaRef}
            isResolving={isOverviewDataResolving}
            workspaceSwitching={workspaceSwitching}
            activeWorkspace={activeWorkspace}
            focusedSummary={focusedSummary}
            overviewUploadPanelVersion={overviewUploadPanelVersion}
            overviewUploadPanelStartExpanded={overviewUploadPanelStartExpanded}
            uploadBodyProps={sharedUploadBodyProps}
            currentRecordingProps={overviewCurrentRecordingProps}
          />
        ) : null}

        {workspaceSurface === "upload" ? (
        <section
          id="upload"
          className="rounded-[28px] border border-white/80 bg-white/90 p-6 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)] sm:p-7"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-700">
                Upload
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">
                Drop in a recording and let Voxly shape it.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Choose a notes template, upload your file, and Voxly will turn
                the recording into a transcript, summary, and action-ready
                output.
              </p>
            </div>
          </div>
          <UploadPanelBody {...sharedUploadBodyProps} />

          {shouldShowGlobalError && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800 shadow-sm">
              <p>{error}</p>
              {shouldShowBuyCreditsButton ? (
                <Link
                  href="/billing"
                  className="mt-3 inline-flex rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white"
                >
                  Buy Credits
                </Link>
              ) : null}
            </div>
          )}
        </section>
        ) : null}

        <HistorySurface
          key={activeWorkspaceId || "workspace-pending"}
          {...historySurfaceProps}
        />
      </div>

      <aside
        id="assistant"
        className={`self-start lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] ${
          workspaceSurface === "settings" ? "hidden" : ""
        }`}
      >
        <AssistantRail
          projects={projects}
          activeWorkspace={activeWorkspace}
          assistantBusy={assistantBusy}
          assistantRefreshing={assistantRefreshing}
          assistantHistoryLoading={assistantHistoryLoading}
          assistantError={assistantError}
          assistantMessages={assistantMessages}
          hasProcessedSummary={hasProcessedSummary}
          initialScope={assistantScope}
          initialProjectId={assistantProjectId}
          initialWorkspaceProjectIds={assistantWorkspaceProjectIds}
          suggestions={assistantScopeSuggestions}
          onRefresh={stableHandleRefreshNotes}
          onSubmit={stableHandleAssistantSubmit}
        />
      </aside>
      </div>
      )}
    </div>
  );
}
