"use client";

import {
  type FormEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useId,
  useRef,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import type { BillingInfo, BillingResponse } from "@/lib/billing-types";

type ActionItem = {
  text: string;
  priority?: string;
  assignee?: string;
};

type ActionTask = {
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

type Transcription = {
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

type Project = {
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

type ActiveWorkspaceDetails = {
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

type WorkspaceMemberEntry = {
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

type WorkspaceInviteEntry = {
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

type WorkspaceActivityEntry = {
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

type WorkspaceComment = {
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

type WorkspaceNotification = {
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

type ProjectIntelligenceSource = {
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

type SavedProjectInsight = {
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

type SavedWorkspaceInsight = {
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

type RecurringReportTemplate = {
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

type WorkspaceDigestSettings = {
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

type ProjectDigestSettings = {
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

type WorkspaceSlackSettings = {
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

type WorkspaceSlackDestination = {
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

type RecurringReportRun = {
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

type ReportRunSummary = {
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

type UserNotificationPreferences = {
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

type WorkspaceNotionSettings = {
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

type UploadPanelBodyProps = {
  fileInputId: string;
  file: File | null;
  onFileChange: (nextFile: File | null) => void;
  estimatedDurationSeconds: number | null;
  isDev: boolean;
  testDataLoading: boolean;
  testDataStatus: string | null;
  onLoadTestData: () => void;
  uploadTemplate: string;
  onUploadTemplateChange: (value: string) => void;
  templateOptions: Array<{ id: string; label: string }>;
  templatesStatusText: string;
  templateBusy: boolean;
  onCreateTemplate: (input: {
    name: string;
    baseTemplate: string;
    promptInstructions: string;
  }) => Promise<boolean>;
  uploadProjectId: string;
  onUploadProjectIdChange: (value: string) => void;
  projects: Project[];
  projectsStatusText: string;
  projectBusy: boolean;
  onCreateProject: (input: {
    name: string;
    description: string;
  }) => Promise<boolean>;
  onUpload: (event: FormEvent<HTMLFormElement>) => void;
  uploading: boolean;
  durationLoading: boolean;
  hasEnoughEstimatedCredits: boolean;
  estimatedCredits: number | null;
  billing: BillingInfo | null;
};

const UploadPanelBody = memo(function UploadPanelBody({
  fileInputId,
  file,
  onFileChange,
  estimatedDurationSeconds,
  isDev,
  testDataLoading,
  testDataStatus,
  onLoadTestData,
  uploadTemplate,
  onUploadTemplateChange,
  templateOptions,
  templatesStatusText,
  templateBusy,
  onCreateTemplate,
  uploadProjectId,
  onUploadProjectIdChange,
  projects,
  projectsStatusText,
  projectBusy,
  onCreateProject,
  onUpload,
  uploading,
  durationLoading,
  hasEnoughEstimatedCredits,
  estimatedCredits,
  billing,
}: UploadPanelBodyProps) {
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [projectManagerOpen, setProjectManagerOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateBase, setNewTemplateBase] = useState("default");
  const [newTemplateInstructions, setNewTemplateInstructions] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");

  return (
    <>
      <input
        id={fileInputId}
        type="file"
        accept="audio/*"
        onChange={(event) => onFileChange(event.target.files?.[0] || null)}
        className="hidden"
      />

      <div className="mt-5 rounded-[24px] border border-slate-200 bg-[#fcfbf8] p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.18)]">
        <label
          htmlFor={fileInputId}
          className="block cursor-pointer rounded-[20px] border border-dashed border-[#e6dccf] bg-[linear-gradient(180deg,#fbf8f2_0%,#fffdf9_100%)] p-5 transition-all duration-200 hover:border-[#d7cab7] hover:bg-[#f8f3eb]"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 text-left">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/90">
                <svg
                  className="h-5 w-5 text-orange-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v8"
                  />
                </svg>
              </div>
              <div>
                <p className="text-base font-semibold text-slate-950">
                  {file ? file.name : "Select an audio file"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  MP3, M4A, WAV up to 500MB
                </p>
              </div>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-center text-sm font-semibold text-slate-700">
              Choose File
            </span>
          </div>
          {file ? (
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600">
                {(file.size / (1024 * 1024)).toFixed(1)} MB
              </span>
              {estimatedDurationSeconds ? (
                <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 font-medium text-orange-700">
                  ~{Math.ceil(estimatedDurationSeconds / 60)} credits
                </span>
              ) : null}
              {estimatedDurationSeconds ? (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600">
                  {Math.round(estimatedDurationSeconds)} sec
                </span>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No file selected yet.</p>
          )}
        </label>

        {isDev ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-[#f2f7ff] hover:text-sky-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
              onClick={onLoadTestData}
              disabled={testDataLoading}
            >
              {testDataLoading ? "Loading..." : "Load Test File"}
            </button>
          </div>
        ) : null}
        {testDataStatus ? (
          <p className="mt-3 text-sm font-medium text-emerald-600">{testDataStatus}</p>
        ) : null}

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Template
            </label>
            <select
              value={uploadTemplate}
              onChange={(event) => onUploadTemplateChange(event.target.value)}
              className="mt-2 w-full cursor-pointer rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300"
            >
              {templateOptions.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label}
                </option>
              ))}
            </select>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTemplateManagerOpen((prev) => !prev)}
                className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-[#f8f5ef]"
              >
                {templateManagerOpen ? "Hide custom templates" : "Manage templates"}
              </button>
              <span className="text-xs text-slate-500">{templatesStatusText}</span>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Project
            </label>
            <select
              value={uploadProjectId}
              onChange={(event) => onUploadProjectIdChange(event.target.value)}
              className="mt-2 w-full cursor-pointer rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300"
            >
              <option value="none">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setProjectManagerOpen((prev) => !prev)}
                className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-[#f8f5ef]"
              >
                {projectManagerOpen ? "Hide projects" : "Manage projects"}
              </button>
              <span className="text-xs text-slate-500">{projectsStatusText}</span>
            </div>
          </div>
        </div>

        {templateManagerOpen ? (
          <div className="mt-5 rounded-[18px] border border-slate-200 bg-white p-4">
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                const saved = await onCreateTemplate({
                  name: newTemplateName,
                  baseTemplate: newTemplateBase,
                  promptInstructions: newTemplateInstructions,
                });
                if (saved) {
                  setNewTemplateName("");
                  setNewTemplateBase("default");
                  setNewTemplateInstructions("");
                  setTemplateManagerOpen(false);
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Template name
                </label>
                <input
                  value={newTemplateName}
                  onChange={(event) => setNewTemplateName(event.target.value)}
                  className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                  placeholder="Candidate Evaluation"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Base template
                </label>
                <select
                  value={newTemplateBase}
                  onChange={(event) => setNewTemplateBase(event.target.value)}
                  className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                >
                  {builtInTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Custom instructions
                </label>
                <textarea
                  value={newTemplateInstructions}
                  onChange={(event) => setNewTemplateInstructions(event.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                  placeholder="Focus on strengths, weaknesses, evidence, and recommendation."
                />
              </div>
              <button
                type="submit"
                disabled={
                  templateBusy ||
                  !newTemplateName.trim() ||
                  !newTemplateInstructions.trim()
                }
                className="cursor-pointer rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {templateBusy ? "Saving..." : "Save Template"}
              </button>
            </form>
          </div>
        ) : null}

        {projectManagerOpen ? (
          <div className="mt-5 rounded-[18px] border border-slate-200 bg-white p-4">
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                const saved = await onCreateProject({
                  name: newProjectName,
                  description: newProjectDescription,
                });
                if (saved) {
                  setNewProjectName("");
                  setNewProjectDescription("");
                  setProjectManagerOpen(false);
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Project name
                </label>
                <input
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                  placeholder="Candidate Interviews"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Description
                </label>
                <textarea
                  value={newProjectDescription}
                  onChange={(event) => setNewProjectDescription(event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                  placeholder="Group related transcripts into one workspace."
                />
              </div>
              <button
                type="submit"
                disabled={projectBusy || !newProjectName.trim()}
                className="cursor-pointer rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {projectBusy ? "Saving..." : "Save Project"}
              </button>
            </form>
          </div>
        ) : null}

        <form onSubmit={onUpload} className="mt-6 border-t border-slate-200 pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">Ready to process</p>
              <p className="mt-1 text-sm text-slate-500">
                Upload your recording and let Voxly continue processing in the background.
              </p>
            </div>
            <button
              type="submit"
              disabled={!file || uploading || durationLoading || !hasEnoughEstimatedCredits}
              className="cursor-pointer rounded-full bg-[#f97316] px-8 py-3 text-sm font-bold text-white shadow-[0_18px_34px_-18px_rgba(249,115,22,0.9)] hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:bg-[#fdc9a8] disabled:text-white/90 disabled:opacity-100 active:scale-95 disabled:active:scale-100"
            >
              {uploading
                ? "Uploading..."
                : durationLoading
                  ? "Reading duration..."
                  : "Start Voxly"}
            </button>
          </div>
          {!file ? (
            <p className="mt-3 text-xs text-slate-500">
              Choose a file to enable Start Voxly.
            </p>
          ) : null}
          {!hasEnoughEstimatedCredits && estimatedCredits ? (
            <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This file is estimated to require {estimatedCredits} credits, but this
              workspace currently has only {billing?.creditsRemaining ?? 0} remaining
              through the owner billing account.
            </p>
          ) : null}
          {!hasEnoughEstimatedCredits && estimatedCredits && billing ? (
            <p className="mt-2 text-xs text-slate-500">
              Billing owner: {billing.billingOwner.name?.trim() || billing.billingOwner.email}. Open billing details to top up credits or change the plan.
            </p>
          ) : null}
        </form>
      </div>
    </>
  );
});

type OverviewUploadSectionProps = {
  hasFocusedSummary: boolean;
  startExpanded: boolean;
  bodyProps: UploadPanelBodyProps;
};

const OverviewUploadSection = memo(function OverviewUploadSection({
  hasFocusedSummary,
  startExpanded,
  bodyProps,
}: OverviewUploadSectionProps) {
  const [isOpen, setIsOpen] = useState(startExpanded || !hasFocusedSummary);

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
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
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`cursor-pointer self-start rounded-full px-4 py-2 text-xs font-semibold ${
            isOpen
              ? "border border-slate-200 bg-white text-slate-700"
              : "bg-[#f97316] px-5 py-2.5 text-sm text-white shadow-[0_16px_34px_-18px_rgba(249,115,22,0.65)] hover:bg-[#ea580c]"
          }`}
        >
          {isOpen ? "Hide Upload" : "Upload Another"}
        </button>
      </div>

      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? "max-h-[2400px] opacity-100" : "max-h-0 opacity-0"
        }`}
        aria-hidden={!isOpen}
      >
        <UploadPanelBody {...bodyProps} />
      </div>
    </>
  );
});

type OverviewCurrentRecordingProps = {
  activeWorkspace: ActiveWorkspaceDetails | null;
  focusedSummary: Transcription | null;
  displaySummary:
    | Pick<Transcription, "decisions" | "keyPoints" | "nextSteps" | "actionItems">
    | null;
  selectedProjectName: string;
  currentRecordingText: string;
  currentRecordingSnippet: string;
  hasExpandableCurrentRecordingText: boolean;
  focusedSummaryHiddenByFilters: boolean;
  isFocusedSummaryProcessing: boolean;
  canProcessFocusedSummary: boolean;
  currentActionTasks: ActionTask[];
  activeTranscriptionId: string | null;
  actionTaskBusyKey: string | null;
  onProcess: (transcriptionId: string, template?: string | null) => void;
  onCopySummary: () => void;
  onStartUpload: () => void;
  onCreateActionTask: (input: {
    title: string;
    priority?: string;
    assignee?: string;
    dueDate?: string;
    sourceActionIndex?: number;
  }) => Promise<boolean>;
  onUpdateActionTask: (
    taskId: string,
    updates: Partial<Pick<ActionTask, "status" | "assignee" | "dueDate">>,
  ) => Promise<void>;
  onDeleteActionTask: (taskId: string) => Promise<void>;
};

const OverviewCurrentRecording = memo(function OverviewCurrentRecording({
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
  onProcess,
  onCopySummary,
  onStartUpload,
  onCreateActionTask,
  onUpdateActionTask,
  onDeleteActionTask,
}: OverviewCurrentRecordingProps) {
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  return (
    <>
      <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-[0_12px_36px_-28px_rgba(15,23,42,0.18)] sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
              Current Workspace:{" "}
              <span className="font-semibold normal-case tracking-normal text-slate-900">
                {activeWorkspace?.name || "No workspace selected"}
                {activeWorkspace?.isPersonal ? " (Personal)" : ""}
              </span>
            </p>
            <p className="mt-1.5 truncate text-lg font-semibold text-slate-950">
              {focusedSummary?.fileName || "No recording in progress yet"}
            </p>
            {focusedSummary ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-[#fcfbf8] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                  {focusedSummary.status}
                </span>
                {focusedSummary.template ? (
                  <span className="rounded-full border border-slate-200 bg-[#fcfbf8] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                    {focusedSummary.template}
                  </span>
                ) : null}
                {focusedSummary.projectId ? (
                  <span className="rounded-full border border-slate-200 bg-[#fcfbf8] px-3 py-1 text-[11px] font-semibold text-slate-600">
                    {selectedProjectName}
                  </span>
                ) : null}
                <span className="rounded-full border border-slate-200 bg-[#fcfbf8] px-3 py-1 text-[11px] font-semibold text-slate-600">
                  Updated {new Date(focusedSummary.updatedAt).toLocaleDateString()}
                </span>
              </div>
            ) : null}
            <div className="mt-3 max-w-3xl">
              <p className="text-sm leading-6 text-slate-600">
                {focusedSummary
                  ? isTextExpanded
                    ? currentRecordingText ||
                      "Voxly is ready to help you continue this recording."
                    : currentRecordingSnippet ||
                      "Voxly is ready to help you continue this recording."
                  : "Upload a new recording above to start building your next transcript, summary, and action-ready notes."}
              </p>
              {focusedSummary && hasExpandableCurrentRecordingText ? (
                <button
                  type="button"
                  onClick={() => setIsTextExpanded((prev) => !prev)}
                  className="mt-3 inline-flex cursor-pointer items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-[#f8f5ef]"
                >
                  {isTextExpanded ? "Show less" : "Show more"}
                </button>
              ) : null}
            </div>
            {focusedSummaryHiddenByFilters ? (
              <p className="mt-3 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                This selected transcript is hidden by the current filters.
              </p>
            ) : null}
          </div>
          {focusedSummary ? (
            <div className="flex flex-wrap gap-2 lg:max-w-[24rem] lg:justify-end">
              <button
                type="button"
                onClick={() => setIsDetailsOpen((prev) => !prev)}
                className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-[#f8f5ef]"
              >
                {isDetailsOpen ? "Hide Details" : "Show Details"}
              </button>
              <button
                type="button"
                onClick={() => onProcess(focusedSummary.id, focusedSummary.template)}
                disabled={!canProcessFocusedSummary}
                className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold ${
                  isFocusedSummaryProcessing
                    ? "border border-sky-200 bg-sky-50 text-sky-700"
                    : "bg-slate-950 text-white"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {isFocusedSummaryProcessing
                  ? "Processing..."
                  : focusedSummary.status === "done"
                    ? "Reprocess Recording"
                    : "Process Recording"}
              </button>
              <button
                type="button"
                onClick={onCopySummary}
                className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-[#f8f5ef]"
              >
                Copy Summary
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onStartUpload}
              className="cursor-pointer rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white"
            >
              Start Upload
            </button>
          )}
        </div>
      </div>
      <div className={`space-y-8 ${focusedSummary && isDetailsOpen ? "min-h-[24rem]" : "hidden"}`}>
        {[
          {
            title: "Decisions",
            items: displaySummary?.decisions,
          },
          {
            title: "Key Points",
            items: displaySummary?.keyPoints,
          },
          {
            title: "Next Steps",
            items: displaySummary?.nextSteps,
          },
        ].map((block) => (
          <div key={block.title} className="space-y-3">
            <h3 className="text-xl font-semibold text-slate-900">{block.title}</h3>
            <div className="space-y-3">
              {block.items && Array.isArray(block.items) && block.items.length ? (
                block.items.map((item, idx) => {
                  const itemText =
                    typeof item === "string" ? item : (item as ActionItem)?.text;
                  const itemAssignee =
                    typeof item === "string" ? undefined : (item as ActionItem)?.assignee;
                  return (
                    <div
                      key={`${block.title}-${idx}`}
                      className="flex gap-4 rounded-[24px] border border-white/80 bg-white/88 p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.2)]"
                    >
                      <div className="w-1.5 rounded-full bg-orange-300" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold leading-relaxed text-slate-900">
                          {itemText}
                        </p>
                        {itemAssignee && itemText !== itemAssignee ? (
                          <p className="mt-1 text-xs text-slate-500">{itemAssignee}</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[24px] border border-white/80 bg-white/88 p-5 text-sm text-slate-400 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.2)]">
                  No data yet.
                </div>
              )}
            </div>
          </div>
        ))}

        <div className="space-y-3">
          <h3 className="text-xl font-semibold text-slate-900">Action Items</h3>
          <div className="space-y-3">
            {displaySummary?.actionItems && displaySummary.actionItems.length ? (
              displaySummary.actionItems.map((item, idx) => {
                const linkedTask = currentActionTasks.find(
                  (task) => task.sourceActionIndex === idx,
                );

                return (
                  <div
                    key={`Action Items-${idx}`}
                    className="rounded-[24px] border border-white/80 bg-white/88 p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.2)]"
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-1 h-5 w-5 rounded-full border border-orange-300 bg-orange-50" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold leading-relaxed text-slate-900">
                          {item.text}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className={`rounded-full px-2.5 py-1 font-bold ${
                              item.priority === "HIGH"
                                ? "bg-red-100 text-red-700"
                                : item.priority === "MEDIUM"
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {item.priority || "MEDIUM"}
                          </span>
                          <span className="text-slate-500">
                            @{item.assignee && item.assignee.trim() ? item.assignee : "Unassigned"}
                          </span>
                          {linkedTask ? (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-bold text-emerald-700">
                              Tracking: {linkedTask.status.replace("_", " ")}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {linkedTask ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
                          Tracked
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            setIsCreatingTask(true);
                            await onCreateActionTask({
                              title: item.text,
                              priority: item.priority || "MEDIUM",
                              assignee: item.assignee || "",
                              sourceActionIndex: idx,
                            });
                            setIsCreatingTask(false);
                          }}
                          disabled={isCreatingTask}
                          className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Track Task
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[24px] border border-white/80 bg-white/88 p-5 text-sm text-slate-400 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.2)]">
                No data yet.
              </div>
            )}
          </div>
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-[#fffdf9] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <label className="flex-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Add Task
                </span>
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(event) => setNewTaskTitle(event.target.value)}
                  placeholder="Create a follow-up that isn’t in the AI summary yet"
                  className="mt-2 w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                />
              </label>
              <label className="lg:w-48">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Assignee
                </span>
                <input
                  type="text"
                  value={newTaskAssignee}
                  onChange={(event) => setNewTaskAssignee(event.target.value)}
                  placeholder="Owner"
                  className="mt-2 w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                />
              </label>
              <label className="lg:w-44">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Due Date
                </span>
                <input
                  type="date"
                  value={newTaskDueDate}
                  onChange={(event) => setNewTaskDueDate(event.target.value)}
                  className="mt-2 w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                />
              </label>
              <button
                type="button"
                onClick={async () => {
                  setIsCreatingTask(true);
                  const saved = await onCreateActionTask({
                    title: newTaskTitle,
                    assignee: newTaskAssignee,
                    dueDate: newTaskDueDate,
                  });
                  if (saved) {
                    setNewTaskTitle("");
                    setNewTaskAssignee("");
                    setNewTaskDueDate("");
                  }
                  setIsCreatingTask(false);
                }}
                disabled={
                  !newTaskTitle.trim() ||
                  !activeTranscriptionId ||
                  isCreatingTask
                }
                className="cursor-pointer rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreatingTask ? "Saving..." : "Save Task"}
              </button>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Managed Tasks
              </h4>
              <span className="text-xs font-semibold text-slate-400">
                {currentActionTasks.length} total
              </span>
            </div>
            {currentActionTasks.length ? (
              currentActionTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-[24px] border border-slate-200 bg-[#fcfbf8] p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.16)]"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-relaxed text-slate-900">
                        {task.title}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`rounded-full px-2.5 py-1 font-bold ${
                            task.priority === "HIGH"
                              ? "bg-red-100 text-red-700"
                              : task.priority === "MEDIUM"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {task.priority}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 font-bold ${
                            task.status === "done"
                              ? "bg-emerald-100 text-emerald-700"
                              : task.status === "in_progress"
                                ? "bg-sky-100 text-sky-700"
                                : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {task.status.replace("_", " ")}
                        </span>
                        <span className="text-slate-500">@{task.assignee?.trim() || "Unassigned"}</span>
                        {task.dueDate ? (
                          <span className="text-slate-500">
                            Due {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={task.status}
                        onChange={(event) =>
                          void onUpdateActionTask(task.id, {
                            status: event.target.value as ActionTask["status"],
                          })
                        }
                        disabled={actionTaskBusyKey === `update:${task.id}`}
                        className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                      <input
                        type="text"
                        defaultValue={task.assignee || ""}
                        placeholder="Assignee"
                        onBlur={(event) =>
                          void onUpdateActionTask(task.id, {
                            assignee: event.target.value,
                          })
                        }
                        disabled={actionTaskBusyKey === `update:${task.id}`}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <input
                        type="date"
                        defaultValue={task.dueDate ? task.dueDate.slice(0, 10) : ""}
                        onBlur={(event) =>
                          void onUpdateActionTask(task.id, {
                            dueDate: event.target.value,
                          })
                        }
                        disabled={actionTaskBusyKey === `update:${task.id}`}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <button
                        type="button"
                        onClick={() => void onDeleteActionTask(task.id)}
                        disabled={actionTaskBusyKey === `delete:${task.id}`}
                        className="cursor-pointer rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[24px] border border-white/80 bg-white/88 p-5 text-sm text-slate-400 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.2)]">
                No managed tasks yet. Track an AI action item or add one manually.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
});

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
  initialSettingsSection?:
    | "workspace"
    | "delivery"
    | "integrations"
    | "access"
    | "personal";
  initialSettingsMode?: "workspace" | "personal";
  initialProjectFilter?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const fileInputId = useId();
  const assistantInputRef = useRef<HTMLInputElement | null>(null);
  const resultAreaRef = useRef<HTMLElement | null>(null);
  const shouldScrollToSummaryRef = useRef(false);
  const listRequestAbortRef = useRef<AbortController | null>(null);
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
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [templateFilter, setTemplateFilter] = useState("all");
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
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [workspaceSwitching, setWorkspaceSwitching] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberEntry[]>([]);
  const [workspaceInvites, setWorkspaceInvites] = useState<WorkspaceInviteEntry[]>([]);
  const [workspacePeopleLoading, setWorkspacePeopleLoading] = useState(true);
  const [workspaceActivity, setWorkspaceActivity] = useState<WorkspaceActivityEntry[]>([]);
  const [workspaceActivityLoading, setWorkspaceActivityLoading] = useState(true);
  const [activeWorkspace, setActiveWorkspace] = useState<ActiveWorkspaceDetails | null>(
    null,
  );
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    email: string;
    name?: string | null;
  } | null>(null);
  const [workspaceSettingsBusy, setWorkspaceSettingsBusy] = useState(false);
  const [workspaceDraftName, setWorkspaceDraftName] = useState("");
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
  const [uploadProjectId, setUploadProjectId] = useState("none");
  const [file, setFile] = useState<File | null>(null);
  const [estimatedDurationSeconds, setEstimatedDurationSeconds] = useState<
    number | null
  >(null);
  const [durationLoading, setDurationLoading] = useState(false);
  const [uploadTemplate, setUploadTemplate] = useState("default");
  const [testDataLoading, setTestDataLoading] = useState(false);
  const [testDataStatus, setTestDataStatus] = useState<string | null>(null);
  const [expandedTranscripts, setExpandedTranscripts] = useState<
    Record<string, boolean>
  >({});
  const [processingIds, setProcessingIds] = useState<Record<string, boolean>>(
    {},
  );
  const [focusedSummaryId, setFocusedSummaryId] = useState<string | null>(null);
  const [assistantPrompt, setAssistantPrompt] = useState("");
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
  const [, setTranscriptionCommentsById] = useState<Record<string, WorkspaceComment[]>>(
    {},
  );
  const [, setTaskCommentsById] = useState<Record<string, WorkspaceComment[]>>({});
  const [projectInsightCommentsById, setProjectInsightCommentsById] = useState<
    Record<string, WorkspaceComment[]>
  >({});
  const [workspaceInsightCommentsById, setWorkspaceInsightCommentsById] = useState<
    Record<string, WorkspaceComment[]>
  >({});
  const [commentBusyKey, setCommentBusyKey] = useState<string | null>(null);
  const [, setTranscriptionCommentDraft] = useState("");
  const [, setTaskCommentDrafts] = useState<Record<string, string>>({});
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
  const [workspaceSurface, setWorkspaceSurface] = useState<
    | "overview"
    | "upload"
    | "transcriptions"
    | "intelligence"
    | "operations"
    | "settings"
  >(initialSurface);
  const [settingsSection, setSettingsSection] = useState<
    "workspace" | "delivery" | "integrations" | "access" | "personal"
  >(initialSettingsSection);

  const templateOptions = [
    ...builtInTemplates,
    ...customTemplates.map((template) => ({
      id: `custom:${template.id}`,
      label: `${template.name} (Custom)`,
    })),
  ];
  const statusOptions = [
    { id: "all", label: "All statuses" },
    { id: "uploading", label: "Uploading" },
    { id: "uploaded", label: "Uploaded" },
    { id: "processing", label: "Processing" },
    { id: "done", label: "Done" },
    { id: "error", label: "Error" },
  ];
  const taskStatusOptions = [
    { id: "all", label: "All tasks" },
    { id: "open", label: "Open" },
    { id: "in_progress", label: "In Progress" },
    { id: "done", label: "Done" },
  ];
  const taskAssignmentOptions = [
    { id: "all", label: "Everyone" },
    { id: "mine", label: "Assigned to me" },
    { id: "unassigned", label: "Unassigned" },
  ];
  const projectInsightFilterOptions = [
    { id: "active", label: "Active" },
    { id: "pinned", label: "Pinned" },
    { id: "archived", label: "Archived" },
    { id: "all", label: "All" },
  ];
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
  const pinnedProjectFilter =
    workspaceSurface === "transcriptions" && initialProjectFilter !== "all"
      ? initialProjectFilter
      : "all";
  const isDev = process.env.NODE_ENV !== "production";
  const hasActiveFilters =
    debouncedSearchQuery.trim().length > 0 ||
    statusFilter !== "all" ||
    templateFilter !== "all" ||
    projectFilter !== pinnedProjectFilter;

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
  const showWorkspaceSelector =
    workspaceSurface !== "settings" && workspaceSurface !== "overview";
  const currentActionTasks = activeTranscriptionId
    ? actionTasksByTranscription[activeTranscriptionId] || []
    : [];
  const currentProjectInsightComments = selectedProjectInsightId
    ? projectInsightCommentsById[selectedProjectInsightId] || []
    : [];
  const currentWorkspaceInsightComments = selectedWorkspaceInsightId
    ? workspaceInsightCommentsById[selectedWorkspaceInsightId] || []
    : [];
  const focusedSummaryHiddenByFilters =
    !!focusedSummaryId && !sortedItems.some((item) => item.id === focusedSummaryId);
  const isFocusedSummaryProcessing = !!(
    focusedSummary && processingIds[focusedSummary.id]
  ) || focusedSummary?.status === "processing";
  const canProcessFocusedSummary = !!focusedSummary && !isFocusedSummaryProcessing;
  const isUploadSurfaceVisible =
    workspaceSurface === "upload" || workspaceSurface === "overview";
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

  const loadItems = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? true;
    if (listRequestAbortRef.current) {
      listRequestAbortRef.current.abort();
    }
    const abortController = new AbortController();
    listRequestAbortRef.current = abortController;

    if (showLoading) {
      setLoading(true);
    }
    setError(null);
    try {
      const params = new URLSearchParams();
      const trimmedQuery = debouncedSearchQuery.trim();
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
      setAllItems((prev) => {
        const merged = new Map(prev.map((item) => [item.id, item]));
        for (const item of nextItems) {
          merged.set(item.id, item);
        }
        return Array.from(merged.values());
      });
      return nextItems;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return null;
      }
      setError(err instanceof Error ? err.message : "Failed to load data");
      return null;
    } finally {
      if (listRequestAbortRef.current === abortController) {
        listRequestAbortRef.current = null;
      }
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [debouncedSearchQuery, statusFilter, templateFilter, projectFilter]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  async function loadBilling() {
    try {
      const res = await fetch("/api/billing/subscription");
      const payload = (await res.json()) as BillingResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load billing");
      }

      setBilling(payload.billing || null);
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
    setTemplatesLoading(true);
    try {
      const res = await fetch("/api/templates");
      const payload = (await res.json()) as TemplatesResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load templates");
      }

      setCustomTemplates(payload.templates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setTemplatesLoading(false);
    }
  }

  async function loadProjects() {
    setProjectsLoading(true);
    try {
      const res = await fetch("/api/projects");
      const payload = (await res.json()) as ProjectsResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load projects");
      }

      setProjects(payload.projects || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setProjectsLoading(false);
    }
  }

  async function loadWorkspaces() {
    setWorkspacesLoading(true);
    try {
      const res = await fetch("/api/workspaces");
      const payload = (await res.json()) as WorkspacesResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load workspaces");
      }

      setWorkspaces(payload.workspaces || []);
      setActiveWorkspaceId(payload.activeWorkspaceId || null);
      setActiveWorkspace(payload.activeWorkspace || null);
      setCurrentUser(payload.currentUser || null);
      setWorkspaceDraftName(payload.activeWorkspace?.name || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspaces");
    } finally {
      setWorkspacesLoading(false);
    }
  }

  async function loadWorkspaceDigestSettings() {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load digest settings");
    } finally {
      setWorkspaceDigestLoading(false);
    }
  }

  async function loadReportTemplates() {
    setReportTemplatesLoading(true);
    try {
      const res = await fetch("/api/report-templates");
      const payload = (await res.json().catch(() => ({}))) as ReportTemplatesResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load report templates");
      }

      setReportTemplates(payload.templates || []);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Slack settings");
    } finally {
      setWorkspaceSlackLoading(false);
    }
  }

  async function loadWorkspaceSlackDestinations() {
    try {
      const res = await fetch("/api/workspaces/slack/destinations");
      const payload = (await res.json().catch(() => ({}))) as WorkspaceSlackDestinationsResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load Slack destinations");
      }

      setWorkspaceSlackDestinations(payload.destinations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Slack destinations");
    }
  }

  async function loadNotificationPreferences() {
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
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load notification preferences",
      );
    } finally {
      setNotificationPreferencesLoading(false);
    }
  }

  async function loadWorkspaceNotionSettings() {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Notion settings");
    } finally {
      setWorkspaceNotionLoading(false);
    }
  }

  async function loadWorkspacePeople() {
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

      setWorkspaceMembers(membersPayload.members || []);
      setWorkspaceInvites(invitesPayload.invites || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load workspace people",
      );
    } finally {
      setWorkspacePeopleLoading(false);
    }
  }

  async function loadWorkspaceActivity() {
    setWorkspaceActivityLoading(true);
    try {
      const res = await fetch("/api/workspaces/activity");
      const payload = (await res.json()) as WorkspaceActivityResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load workspace activity");
      }

      setWorkspaceActivity(payload.activity || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load workspace activity",
      );
    } finally {
      setWorkspaceActivityLoading(false);
    }
  }

  async function loadWorkspaceTasks() {
    setWorkspaceTasksLoading(true);
    try {
      const res = await fetch("/api/tasks");
      const payload = (await res.json().catch(() => ({}))) as TasksResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load workspace tasks");
      }

      setWorkspaceTasks(payload.tasks || []);
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
    void loadItems();
  }, [loadItems]);

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
    void loadBilling();
    void loadTemplates();
    void loadProjects();
    void loadWorkspaces();
  }, []);

  useEffect(() => {
    if (!isSettingsSurface) {
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
  }, [
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

  async function loadAssistantMessages(transcriptionId: string) {
    setAssistantHistoryLoading(true);
    setAssistantError(null);

    try {
      const res = await fetch(
        `/api/assistant/chat?transcriptionId=${encodeURIComponent(transcriptionId)}`,
      );
      const payload = await res.json().catch(() => ({}));
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
      setAssistantMessages(defaultAssistantMessages);
      setAssistantError(
        err instanceof Error ? err.message : "Failed to load assistant history.",
      );
    } finally {
      setAssistantHistoryLoading(false);
    }
  }

  useEffect(() => {
    setAssistantSummary(null);
    setAssistantError(null);

    if (assistantScope !== "transcript" || !activeTranscriptionId) {
      setAssistantMessages(defaultAssistantMessages);
      return;
    }

    void loadAssistantMessages(activeTranscriptionId);
  }, [activeTranscriptionId, assistantScope]);

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

    try {
      const res = await fetch(`/api/comments?${params.toString()}`);
      const payload = (await res.json()) as CommentsResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load comments");
      }

      if (input.transcriptionId) {
        setTranscriptionCommentsById((prev) => ({
          ...prev,
          [input.transcriptionId!]: payload.comments || [],
        }));
      }
      if (input.taskId) {
        setTaskCommentsById((prev) => ({
          ...prev,
          [input.taskId!]: payload.comments || [],
        }));
      }
      if (input.projectInsightId) {
        setProjectInsightCommentsById((prev) => ({
          ...prev,
          [input.projectInsightId!]: payload.comments || [],
        }));
      }
      if (input.workspaceInsightId) {
        setWorkspaceInsightCommentsById((prev) => ({
          ...prev,
          [input.workspaceInsightId!]: payload.comments || [],
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load comments");
    }
  }, []);

  const loadActionTasks = useCallback(async (transcriptionId: string) => {
    try {
      const res = await fetch(
        `/api/tasks?transcriptionId=${encodeURIComponent(transcriptionId)}`,
      );
      const payload = (await res.json().catch(() => ({}))) as TasksResponse;
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    }
  }, [loadComments]);

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

  async function pollForProcessedResult(id: string) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
      const nextItems = await loadItems({ showLoading: false });
      if (!nextItems) {
        continue;
      }

      const currentItem = nextItems.find((item) => item.id === id);
      if (!currentItem) {
        break;
      }

      if (currentItem.status === "done" || currentItem.status === "error") {
        await loadBilling();
        return currentItem;
      }
    }

    return null;
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
      const optimisticItem: Transcription | null = payload?.transcriptionId
        ? {
            id: payload.transcriptionId,
            fileName: file.name,
            status: payload?.processedInline ? "done" : payload?.queued ? "processing" : "uploaded",
            template: uploadTemplate,
            projectId: uploadProjectId === "none" ? null : uploadProjectId,
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
        setAllItems((prev) => upsertItemCollection(prev, optimisticItem));
        if (matchesCurrentFilters(optimisticItem)) {
          setItems((prev) => upsertItemCollection(prev, optimisticItem));
        } else {
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
          ? (await loadItems())?.find(
              (item) => item.id === payload.transcriptionId,
            ) || null
          : null;
      await loadBilling();
      setUploading(false);
      showUploadStatusNotice(
        payload?.queued
          ? "Your file is uploaded. Voxly is processing it in the background."
          : "Your file is uploaded.",
      );

      if (
        payload?.queued ||
        initialItem?.status === "processing" ||
        initialItem?.status === "uploaded"
      ) {
        void (async () => {
          const currentItem = await pollForProcessedResult(payload.transcriptionId);
          if (currentItem?.status === "done") {
            shouldScrollToSummaryRef.current = true;
            setFocusedSummaryId(currentItem.id);
            showCompletionTip(
              "Voxly is ready. Try a prompt below to summarize, assign owners, or draft a follow-up.",
            );
          }
        })();
        return;
      }

      if (initialItem?.status === "done") {
        shouldScrollToSummaryRef.current = true;
        setFocusedSummaryId(initialItem.id);
        showCompletionTip(
          "Voxly is ready. Try a prompt below to summarize, assign owners, or draft a follow-up.",
        );
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
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load test data");
    } finally {
      setTestDataLoading(false);
    }
  }

  async function handleProcess(id: string, template?: string | null) {
    setError(null);
    setAssistantError(null);
    setAssistantSummary(null);
    shouldScrollToSummaryRef.current = true;
    setFocusedSummaryId(id);
    setOverviewUploadPanelStartExpanded(false);
    setOverviewUploadPanelVersion((prev) => prev + 1);
    setProcessingIds((prev) => ({ ...prev, [id]: true }));
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
      const nextItems = await loadItems({ showLoading: false });
      await loadBilling();
      let currentItem = nextItems?.find((item) => item.id === id) || null;

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
        showCompletionTip(
          "Voxly is ready. Try a prompt below to summarize, assign owners, or draft a follow-up.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
    } finally {
      setProcessingIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm(
      "Delete this transcription from history? This cannot be undone.",
    );
    if (!confirmed) return;

    setDeletingId(id);
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

      setExpandedTranscripts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
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
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  function toggleTranscript(id: string) {
    setExpandedTranscripts((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
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
      const nextItems = await loadItems({ showLoading: false });
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

  async function handleAssistantSubmit(promptText?: string) {
    const text = (promptText ?? assistantPrompt).trim();
    const activeSummary = focusedSummary;
    if (!text) return;

    if (assistantScope === "transcript" && !activeSummary) {
      setAssistantError("No summary available yet.");
      return;
    }
    if (assistantScope === "project" && assistantProjectId === "all") {
      setAssistantError("Choose a project before asking across recordings.");
      return;
    }

    setAssistantBusy(true);
    setAssistantError(null);
    const nextMessages: typeof assistantMessages = [
      ...assistantMessages,
      { role: "user", content: text },
    ];
    setAssistantMessages(nextMessages);
    try {
      if (assistantScope !== "transcript") {
        const endpoint =
          assistantScope === "workspace"
            ? "/api/intelligence/workspace"
            : "/api/intelligence/project";
        const body =
          assistantScope === "workspace"
            ? {
                question: text,
                ...(assistantWorkspaceProjectIds.length
                  ? { projectIds: assistantWorkspaceProjectIds }
                  : {}),
              }
            : {
                projectId: assistantProjectId,
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
              (assistantScope === "workspace"
                ? "Assistant workspace query failed"
                : "Assistant project query failed"),
          );
        }

        const assistantReply = formatIntelligenceAssistantReply(payload);
        setAssistantMessages((prev) => [
          ...prev,
          { role: "assistant", content: assistantReply },
        ]);
        setAssistantPrompt("");

        setIntelligenceScope(assistantScope === "workspace" ? "workspace" : "project");
        setIntelligenceQuestion(text);
        setIntelligenceResult(payload);
        setSelectedProjectInsightId(null);
        setSelectedWorkspaceInsightId(null);
        if (assistantScope === "project") {
          setIntelligenceProjectId(assistantProjectId);
          setIntelligenceTitleDraft(buildInsightTitle(text));
        } else {
          setWorkspaceIntelligenceProjectIds(assistantWorkspaceProjectIds);
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
      setAssistantPrompt("");
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

  function handleAssistantSuggestion(text: string) {
    setAssistantPrompt(text);
    handleAssistantSubmit(text);
    requestAnimationFrame(() => assistantInputRef.current?.focus());
  }

  function clearFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setTemplateFilter("all");
    setProjectFilter(pinnedProjectFilter);
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

      await loadProjects();
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project");
    }
  }

  async function handleSwitchWorkspace(nextWorkspaceId: string) {
    if (!nextWorkspaceId || nextWorkspaceId === activeWorkspaceId) {
      return;
    }

    setWorkspaceSwitching(true);
    setError(null);
    try {
      const res = await fetch("/api/workspaces/active", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: nextWorkspaceId }),
      });
      const payload = (await res.json().catch(() => ({}))) as WorkspacesResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to switch workspace");
      }

      setActiveWorkspaceId(nextWorkspaceId);
      setWorkspaceDraftName("");
      setFocusedSummaryId(null);
      setAssistantSummary(null);
      setAssistantMessages(defaultAssistantMessages);
      setActionTasksByTranscription({});
      setWorkspaceTasks([]);
      setProjectInsightCommentsById({});
      setIntelligenceResult(null);
      setIntelligenceQuestion("");
      setWorkspaceIntelligenceProjectIds([]);
      setSavedWorkspaceInsights([]);
      setSelectedWorkspaceInsightId(null);
      setUploadProjectId("none");
      setProjectFilter("all");
      await Promise.all([
        loadItems(),
        loadProjects(),
        loadTemplates(),
        loadWorkspaces(),
        loadWorkspacePeople(),
        loadWorkspaceActivity(),
        loadWorkspaceTasks(),
        loadNotifications(),
        loadWorkspaceDigestSettings(),
        loadReportTemplates(),
        loadReportRuns(),
        loadWorkspaceSlackSettings(),
        loadWorkspaceSlackDestinations(),
        loadWorkspaceNotionSettings(),
      ]);
      showUploadStatusNotice("Workspace switched.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch workspace");
    } finally {
      setWorkspaceSwitching(false);
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
      setWorkspaces((prev) =>
        prev.map((workspace) =>
          workspace.id === payload.workspace!.id
            ? { ...workspace, name: payload.workspace!.name }
            : workspace,
        ),
      );
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
      showUploadStatusNotice(
        deliveryParts.length
          ? `Workspace report ${deliveryParts.join(" and ")}.`
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

      setWorkspaceSlackDestinations((prev) => [payload.destination as WorkspaceSlackDestination, ...prev]);
      setWorkspaceSlackDestinationName("");
      setWorkspaceSlackDestinationWebhook("");
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

      setWorkspaceSlackDestinations((prev) =>
        prev.filter((destination) => destination.id !== destinationId),
      );
      if (workspaceDigestSlackDestinationId === destinationId) {
        setWorkspaceDigestSlackDestinationId("default");
      }
      if (projectDigestSlackDestinationId === destinationId) {
        setProjectDigestSlackDestinationId("default");
      }
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
      }
      await loadWorkspaceActivity();
      showUploadStatusNotice("Slack test message sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send Slack test");
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
      await loadWorkspaceActivity();
      showUploadStatusNotice("Notion integration updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save Notion settings");
    } finally {
      setWorkspaceNotionBusy(null);
    }
  }

  async function handleValidateWorkspaceNotion() {
    setWorkspaceNotionBusy("validate");
    setError(null);

    try {
      const res = await fetch("/api/workspaces/notion", {
        method: "POST",
      });
      const payload = (await res.json().catch(() => ({}))) as WorkspaceNotionResponse;
      if (!res.ok || !payload.settings) {
        throw new Error(payload?.error || "Failed to validate Notion connection");
      }

      setWorkspaceNotionSettings(payload.settings);
      setWorkspaceNotionEnabled(payload.settings.enabled);
      await loadWorkspaceActivity();
      showUploadStatusNotice("Notion connection verified.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to validate Notion connection",
      );
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
      setProjectInsightCommentsById({});
      setIntelligenceResult(null);
      setIntelligenceQuestion("");
      setWorkspaceIntelligenceProjectIds([]);
      setSavedWorkspaceInsights([]);
      setSelectedWorkspaceInsightId(null);
      await Promise.all([
        loadWorkspaces(),
        loadItems(),
        loadProjects(),
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

  async function handleCreateActionTask(input: {
    title: string;
    priority?: string;
    assignee?: string;
    dueDate?: string;
    sourceActionIndex?: number;
  }) {
    if (!activeTranscriptionId) {
      setError("Choose a transcription before creating a task.");
      return false;
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
      setWorkspaceTasks((prev) => upsertTaskCollection(prev, payload.task!));
      showCopyStatus("Task saved.");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
      return false;
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
      setWorkspaceTasks((prev) => upsertTaskCollection(prev, payload.task!));
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
      setWorkspaceTasks((prev) => prev.filter((task) => task.id !== taskId));
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

  function handleToggleAssistantWorkspaceProject(projectId: string) {
    setAssistantWorkspaceProjectIds((prev) =>
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
        setTranscriptionCommentsById((prev) => ({
          ...prev,
          [input.transcriptionId!]: [...(prev[input.transcriptionId!] || []), payload.comment!],
        }));
        setTranscriptionCommentDraft("");
      }

      if (input.taskId) {
        setTaskCommentsById((prev) => ({
          ...prev,
          [input.taskId!]: [...(prev[input.taskId!] || []), payload.comment!],
        }));
        setTaskCommentDrafts((prev) => ({
          ...prev,
          [input.taskId!]: "",
        }));
      }

      if (input.projectInsightId) {
        setProjectInsightCommentsById((prev) => ({
          ...prev,
          [input.projectInsightId!]: [
            ...(prev[input.projectInsightId!] || []),
            payload.comment!,
          ],
        }));
        setProjectInsightCommentDrafts((prev) => ({
          ...prev,
          [input.projectInsightId!]: "",
        }));
      }

      if (input.workspaceInsightId) {
        setWorkspaceInsightCommentsById((prev) => ({
          ...prev,
          [input.workspaceInsightId!]: [
            ...(prev[input.workspaceInsightId!] || []),
            payload.comment!,
          ],
        }));
        setWorkspaceInsightCommentDrafts((prev) => ({
          ...prev,
          [input.workspaceInsightId!]: "",
        }));
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
      setTranscriptionCommentsById((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([key, comments]) => [
            key,
            comments.map((comment) => (comment.id === commentId ? nextComment : comment)),
          ]),
        ),
      );
      setTaskCommentsById((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([key, comments]) => [
            key,
            comments.map((comment) => (comment.id === commentId ? nextComment : comment)),
          ]),
        ),
      );
      setProjectInsightCommentsById((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([key, comments]) => [
            key,
            comments.map((comment) => (comment.id === commentId ? nextComment : comment)),
          ]),
        ),
      );
      setWorkspaceInsightCommentsById((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([key, comments]) => [
            key,
            comments.map((comment) => (comment.id === commentId ? nextComment : comment)),
          ]),
        ),
      );
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

      setTranscriptionCommentsById((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([key, comments]) => [
            key,
            comments.filter((comment) => comment.id !== commentId),
          ]),
        ),
      );
      setTaskCommentsById((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([key, comments]) => [
            key,
            comments.filter((comment) => comment.id !== commentId),
          ]),
        ),
      );
      setProjectInsightCommentsById((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([key, comments]) => [
            key,
            comments.filter((comment) => comment.id !== commentId),
          ]),
        ),
      );
      setWorkspaceInsightCommentsById((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([key, comments]) => [
            key,
            comments.filter((comment) => comment.id !== commentId),
          ]),
        ),
      );
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
      eyebrow: "Workspace Settings",
      title: "Configure delivery and access",
      description:
        "Manage workspace identity, integrations, members, and recurring report behavior.",
      status: "Admin controls ready",
    },
  };

  const activeSurfaceMeta = surfaceMeta[workspaceSurface];
  const isOverviewSurface = workspaceSurface === "overview";
  const settingsSectionMeta: Record<
    "workspace" | "delivery" | "integrations" | "access" | "personal",
    { label: string; description: string }
  > = {
    workspace: {
      label: "Workspace",
      description: "Name, owner, role, and core workspace identity",
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
      label: "Personal",
      description: "Your mention and digest preferences",
    },
  };
  const visibleSettingsSections: Array<
    "workspace" | "delivery" | "integrations" | "access" | "personal"
  > = isWorkspaceSettingsMode
    ? ["workspace", "delivery", "integrations", "access"]
    : ["personal"];
  const currentSettingsMeta = settingsSectionMeta[settingsSection];

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
                      ? "Settings"
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
                {workspaceSurface === "overview" ? (
                  <div className="min-w-[240px]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Current Workspace
                    </p>
                    <div className="mt-1.5 rounded-[16px] border border-slate-200 bg-[#f8f8f5] px-4 py-2.5 text-sm font-medium text-slate-900">
                      {activeWorkspace?.name || "No workspace selected"}
                      {activeWorkspace?.isPersonal ? " (Personal)" : ""}
                    </div>
                  </div>
                ) : null}
                {showWorkspaceSelector ? (
                  <label className="min-w-[250px]">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Active Workspace
                    </span>
                    <select
                      value={activeWorkspaceId || ""}
                      onChange={(event) => void handleSwitchWorkspace(event.target.value)}
                      disabled={workspacesLoading || workspaceSwitching}
                      className="mt-2 w-full cursor-pointer rounded-[18px] border border-slate-200 bg-[#f8f8f5] px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="" disabled>
                        {workspacesLoading ? "Loading workspaces..." : "Select workspace"}
                      </option>
                      {workspaces.map((workspace) => (
                        <option key={workspace.id} value={workspace.id}>
                          {workspace.name}
                          {workspace.isPersonal ? " (Personal)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
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
            <div className="px-5 py-4 sm:px-6 sm:py-5">
              {visibleSettingsSections.length > 1 ? (
                <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-slate-200 pb-3">
                  {visibleSettingsSections.map((section) => (
                    <button
                      key={section}
                      type="button"
                      onClick={() => setSettingsSection(section)}
                      className={`cursor-pointer border-b-2 px-0 pb-2 text-sm font-medium transition ${
                        settingsSection === section
                          ? "border-slate-950 text-slate-950"
                          : "border-transparent text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {settingsSectionMeta[section].label}
                    </button>
                  ))}
                </div>
              ) : null}
              <p
                className={`text-sm text-slate-500 ${
                  visibleSettingsSections.length > 1 ? "mt-3" : ""
                }`}
              >
                {currentSettingsMeta.description}
              </p>
            </div>
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
          <div
            id="report-history"
            className={`rounded-[22px] border border-slate-200 bg-[#fcfbf8] p-4 ${
              workspaceSurface === "operations" ? "" : "hidden"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Notifications
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                  Team mentions and updates
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Keep up with comments that mention you inside this workspace.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  {unreadNotificationsCount} unread
                </span>
                <button
                  type="button"
                  onClick={() => void handleMarkNotificationRead()}
                  disabled={!unreadNotificationsCount || notificationBusyId === "all"}
                  className="cursor-pointer rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {notificationBusyId === "all" ? "Updating..." : "Mark all read"}
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {reportRunSummaryLoading ? (
                <p className="rounded-[16px] border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 sm:col-span-2 xl:col-span-4">
                  Loading report analytics...
                </p>
              ) : reportRunSummary ? (
                <>
                  <div className="rounded-[16px] border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Last {reportRunSummary.days} Days
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      {reportRunSummary.totalRuns}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {reportRunSummary.workspaceRuns} workspace, {reportRunSummary.projectRuns} project
                    </p>
                  </div>
                  <div className="rounded-[16px] border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Success Rate
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      {reportRunSummary.successRate}%
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {reportRunSummary.successCount} success, {reportRunSummary.failedCount} failed
                    </p>
                  </div>
                  <div className="rounded-[16px] border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Delivery Mix
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      {reportRunSummary.slackDeliveredCount}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Slack deliveries, {reportRunSummary.emailRecipientCount} email recipients
                    </p>
                  </div>
                  <div className="rounded-[16px] border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Top Report Type
                    </p>
                    <p className="mt-2 text-2xl font-semibold capitalize text-slate-950">
                      {(reportRunSummary.topReportType || "n/a").replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {reportRunSummary.scheduledRuns} scheduled, {reportRunSummary.manualRuns} manual
                    </p>
                  </div>
                </>
              ) : (
                <p className="rounded-[16px] border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 sm:col-span-2 xl:col-span-4">
                  No analytics available yet.
                </p>
              )}
            </div>
            <div className="mt-4 space-y-3">
              {notificationsLoading ? (
                <p className="text-sm text-slate-500">Loading notifications...</p>
              ) : notifications.length ? (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`rounded-[18px] border px-4 py-3 ${
                      notification.readAt
                        ? "border-slate-200 bg-white"
                        : "border-sky-200 bg-sky-50"
                    }`}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {notification.title}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {notification.body}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {notification.link ? (
                          <Link
                            href={notification.link}
                            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700"
                          >
                            Open
                          </Link>
                        ) : null}
                        {!notification.readAt ? (
                          <button
                            type="button"
                            onClick={() => void handleMarkNotificationRead(notification.id)}
                            disabled={notificationBusyId === notification.id}
                            className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {notificationBusyId === notification.id ? "Saving..." : "Mark read"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  No notifications yet. Mentions will show up here.
                </p>
              )}
            </div>
          </div>

          <div
            id="workspace-settings"
            className={`rounded-[22px] border border-slate-200 bg-[#fcfbf8] p-4 ${
              workspaceSurface === "operations" ? "" : "hidden"
            }`}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Report History
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                  Recent recurring report runs
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Review the latest workspace and project report deliveries, including
                  trigger type, channel usage, and where each run was scoped.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[180px,180px,auto,auto]">
                <label className="rounded-[16px] border border-slate-200 bg-white px-4 py-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Scope
                  </span>
                  <select
                    value={reportRunScopeFilter}
                    onChange={(event) =>
                      setReportRunScopeFilter(
                        event.target.value as "all" | "workspace" | "project",
                      )
                    }
                    className="mt-3 w-full cursor-pointer rounded-[14px] border border-slate-200 bg-[#fcfbf8] px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300"
                  >
                    <option value="all">All scopes</option>
                    <option value="workspace">Workspace</option>
                    <option value="project">Project</option>
                  </select>
                </label>
                <label className="rounded-[16px] border border-slate-200 bg-white px-4 py-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Status
                  </span>
                  <select
                    value={reportRunStatusFilter}
                    onChange={(event) =>
                      setReportRunStatusFilter(
                        event.target.value as "all" | "success" | "failed",
                      )
                    }
                    className="mt-3 w-full cursor-pointer rounded-[14px] border border-slate-200 bg-[#fcfbf8] px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300"
                  >
                    <option value="all">All statuses</option>
                    <option value="success">Success</option>
                    <option value="failed">Failed</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => void handleExportReportRuns("csv")}
                  disabled={reportRunExportBusy !== null}
                  className="cursor-pointer rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 lg:self-end"
                >
                  {reportRunExportBusy === "csv" ? "Exporting..." : "Export CSV"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleExportReportRuns("md")}
                  disabled={reportRunExportBusy !== null}
                  className="cursor-pointer rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 lg:self-end"
                >
                  {reportRunExportBusy === "md" ? "Exporting..." : "Export Markdown"}
                </button>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {reportRunsLoading ? (
                <p className="rounded-[16px] border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                  Loading report history...
                </p>
              ) : reportRuns.length ? (
                reportRuns.map((run) => (
                  <div
                    key={run.id}
                    className="rounded-[16px] border border-slate-200 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="rounded-full border border-slate-200 bg-[#fcfbf8] px-3 py-1 font-semibold text-slate-700">
                        {run.scope === "workspace" ? "Workspace" : "Project"}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-[#fcfbf8] px-3 py-1 font-semibold text-slate-700">
                        {run.reportType.replaceAll("_", " ")}
                      </span>
                      <span>{new Date(run.createdAt).toLocaleString()}</span>
                      <span>{run.trigger}</span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-900">
                      {run.summary}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {run.project?.name ? `${run.project.name} · ` : ""}
                      {run.cadence} ·{" "}
                      {[
                        run.sendEmail
                          ? `Email${run.emailRecipientCount ? ` (${run.emailRecipientCount})` : ""}`
                          : null,
                        run.sendSlack
                          ? `Slack${run.slackDelivered ? " (delivered)" : ""}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" + ")}
                    </p>
                    {run.metadata?.error ? (
                      <p className="mt-2 rounded-[14px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {run.metadata.error}
                      </p>
                    ) : null}
                    {run.status === "failed" ? (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => void handleRetryReportRun(run.id)}
                          disabled={reportRunBusyId !== null || !activeWorkspace?.canManage}
                          className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {reportRunBusyId === run.id ? "Retrying..." : "Retry"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="rounded-[16px] border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                  No recurring reports have run yet.
                </p>
              )}
            </div>
          </div>

          <div
            className={`border-t border-slate-200 pt-6 ${
              workspaceSurface === "settings" && settingsSection === "personal"
                ? ""
                : "hidden"
            }`}
          >
            <div className="max-w-5xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Notification Preferences
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                Personal delivery controls
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Choose how Voxly reaches you for mentions and digest emails across
                your workspaces.
              </p>
              {notificationPreferences ? (
                <p className="mt-3 text-xs text-slate-500">
                  Updated {new Date(notificationPreferences.updatedAt).toLocaleString()}
                </p>
              ) : null}
            </div>
            <form onSubmit={handleSaveNotificationPreferences} className="mt-6 max-w-5xl">
              <div>
                {[
                  {
                    key: "mention-email",
                    title: "Mention emails",
                    body: "Email me when I'm mentioned",
                    note: "Applies to transcript, task, and insight mentions.",
                    checked: mentionEmailEnabled,
                    setChecked: setMentionEmailEnabled,
                  },
                  {
                    key: "mention-app",
                    title: "In-app mentions",
                    body: "Show mention notifications in Voxly",
                    note: "Controls the in-app notification center.",
                    checked: mentionInAppEnabled,
                    setChecked: setMentionInAppEnabled,
                  },
                  {
                    key: "digest-email",
                    title: "Digest emails",
                    body: "Receive workspace digest emails",
                    note: "Slack digests and in-app activity are not affected.",
                    checked: digestEmailEnabled,
                    setChecked: setDigestEmailEnabled,
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="grid gap-4 border-b border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    </div>
                    <label className="flex items-start justify-between gap-4 rounded-[16px] border border-slate-200 bg-white px-4 py-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.body}</p>
                        <p className="mt-1 text-sm text-slate-500">{item.note}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(event) => item.setChecked(event.target.checked)}
                        disabled={notificationPreferencesLoading || notificationPreferencesBusy}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950 disabled:cursor-not-allowed"
                      />
                    </label>
                  </div>
                ))}
                <div className="grid gap-4 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div />
                  <div>
                    <button
                      type="submit"
                      disabled={notificationPreferencesLoading || notificationPreferencesBusy}
                      className="cursor-pointer rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {notificationPreferencesBusy ? "Saving..." : "Save Preferences"}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>

          <div
            id="settings"
            className={`pt-2 ${
              workspaceSurface === "settings" && settingsSection === "workspace"
                ? ""
                : "hidden"
            }`}
          >
            <div className="max-w-5xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Workspace Settings
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                {activeWorkspace?.name || "Current workspace"}
              </h2>
            </div>
            <form onSubmit={handleRenameWorkspace} className="mt-6 max-w-5xl">
              <div>
                <div className="grid gap-4 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Workspace type</p>
                  </div>
                  <div className="text-sm text-slate-600">
                    {activeWorkspace?.isPersonal ? "Personal workspace" : "Shared workspace"}
                  </div>
                </div>
                <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Your role</p>
                  </div>
                  <div className="text-sm text-slate-600 capitalize">
                    {activeWorkspace?.role || "member"}
                  </div>
                </div>
                <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Owner</p>
                  </div>
                  <div className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">
                      {activeWorkspace?.owner.name?.trim() ||
                        activeWorkspace?.owner.email ||
                        "Unknown"}
                    </span>
                  </div>
                </div>
                <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Workspace name</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Update the name used throughout Voxly.
                    </p>
                  </div>
                  <div className="flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="flex-1">
                      <input
                        type="text"
                        value={workspaceDraftName}
                        onChange={(event) => setWorkspaceDraftName(event.target.value)}
                        disabled={workspaceSettingsBusy || !activeWorkspace?.canManage}
                        className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={
                        workspaceSettingsBusy ||
                        !activeWorkspace?.canManage ||
                        !workspaceDraftName.trim() ||
                        workspaceDraftName.trim() === activeWorkspace?.name
                      }
                      className="cursor-pointer rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {workspaceSettingsBusy ? "Saving..." : "Save Name"}
                    </button>
                  </div>
                </div>
              </div>
            </form>
            {!activeWorkspace?.canManage ? (
              <p className="mt-4 max-w-5xl text-sm text-slate-600">
                You can view workspace details, but only owners and admins can update settings.
              </p>
            ) : null}
          </div>

          <div
            className={`pt-2 ${
              workspaceSurface === "settings" && settingsSection === "delivery"
                ? ""
                : "hidden"
            }`}
          >
            <div className="max-w-5xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Recurring Report
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                Scheduled insight report
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Configure a recurring workspace report, choose what it covers, and decide
                how it should be delivered.
              </p>
              {workspaceDigestSettings ? (
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                  <span>{workspaceDigestSettings.enabled ? "Enabled" : "Paused"}</span>
                  <span>
                    {digestReportTypeOptions.find(
                      (option) => option.id === workspaceDigestSettings.reportType,
                    )?.label || "Summary report"}
                  </span>
                  <span>{workspaceDigestSettings.scheduleLabel}</span>
                  <span>
                    {workspaceDigestSettings.lastSentAt
                      ? `Last sent ${new Date(workspaceDigestSettings.lastSentAt).toLocaleString()}`
                      : "Not sent yet"}
                  </span>
                  {workspaceDigestSettings.nextRunAt ? (
                    <span>
                      {`Next run ${new Date(workspaceDigestSettings.nextRunAt).toLocaleString()}`}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <form onSubmit={handleSaveWorkspaceDigestSettings} className="mt-6 max-w-5xl">
              <div>
                <div className="grid gap-4 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Digest status</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Turn the recurring workspace report on or leave it paused.
                    </p>
                  </div>
                  <label className="flex items-start justify-between gap-4 rounded-[16px] border border-slate-200 bg-white px-4 py-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Recurring workspace report
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        When enabled, Voxly will run this report on the saved schedule.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={workspaceDigestEnabled}
                      onChange={(event) => setWorkspaceDigestEnabled(event.target.checked)}
                      disabled={workspaceDigestLoading || !activeWorkspace?.canManage}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950 disabled:cursor-not-allowed"
                    />
                  </label>
                </div>

                <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Cadence</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Choose how often the report should run.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className="text-xs font-medium text-slate-600">Frequency</span>
                      <select
                        value={workspaceDigestCadence}
                        onChange={(event) =>
                          setWorkspaceDigestCadence(event.target.value as "weekly" | "monthly")
                        }
                        disabled={workspaceDigestLoading || !activeWorkspace?.canManage}
                        className="mt-2 w-full cursor-pointer rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {digestCadenceOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {workspaceDigestCadence === "weekly" ? (
                      <label>
                        <span className="text-xs font-medium text-slate-600">Day</span>
                        <select
                          value={workspaceDigestWeekday}
                          onChange={(event) => setWorkspaceDigestWeekday(event.target.value)}
                          disabled={workspaceDigestLoading || !activeWorkspace?.canManage}
                          className="mt-2 w-full cursor-pointer rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {digestWeekdayOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <label>
                        <span className="text-xs font-medium text-slate-600">Day of month</span>
                        <select
                          value={workspaceDigestDayOfMonth}
                          onChange={(event) => setWorkspaceDigestDayOfMonth(event.target.value)}
                          disabled={workspaceDigestLoading || !activeWorkspace?.canManage}
                          className="mt-2 w-full cursor-pointer rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {Array.from({ length: 28 }, (_, index) => {
                            const day = index + 1;
                            return (
                              <option key={day} value={String(day)}>
                                Day {day}
                              </option>
                            );
                          })}
                        </select>
                      </label>
                    )}
                    <label className="sm:col-span-2">
                      <span className="text-xs font-medium text-slate-600">Local hour</span>
                      <select
                        value={workspaceDigestHour}
                        onChange={(event) => setWorkspaceDigestHour(event.target.value)}
                        disabled={workspaceDigestLoading || !activeWorkspace?.canManage}
                        className="mt-2 w-full max-w-xs cursor-pointer rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {Array.from({ length: 24 }, (_, hour) => (
                          <option key={hour} value={String(hour)}>
                            {hour === 0
                              ? "12:00 AM"
                              : hour < 12
                                ? `${hour}:00 AM`
                                : hour === 12
                                  ? "12:00 PM"
                                  : `${hour - 12}:00 PM`}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Report content</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Choose what the report covers and who should receive it.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className="text-xs font-medium text-slate-600">Report type</span>
                      <select
                        value={workspaceDigestReportType}
                        onChange={(event) =>
                          setWorkspaceDigestReportType(
                            event.target.value as
                              | "summary"
                              | "new_insights"
                              | "open_tasks"
                              | "risk_watch",
                          )
                        }
                        disabled={workspaceDigestLoading || !activeWorkspace?.canManage}
                        className="mt-2 w-full cursor-pointer rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {digestReportTypeOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-xs text-slate-500">
                        {
                          digestReportTypeOptions.find(
                            (option) => option.id === workspaceDigestReportType,
                          )?.description
                        }
                      </p>
                    </label>
                    <label>
                      <span className="text-xs font-medium text-slate-600">Recipient scope</span>
                      <select
                        value={workspaceDigestRecipientScope}
                        onChange={(event) => setWorkspaceDigestRecipientScope(event.target.value)}
                        disabled={workspaceDigestLoading || !activeWorkspace?.canManage}
                        className="mt-2 w-full cursor-pointer rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {digestRecipientOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Delivery channels</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Choose where the recurring report should be sent.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <label className="flex items-start justify-between gap-4 rounded-[16px] border border-slate-200 bg-white px-4 py-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Email</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Respect each member&apos;s personal digest email preference.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={workspaceDigestSendEmail}
                        onChange={(event) => setWorkspaceDigestSendEmail(event.target.checked)}
                        disabled={workspaceDigestLoading || !activeWorkspace?.canManage}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950 disabled:cursor-not-allowed"
                      />
                    </label>
                    <label className="flex items-start justify-between gap-4 rounded-[16px] border border-slate-200 bg-white px-4 py-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Slack</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Requires a workspace Slack destination to be configured.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={workspaceDigestSendSlack}
                        onChange={(event) => setWorkspaceDigestSendSlack(event.target.checked)}
                        disabled={workspaceDigestLoading || !activeWorkspace?.canManage}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950 disabled:cursor-not-allowed"
                      />
                    </label>
                    {workspaceDigestSendSlack ? (
                      <label className="block max-w-md">
                        <span className="text-xs font-medium text-slate-600">Slack route</span>
                        <select
                          value={workspaceDigestSlackDestinationId}
                          onChange={(event) =>
                            setWorkspaceDigestSlackDestinationId(event.target.value)
                          }
                          disabled={workspaceDigestLoading || !activeWorkspace?.canManage}
                          className="mt-2 w-full cursor-pointer rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="default">Default workspace destination</option>
                          {workspaceSlackDestinations.map((destination) => (
                            <option key={destination.id} value={destination.id}>
                              {destination.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Timezone</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Reports use your current browser timezone when settings are saved.
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {workspaceDigestSettings?.timezone || browserTimeZone}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{browserTimeZone}</p>
                  </div>
                </div>

                <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Actions</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Save the recurring report or send a manual run now.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={workspaceDigestBusy !== null || !activeWorkspace?.canManage}
                      className="cursor-pointer rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {workspaceDigestBusy === "save" ? "Saving..." : "Save Digest Settings"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSendWorkspaceDigestNow()}
                      disabled={workspaceDigestBusy !== null || !activeWorkspace?.canManage}
                      className="cursor-pointer rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {workspaceDigestBusy === "send" ? "Sending..." : "Send Now"}
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Save as template</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Save this delivery setup so you can reuse it later.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="flex-1 max-w-md">
                      <span className="text-xs font-medium text-slate-600">Template name</span>
                      <input
                        type="text"
                        value={workspaceDigestTemplateName}
                        onChange={(event) => setWorkspaceDigestTemplateName(event.target.value)}
                        disabled={!activeWorkspace?.canManage || workspaceDigestLoading}
                        placeholder="Weekly risk watch"
                        className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleSaveReportTemplate("workspace")}
                      disabled={
                        !activeWorkspace?.canManage ||
                        reportTemplateBusyKey !== null ||
                        !workspaceDigestTemplateName.trim()
                      }
                      className="cursor-pointer rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {reportTemplateBusyKey === "save:workspace"
                        ? "Saving..."
                        : "Save Template"}
                    </button>
                  </div>
                </div>
              </div>
            </form>
            {!activeWorkspace?.canManage ? (
              <p className="mt-4 max-w-5xl text-sm text-slate-600">
                Only owners and admins can manage workspace digests or send them manually.
              </p>
            ) : null}
          </div>

          <div
            className={`pt-2 ${
              workspaceSurface === "settings" && settingsSection === "delivery"
                ? ""
                : "hidden"
            }`}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Report Templates
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                  Reuse recurring report setups
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Save your best workspace and project report configurations, then
                  apply them without rebuilding cadence, recipients, and report type
                  from scratch.
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-8 lg:grid-cols-2">
              {(["workspace", "project"] as const).map((scope) => {
                const templatesForScope = reportTemplates.filter(
                  (template) => template.targetScope === scope,
                );
                return (
                  <div key={scope} className="pt-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {scope === "workspace"
                            ? "Workspace templates"
                            : "Project templates"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {scope === "workspace"
                            ? "Apply directly to the workspace report form."
                            : "Apply when a project is selected in intelligence."}
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                        {templatesForScope.length}
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {templatesForScope.length ? (
                        templatesForScope.map((template) => (
                          <div key={template.id} className="border-t border-slate-200 pt-3 first:border-t-0 first:pt-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">
                                {template.name}
                              </p>
                              <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">
                                {template.cadence}
                              </span>
                              <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">
                                {digestReportTypeOptions.find(
                                  (option) => option.id === template.reportType,
                                )?.label || template.reportType}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                              {template.cadence === "monthly"
                                ? `Day ${template.dayOfMonth}`
                                : digestWeekdayOptions.find(
                                    (option) => Number(option.id) === template.weekday,
                                  )?.label || "Weekly"}{" "}
                              at{" "}
                              {template.hourLocal === 0
                                ? "12:00 AM"
                                : template.hourLocal < 12
                                  ? `${template.hourLocal}:00 AM`
                                  : template.hourLocal === 12
                                    ? "12:00 PM"
                                    : `${template.hourLocal - 12}:00 PM`}
                              {" · "}
                              {
                                digestRecipientOptions.find(
                                  (option) => option.id === template.recipientScope,
                                )?.label
                              }
                              {" · "}
                              {[
                                template.sendEmail ? "Email" : null,
                                template.sendSlack ? "Slack" : null,
                              ]
                                .filter(Boolean)
                                .join(" + ") || "No delivery"}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => applyReportTemplate(template)}
                                disabled={
                                  scope === "project" &&
                                  (intelligenceScope !== "project" ||
                                    intelligenceProjectId === "all")
                                }
                                className="cursor-pointer rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Apply
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteReportTemplate(template.id)}
                                disabled={reportTemplateBusyKey !== null || !activeWorkspace?.canManage}
                                className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {reportTemplateBusyKey === `delete:${template.id}`
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">
                          {reportTemplatesLoading
                            ? "Loading templates..."
                            : "No templates saved yet."}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className={`pt-2 ${
              workspaceSurface === "settings" && settingsSection === "integrations"
                ? ""
                : "hidden"
            }`}
          >
            <div className="max-w-5xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Slack
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                Workspace delivery
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Connect Slack so reports and saved insights can be shared outside Voxly.
              </p>
              {workspaceSlackSettings ? (
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                  <span>{workspaceSlackSettings.configured ? "Configured" : "Not connected"}</span>
                  <span>{workspaceSlackSettings.enabled ? "Enabled" : "Paused"}</span>
                  {workspaceSlackSettings.maskedWebhook ? (
                    <span>{workspaceSlackSettings.maskedWebhook}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <form onSubmit={handleSaveWorkspaceSlackSettings} className="mt-6 max-w-5xl">
              <div>
                <div className="grid gap-4 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Webhook</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Paste the incoming webhook Voxly should use.
                    </p>
                  </div>
                  <div className="max-w-2xl">
                    <input
                      type="password"
                      value={workspaceSlackWebhookDraft}
                      onChange={(event) => setWorkspaceSlackWebhookDraft(event.target.value)}
                      placeholder={
                        workspaceSlackSettings?.configured
                          ? "Paste a new webhook URL to replace the current one"
                          : "https://hooks.slack.com/services/..."
                      }
                      disabled={workspaceSlackLoading || !activeWorkspace?.canManage}
                      className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <p className="mt-2 text-sm text-slate-500">
                      Voxly stores the webhook server-side and only shows a masked value after it is saved.
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Availability</p>
                  </div>
                  <div className="space-y-4">
                    <label className="flex items-start justify-between gap-4 rounded-[16px] border border-slate-200 bg-white px-4 py-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Enable Slack delivery</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Lets Voxly send test messages, digests, and shared insights.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={workspaceSlackEnabled}
                        onChange={(event) => setWorkspaceSlackEnabled(event.target.checked)}
                        disabled={workspaceSlackLoading || !activeWorkspace?.canManage}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950 disabled:cursor-not-allowed"
                      />
                    </label>
                    <label className="flex items-start justify-between gap-4 rounded-[16px] border border-slate-200 bg-white px-4 py-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Send digests to Slack</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Workspace reports can post directly to the connected channel.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={workspaceSlackSendDigests}
                        onChange={(event) => setWorkspaceSlackSendDigests(event.target.checked)}
                        disabled={workspaceSlackLoading || !activeWorkspace?.canManage}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950 disabled:cursor-not-allowed"
                      />
                    </label>
                  </div>
                </div>
                <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Actions</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={
                        workspaceSlackBusy !== null ||
                        !activeWorkspace?.canManage ||
                        (!workspaceSlackWebhookDraft.trim() && !workspaceSlackSettings?.configured)
                      }
                      className="cursor-pointer rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {workspaceSlackBusy === "save" ? "Saving..." : "Save Slack Settings"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSendSlackTest()}
                      disabled={
                        workspaceSlackBusy !== null ||
                        !activeWorkspace?.canManage ||
                        !workspaceSlackSettings?.configured ||
                        !workspaceSlackEnabled
                      }
                      className="cursor-pointer rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {workspaceSlackBusy === "test" ? "Sending..." : "Send Test"}
                    </button>
                  </div>
                </div>
              </div>
            </form>
            {!activeWorkspace?.canManage ? (
              <p className="mt-4 max-w-5xl text-sm text-slate-600">
                Only owners and admins can manage Slack integration settings.
              </p>
            ) : null}
          </div>

          <div
            className={`pt-2 ${
              workspaceSurface === "settings" && settingsSection === "integrations"
                ? ""
                : "hidden"
            }`}
          >
            <div className="max-w-5xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Notion
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                Workspace knowledge sync
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Connect Notion so saved insights can be published as pages instead of just exported files.
              </p>
              {workspaceNotionSettings ? (
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                  <span>{workspaceNotionSettings.configured ? "Configured" : "Not connected"}</span>
                  <span>{workspaceNotionSettings.enabled ? "Enabled" : "Paused"}</span>
                  {workspaceNotionSettings.parentPageId ? (
                    <span>Parent page: {workspaceNotionSettings.parentPageId}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <form onSubmit={handleSaveWorkspaceNotionSettings} className="mt-6 max-w-5xl">
              <div>
                <div className="grid gap-4 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Integration token</p>
                  </div>
                  <div className="max-w-2xl">
                    <input
                      type="password"
                      value={workspaceNotionTokenDraft}
                      onChange={(event) => setWorkspaceNotionTokenDraft(event.target.value)}
                      placeholder={
                        workspaceNotionSettings?.configured
                          ? "Paste a new Notion token to replace the current one"
                          : "secret_xxx..."
                      }
                      disabled={workspaceNotionLoading || !activeWorkspace?.canManage}
                      className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                </div>
                <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Parent page</p>
                  </div>
                  <div className="max-w-2xl">
                    <input
                      type="text"
                      value={workspaceNotionParentPageDraft}
                      onChange={(event) => setWorkspaceNotionParentPageDraft(event.target.value)}
                      placeholder="Paste the parent page ID"
                      disabled={workspaceNotionLoading || !activeWorkspace?.canManage}
                      className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                </div>
                <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Availability</p>
                  </div>
                  <label className="flex items-start justify-between gap-4 rounded-[16px] border border-slate-200 bg-white px-4 py-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Enable Notion publishing</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Allows saved insights to create real pages in Notion.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={workspaceNotionEnabled}
                      onChange={(event) => setWorkspaceNotionEnabled(event.target.checked)}
                      disabled={workspaceNotionLoading || !activeWorkspace?.canManage}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950 disabled:cursor-not-allowed"
                    />
                  </label>
                </div>
                <div className="grid gap-4 border-t border-slate-200 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Actions</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={
                        workspaceNotionBusy !== null ||
                        !activeWorkspace?.canManage ||
                        ((!workspaceNotionTokenDraft.trim() ||
                          !workspaceNotionParentPageDraft.trim()) &&
                          !workspaceNotionSettings?.configured)
                      }
                      className="cursor-pointer rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {workspaceNotionBusy === "save" ? "Saving..." : "Save Notion Settings"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleValidateWorkspaceNotion()}
                      disabled={
                        workspaceNotionBusy !== null ||
                        !activeWorkspace?.canManage ||
                        !workspaceNotionSettings?.configured ||
                        !workspaceNotionEnabled
                      }
                      className="cursor-pointer rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {workspaceNotionBusy === "validate" ? "Checking..." : "Validate Connection"}
                    </button>
                  </div>
                </div>
              </div>
            </form>
            {!activeWorkspace?.canManage ? (
              <p className="mt-4 max-w-5xl text-sm text-slate-600">
                Only owners and admins can manage Notion integration settings.
              </p>
            ) : null}
          </div>

          <div
            className={`pt-2 ${
              workspaceSurface === "settings" && settingsSection === "access"
                ? ""
                : "hidden"
            }`}
          >
            <div className="max-w-5xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Workspace Access
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                Members and invites
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Manage who can access this workspace, what role they have, and how ownership is handled.
              </p>
            </div>
            <form onSubmit={handleInviteWorkspaceMember} className="mt-6 max-w-5xl">
              <div>
                <div className="grid gap-4 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Invite teammate</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Send a workspace invite and choose the initial role.
                    </p>
                  </div>
                  <div className="flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="flex-1">
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                        placeholder="teammate@company.com"
                        className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300"
                      />
                    </label>
                    <label className="sm:w-44">
                      <select
                        value={inviteRole}
                        onChange={(event) => setInviteRole(event.target.value)}
                        className="w-full cursor-pointer rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300"
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </label>
                    <button
                      type="submit"
                      disabled={inviteBusy || !inviteEmail.trim()}
                      className="cursor-pointer rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {inviteBusy ? "Sending..." : "Send Invite"}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>

          <div
            className={`mt-8 max-w-5xl ${
              workspaceSurface === "settings" && settingsSection === "access"
                ? ""
                : "hidden"
            }`}
          >
            <div className="pt-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">Active members</h3>
                <span className="text-sm text-slate-500">{workspaceMembers.length}</span>
              </div>
              <div className="mt-4 space-y-4">
                {workspacePeopleLoading ? (
                  <p className="text-sm text-slate-500">Loading members...</p>
                ) : workspaceMembers.length ? (
                  workspaceMembers.map((member) => (
                    <div key={member.id} className="border-t border-slate-200 pt-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {member.user.name?.trim() || member.user.email}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {member.user.email}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            Joined{" "}
                            {member.joinedAt
                              ? new Date(member.joinedAt).toLocaleDateString()
                              : "recently"}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={member.role}
                            onChange={(event) =>
                              void handleUpdateWorkspaceMemberRole(
                                member.id,
                                event.target.value,
                              )
                            }
                            disabled={memberBusyId === member.id || member.role === "owner"}
                            className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="owner">Owner</option>
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => void handleRemoveWorkspaceMember(member.id)}
                            disabled={memberBusyId === member.id || member.role === "owner"}
                            className="cursor-pointer rounded-full border border-red-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    No teammates yet. Send the first invite above.
                  </p>
                )}
              </div>
            </div>

            <div className="pt-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">Pending invites</h3>
                <span className="text-sm text-slate-500">{workspaceInvites.length}</span>
              </div>
              <div className="mt-4 space-y-4">
                {workspacePeopleLoading ? (
                  <p className="text-sm text-slate-500">Loading invites...</p>
                ) : workspaceInvites.length ? (
                  workspaceInvites.map((invite) => {
                    const isExpired = new Date(invite.expiresAt).getTime() < Date.now();

                    return (
                      <div key={invite.id} className="border-t border-slate-200 pt-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {invite.email}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {invite.role} · {isExpired ? "expired" : "expires"}{" "}
                              {new Date(invite.expiresAt).toLocaleDateString()}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-400">
                              Sent {new Date(invite.createdAt).toLocaleDateString()}
                              {invite.updatedAt &&
                              invite.updatedAt !== invite.createdAt
                                ? ` · resent ${new Date(invite.updatedAt).toLocaleDateString()}`
                                : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                                isExpired
                                  ? "border border-amber-200 bg-amber-50 text-amber-700"
                                  : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {isExpired ? "Expired" : "Pending"}
                            </span>
                            <button
                              type="button"
                              onClick={() => void handleResendInvite(invite.id)}
                              disabled={inviteBusy}
                              className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Resend
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleRevokeInvite(invite.id)}
                              disabled={inviteBusy}
                              className="cursor-pointer rounded-full border border-red-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Revoke
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-500">
                    No pending invites right now.
                  </p>
                )}
              </div>
            </div>
          </div>
          <div
            className={`mt-8 max-w-5xl ${
              workspaceSurface === "settings" && settingsSection === "access"
                ? ""
                : "hidden"
            }`}
          >
            <div className="pt-2">
              <h3 className="text-sm font-semibold text-slate-900">Ownership</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Transfer workspace ownership before an owner steps away. Personal workspaces cannot be transferred.
              </p>
              {ownershipTransferBlockedByBilling ? (
                <p className="mt-3 text-sm text-amber-800">
                  Ownership transfer is blocked while the current owner still has active subscription access or remaining credits tied to this workspace.
                </p>
              ) : null}
              <div className="mt-4 flex max-w-3xl flex-col gap-3 lg:flex-row lg:items-end">
                <label className="flex-1">
                  <select
                    value={ownerTransferMemberId}
                    onChange={(event) => setOwnerTransferMemberId(event.target.value)}
                    disabled={ownerTransferBusy || ownershipTransferBlockedByBilling}
                    className="w-full cursor-pointer rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Choose a member</option>
                    {workspaceMembers
                      .filter((member) => member.role !== "owner")
                      .map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.user.name?.trim() || member.user.email}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => void handleTransferWorkspaceOwnership()}
                  disabled={
                    ownerTransferBusy ||
                    !ownerTransferMemberId ||
                    ownershipTransferBlockedByBilling
                  }
                  className="cursor-pointer rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {ownerTransferBusy ? "Transferring..." : "Transfer Owner"}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <h3 className="text-sm font-semibold text-slate-900">Leave workspace</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Non-owners can leave a shared workspace at any time. Owners must transfer ownership first.
              </p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => void handleLeaveWorkspace()}
                  disabled={leaveWorkspaceBusy}
                  className="cursor-pointer rounded-full border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {leaveWorkspaceBusy ? "Leaving..." : "Leave Workspace"}
                </button>
              </div>
            </div>
          </div>
          <div
            className={`mt-8 max-w-5xl pt-2 ${
              workspaceSurface === "settings" && settingsSection === "access"
                ? ""
                : "hidden"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Recent activity</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Workspace access changes are logged here for accountability.
                </p>
              </div>
              <span className="text-sm text-slate-500">{workspaceActivity.length}</span>
            </div>
            <div className="mt-4 space-y-4">
              {workspaceActivityLoading ? (
                <p className="text-sm text-slate-500">Loading activity...</p>
              ) : workspaceActivity.length ? (
                workspaceActivity.map((entry) => (
                  <div key={entry.id} className="border-t border-slate-200 pt-4">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          {entry.summary}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {(entry.actorUser?.name?.trim() ||
                            entry.actorUser?.email ||
                          "System") +
                            " · " +
                            new Date(entry.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {entry.action.replaceAll(".", " ")}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  Activity will appear here as invites and membership changes happen.
                </p>
              )}
            </div>
          </div>
          <div
            id="workspace-tasks"
            className={`mt-5 rounded-[22px] border border-slate-200 bg-[#fcfbf8] p-4 ${
              workspaceSurface === "operations" ? "" : "hidden"
            }`}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Workspace Tasks
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                  Team task board
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  See tracked action items across this workspace, filter the queue,
                  and jump straight back into the related transcript when needed.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                <div className="rounded-[18px] border border-slate-200 bg-white px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Total
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">
                    {workspaceTaskCounts.total}
                  </p>
                </div>
                <div className="rounded-[18px] border border-slate-200 bg-white px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Open
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">
                    {workspaceTaskCounts.open}
                  </p>
                </div>
                <div className="rounded-[18px] border border-slate-200 bg-white px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    In Progress
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">
                    {workspaceTaskCounts.inProgress}
                  </p>
                </div>
                <div className="rounded-[18px] border border-slate-200 bg-white px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Done
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">
                    {workspaceTaskCounts.done}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end">
              <label className="lg:w-56">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Status
                </span>
                <select
                  value={workspaceTaskStatusFilter}
                  onChange={(event) => setWorkspaceTaskStatusFilter(event.target.value)}
                  className="mt-2 w-full cursor-pointer rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300"
                >
                  {taskStatusOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="lg:w-56">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Assignment
                </span>
                <select
                  value={workspaceTaskAssignmentFilter}
                  onChange={(event) =>
                    setWorkspaceTaskAssignmentFilter(event.target.value)
                  }
                  className="mt-2 w-full cursor-pointer rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300"
                >
                  {taskAssignmentOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 space-y-3">
              {workspaceTasksLoading ? (
                <p className="text-sm text-slate-500">Loading workspace tasks...</p>
              ) : filteredWorkspaceTasks.length ? (
                filteredWorkspaceTasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-[20px] border border-slate-200 bg-white px-4 py-4"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-slate-200 bg-[#fffaf3] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                            {task.transcription?.fileName || "Transcript"}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
                              task.priority === "HIGH"
                                ? "bg-red-100 text-red-700"
                                : task.priority === "MEDIUM"
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {task.priority}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
                              task.status === "done"
                                ? "bg-emerald-100 text-emerald-700"
                                : task.status === "in_progress"
                                  ? "bg-sky-100 text-sky-700"
                                  : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {task.status.replace("_", " ")}
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-900">
                          {task.title}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span>@{task.assignee?.trim() || "Unassigned"}</span>
                          {task.dueDate ? (
                            <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>
                          ) : (
                            <span>No due date</span>
                          )}
                          <span>
                            Added {new Date(task.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 xl:justify-end">
                        <select
                          value={task.status}
                          onChange={(event) =>
                            void handleUpdateActionTask(task.id, {
                              status: event.target.value as ActionTask["status"],
                            })
                          }
                          disabled={actionTaskBusyKey === `update:${task.id}`}
                          className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="done">Done</option>
                        </select>
                        <input
                          type="text"
                          defaultValue={task.assignee || ""}
                          placeholder="Assignee"
                          onBlur={(event) =>
                            void handleUpdateActionTask(task.id, {
                              assignee: event.target.value,
                            })
                          }
                          disabled={actionTaskBusyKey === `update:${task.id}`}
                          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <input
                          type="date"
                          defaultValue={task.dueDate ? task.dueDate.slice(0, 10) : ""}
                          onBlur={(event) =>
                            void handleUpdateActionTask(task.id, {
                              dueDate: event.target.value,
                            })
                          }
                          disabled={actionTaskBusyKey === `update:${task.id}`}
                          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <button
                          type="button"
                          onClick={() => handleOpenTaskTranscript(task)}
                          className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                        >
                          Open Transcript
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteActionTask(task.id)}
                          disabled={actionTaskBusyKey === `delete:${task.id}`}
                          className="cursor-pointer rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  No tracked tasks match these filters yet.
                </p>
              )}
            </div>
          </div>
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
                  onChange={(event) => {
                    setIntelligenceProjectId(event.target.value);
                    setSelectedProjectInsightId(null);
                    setIntelligenceResult(null);
                    setIntelligenceTitleDraft("");
                  }}
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
            {intelligenceScope === "project" && intelligenceProjectId !== "all" ? (
              <div className="mt-4 rounded-[18px] border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Project Report
                    </p>
                    <h4 className="mt-2 text-lg font-semibold text-slate-950">
                      Recurring project report
                    </h4>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Configure a recurring report for this project. You can keep the
                      broad summary or narrow the report toward new insights, open
                      tasks, or risk watch coverage. Delivery follows each user&apos;s
                      digest email preference and can also post to Slack if workspace
                      digest delivery is enabled there.
                    </p>
                    {projectDigestSettings ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="rounded-full border border-slate-200 bg-[#fcfbf8] px-3 py-1 font-semibold text-slate-700">
                          {projectDigestSettings.enabled ? "Enabled" : "Paused"}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-[#fcfbf8] px-3 py-1 font-semibold text-slate-700">
                          {digestReportTypeOptions.find(
                            (option) => option.id === projectDigestSettings.reportType,
                          )?.label || "Summary report"}
                        </span>
                        <span>{projectDigestSettings.scheduleLabel}</span>
                        {projectDigestSettings.lastSentAt ? (
                          <span>
                            Last sent{" "}
                            {new Date(projectDigestSettings.lastSentAt).toLocaleString()}
                          </span>
                        ) : (
                          <span>Not sent yet</span>
                        )}
                      </div>
                    ) : null}
                  </div>
                  <form
                    onSubmit={handleSaveProjectDigestSettings}
                    className="grid w-full gap-3 lg:max-w-3xl lg:grid-cols-2"
                  >
                    <label className="rounded-[16px] border border-slate-200 bg-[#fcfbf8] px-4 py-3">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Digest status
                      </span>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            Enable project digest
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Run a weekly report for this project.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={projectDigestEnabled}
                          onChange={(event) => setProjectDigestEnabled(event.target.checked)}
                          disabled={projectDigestLoading || !activeWorkspace?.canManage}
                          className="h-4 w-4 rounded border-slate-300 text-slate-950 disabled:cursor-not-allowed"
                        />
                      </div>
                    </label>
                    <label className="rounded-[16px] border border-slate-200 bg-[#fcfbf8] px-4 py-3">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Cadence
                      </span>
                      <select
                        value={projectDigestCadence}
                        onChange={(event) =>
                          setProjectDigestCadence(event.target.value as "weekly" | "monthly")
                        }
                        disabled={projectDigestLoading || !activeWorkspace?.canManage}
                        className="mt-3 w-full cursor-pointer rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {digestCadenceOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="rounded-[16px] border border-slate-200 bg-[#fcfbf8] px-4 py-3">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Report type
                      </span>
                      <select
                        value={projectDigestReportType}
                        onChange={(event) =>
                          setProjectDigestReportType(
                            event.target.value as
                              | "summary"
                              | "new_insights"
                              | "open_tasks"
                              | "risk_watch",
                          )
                        }
                        disabled={projectDigestLoading || !activeWorkspace?.canManage}
                        className="mt-3 w-full cursor-pointer rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {digestReportTypeOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-xs text-slate-500">
                        {
                          digestReportTypeOptions.find(
                            (option) => option.id === projectDigestReportType,
                          )?.description
                        }
                      </p>
                    </label>
                    <label className="rounded-[16px] border border-slate-200 bg-[#fcfbf8] px-4 py-3">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Recipient scope
                      </span>
                      <select
                        value={projectDigestRecipientScope}
                        onChange={(event) => setProjectDigestRecipientScope(event.target.value)}
                        disabled={projectDigestLoading || !activeWorkspace?.canManage}
                        className="mt-3 w-full cursor-pointer rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {digestRecipientOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="rounded-[16px] border border-slate-200 bg-[#fcfbf8] px-4 py-3">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Delivery channels
                      </span>
                      <div className="mt-3 space-y-3">
                        <label className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Email</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Respect each member&apos;s personal digest email preference.
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            checked={projectDigestSendEmail}
                            onChange={(event) =>
                              setProjectDigestSendEmail(event.target.checked)
                            }
                            disabled={projectDigestLoading || !activeWorkspace?.canManage}
                            className="h-4 w-4 rounded border-slate-300 text-slate-950 disabled:cursor-not-allowed"
                          />
                        </label>
                        <label className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Slack</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Requires workspace Slack digests to be enabled.
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            checked={projectDigestSendSlack}
                            onChange={(event) =>
                              setProjectDigestSendSlack(event.target.checked)
                            }
                            disabled={projectDigestLoading || !activeWorkspace?.canManage}
                            className="h-4 w-4 rounded border-slate-300 text-slate-950 disabled:cursor-not-allowed"
                          />
                        </label>
                        {projectDigestSendSlack ? (
                          <label className="block">
                            <span className="text-xs font-medium text-slate-600">
                              Slack route
                            </span>
                            <select
                              value={projectDigestSlackDestinationId}
                              onChange={(event) =>
                                setProjectDigestSlackDestinationId(event.target.value)
                              }
                              disabled={projectDigestLoading || !activeWorkspace?.canManage}
                              className="mt-2 w-full cursor-pointer rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <option value="default">Default workspace destination</option>
                              {workspaceSlackDestinations.map((destination) => (
                                <option key={destination.id} value={destination.id}>
                                  {destination.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                      </div>
                    </div>
                    {projectDigestCadence === "weekly" ? (
                      <label className="rounded-[16px] border border-slate-200 bg-[#fcfbf8] px-4 py-3">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Weekly day
                        </span>
                        <select
                          value={projectDigestWeekday}
                          onChange={(event) => setProjectDigestWeekday(event.target.value)}
                          disabled={projectDigestLoading || !activeWorkspace?.canManage}
                          className="mt-3 w-full cursor-pointer rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {digestWeekdayOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <label className="rounded-[16px] border border-slate-200 bg-[#fcfbf8] px-4 py-3">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Day of month
                        </span>
                        <select
                          value={projectDigestDayOfMonth}
                          onChange={(event) => setProjectDigestDayOfMonth(event.target.value)}
                          disabled={projectDigestLoading || !activeWorkspace?.canManage}
                          className="mt-3 w-full cursor-pointer rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {Array.from({ length: 28 }, (_, index) => {
                            const day = index + 1;
                            return (
                              <option key={day} value={String(day)}>
                                Day {day}
                              </option>
                            );
                          })}
                        </select>
                        <p className="mt-2 text-xs text-slate-500">
                          Monthly reports use days 1-28 to avoid short-month skips.
                        </p>
                      </label>
                    )}
                    <label className="rounded-[16px] border border-slate-200 bg-[#fcfbf8] px-4 py-3">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Local hour
                      </span>
                      <select
                        value={projectDigestHour}
                        onChange={(event) => setProjectDigestHour(event.target.value)}
                        disabled={projectDigestLoading || !activeWorkspace?.canManage}
                        className="mt-3 w-full cursor-pointer rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {Array.from({ length: 24 }, (_, hour) => (
                          <option key={hour} value={String(hour)}>
                            {hour === 0
                              ? "12:00 AM"
                              : hour < 12
                                ? `${hour}:00 AM`
                                : hour === 12
                                  ? "12:00 PM"
                                  : `${hour - 12}:00 PM`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex flex-wrap gap-3 lg:col-span-2">
                      <button
                        type="submit"
                        disabled={projectDigestBusy !== null || !activeWorkspace?.canManage}
                        className="cursor-pointer rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {projectDigestBusy === "save" ? "Saving..." : "Save Project Digest"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSendProjectDigestNow()}
                        disabled={projectDigestBusy !== null || !activeWorkspace?.canManage}
                        className="cursor-pointer rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {projectDigestBusy === "send" ? "Sending..." : "Send Now"}
                      </button>
                    </div>
                    <div className="rounded-[16px] border border-dashed border-slate-200 bg-white px-4 py-3 lg:col-span-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Save as template
                      </p>
                      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end">
                        <label className="flex-1">
                          <span className="text-xs font-medium text-slate-600">
                            Template name
                          </span>
                          <input
                            type="text"
                            value={projectDigestTemplateName}
                            onChange={(event) =>
                              setProjectDigestTemplateName(event.target.value)
                            }
                            disabled={!activeWorkspace?.canManage || projectDigestLoading}
                            placeholder="Monthly project summary"
                            className="mt-2 w-full rounded-[14px] border border-slate-200 bg-[#fcfbf8] px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void handleSaveReportTemplate("project")}
                          disabled={
                            !activeWorkspace?.canManage ||
                            reportTemplateBusyKey !== null ||
                            !projectDigestTemplateName.trim()
                          }
                          className="cursor-pointer rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {reportTemplateBusyKey === "save:project"
                            ? "Saving..."
                            : "Save Template"}
                        </button>
                      </div>
                </div>
              </form>
            </div>
            <div className="mt-4 rounded-[18px] border border-dashed border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Slack destinations
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Add extra Slack webhooks for channel-specific routing. Recurring
                    reports can send to the default workspace destination or any saved
                    destination below.
                  </p>
                </div>
                <div className="grid w-full gap-3 lg:max-w-3xl lg:grid-cols-[1fr,1fr,auto]">
                  <input
                    type="text"
                    value={workspaceSlackDestinationName}
                    onChange={(event) => setWorkspaceSlackDestinationName(event.target.value)}
                    placeholder="Leadership channel"
                    disabled={!activeWorkspace?.canManage}
                    className="rounded-[14px] border border-slate-200 bg-[#fcfbf8] px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <input
                    type="password"
                    value={workspaceSlackDestinationWebhook}
                    onChange={(event) =>
                      setWorkspaceSlackDestinationWebhook(event.target.value)
                    }
                    placeholder="https://hooks.slack.com/services/..."
                    disabled={!activeWorkspace?.canManage}
                    className="rounded-[14px] border border-slate-200 bg-[#fcfbf8] px-3 py-2 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => void handleCreateSlackDestination()}
                    disabled={
                      !activeWorkspace?.canManage ||
                      workspaceSlackDestinationBusy !== null ||
                      !workspaceSlackDestinationName.trim() ||
                      !workspaceSlackDestinationWebhook.trim()
                    }
                    className="cursor-pointer rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {workspaceSlackDestinationBusy === "create" ? "Saving..." : "Add route"}
                  </button>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {workspaceSlackDestinations.length ? (
                  workspaceSlackDestinations.map((destination) => (
                    <div
                      key={destination.id}
                      className="flex flex-col gap-3 rounded-[16px] border border-slate-200 bg-[#fcfbf8] p-3 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {destination.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {destination.maskedWebhook || "Saved destination"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteSlackDestination(destination.id)}
                        disabled={
                          workspaceSlackDestinationBusy !== null || !activeWorkspace?.canManage
                        }
                        className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {workspaceSlackDestinationBusy === `delete:${destination.id}`
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="rounded-[16px] border border-dashed border-slate-200 bg-[#fcfbf8] px-4 py-3 text-sm text-slate-500">
                    No extra Slack destinations yet.
                  </p>
                )}
              </div>
            </div>
          </div>
            ) : null}
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
            <div className="mt-4 rounded-[20px] border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {intelligenceScope === "project"
                      ? "Saved Insights"
                      : "Saved Workspace Insights"}
                  </h4>
                  <p className="mt-1 text-sm text-slate-600">
                    {intelligenceScope === "project"
                      ? "Reopen previous project answers without re-running a model."
                      : "Reopen previous workspace answers without re-running a model."}
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  {intelligenceScope === "project"
                    ? filteredProjectInsights.length
                    : filteredWorkspaceInsights.length}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {projectInsightFilterOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() =>
                      intelligenceScope === "project"
                        ? setProjectInsightFilter(option.id)
                        : setWorkspaceInsightFilter(option.id)
                    }
                    className={`cursor-pointer rounded-full border px-4 py-2 text-xs font-semibold ${
                      (intelligenceScope === "project"
                        ? projectInsightFilter
                        : workspaceInsightFilter) === option.id
                        ? "border-slate-900 bg-slate-950 text-white"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 space-y-3">
                {intelligenceScope === "workspace" ? (
                  workspaceInsightsLoading ? (
                    <p className="text-sm text-slate-500">Loading workspace insights...</p>
                  ) : filteredWorkspaceInsights.length ? (
                    filteredWorkspaceInsights.map((insight) => {
                      const canDeleteInsight =
                        !!currentUser &&
                        (insight.createdBy?.id === currentUser.id ||
                          activeWorkspace?.canManage);

                      return (
                        <div
                          key={insight.id}
                          className={`rounded-[18px] border px-4 py-4 ${
                            selectedWorkspaceInsightId === insight.id
                              ? "border-slate-900 bg-[#fcfbf8]"
                              : "border-slate-200 bg-[#fcfbf8]"
                          }`}
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {insight.title}
                                </p>
                                {insight.isPinned ? (
                                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                                    Pinned
                                  </span>
                                ) : null}
                                {insight.archivedAt ? (
                                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                                    Archived
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
                                {insight.question}
                              </p>
                              <p className="mt-2 text-[11px] text-slate-400">
                                {new Date(insight.createdAt).toLocaleString()}
                                {insight.createdBy
                                  ? ` · ${insight.createdBy.name?.trim() || insight.createdBy.email}`
                                  : ""}
                                {insight.projectIds?.length
                                  ? ` · ${insight.projectIds.length} projects`
                                  : " · whole workspace"}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void handleToggleWorkspaceInsightPinned(insight)}
                                disabled={workspaceInsightBusyKey === `pin:${insight.id}`}
                                className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {workspaceInsightBusyKey === `pin:${insight.id}`
                                  ? "Saving..."
                                  : insight.isPinned
                                    ? "Unpin"
                                    : "Pin"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleToggleWorkspaceInsightArchived(insight)}
                                disabled={workspaceInsightBusyKey === `archive:${insight.id}`}
                                className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {workspaceInsightBusyKey === `archive:${insight.id}`
                                  ? "Saving..."
                                  : insight.archivedAt
                                    ? "Restore"
                                    : "Archive"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenSavedWorkspaceInsight(insight)}
                                className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                              >
                                Open
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleCopyInsightForNotion("workspace", insight.id)
                                }
                                className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                              >
                                Copy for Notion
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleExportInsightMarkdown("workspace", insight.id)
                                }
                                disabled={exportBusy === `insight:workspace:${insight.id}`}
                                className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {exportBusy === `insight:workspace:${insight.id}`
                                  ? "Exporting..."
                                  : "Export Markdown"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void handlePublishWorkspaceInsightToNotion(insight.id)
                                }
                                disabled={
                                  notionShareBusyKey === `workspace:${insight.id}` ||
                                  !workspaceNotionSettings?.configured ||
                                  !workspaceNotionSettings?.enabled
                                }
                                className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {notionShareBusyKey === `workspace:${insight.id}`
                                  ? "Publishing..."
                                  : "Publish to Notion"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleShareWorkspaceInsightToSlack(insight.id)}
                                disabled={
                                  slackShareBusyKey === `workspace:${insight.id}` ||
                                  !workspaceSlackSettings?.configured ||
                                  !workspaceSlackSettings?.enabled
                                }
                                className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {slackShareBusyKey === `workspace:${insight.id}`
                                  ? "Sharing..."
                                  : "Share to Slack"}
                              </button>
                              {canDeleteInsight ? (
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteWorkspaceInsight(insight.id)}
                                  disabled={workspaceInsightBusyKey === `delete:${insight.id}`}
                                  className="cursor-pointer rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {workspaceInsightBusyKey === `delete:${insight.id}`
                                    ? "Deleting..."
                                    : "Delete"}
                                </button>
                              ) : null}
                            </div>
                          </div>
                          {selectedWorkspaceInsightId === insight.id ? (
                            <div className="mt-4 rounded-[16px] border border-slate-200 bg-white px-4 py-4">
                              <div className="flex items-center justify-between gap-3">
                                <h5 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                  Workspace Insight Discussion
                                </h5>
                                <span className="text-[11px] font-semibold text-slate-400">
                                  {currentWorkspaceInsightComments.length}
                                </span>
                              </div>
                              <div className="mt-3 space-y-3">
                                {currentWorkspaceInsightComments.length ? (
                                  currentWorkspaceInsightComments.map((comment) => (
                                    <div
                                      key={comment.id}
                                      className="rounded-[14px] border border-slate-200 bg-[#fcfbf8] px-3 py-3"
                                    >
                                      {(() => {
                                        const canManageComment =
                                          !!currentUser &&
                                          (comment.user.id === currentUser.id ||
                                            activeWorkspace?.canManage);

                                        return (
                                          <>
                                            {editingCommentId === comment.id ? (
                                              <textarea
                                                value={
                                                  commentEditDrafts[comment.id] ??
                                                  comment.content
                                                }
                                                onChange={(event) =>
                                                  setCommentEditDrafts((prev) => ({
                                                    ...prev,
                                                    [comment.id]: event.target.value,
                                                  }))
                                                }
                                                rows={3}
                                                className="w-full rounded-[12px] border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none"
                                              />
                                            ) : (
                                              <p className="text-sm leading-6 text-slate-900">
                                                {comment.content}
                                              </p>
                                            )}
                                            {comment.mentions?.length ? (
                                              <div className="mt-2 flex flex-wrap gap-2">
                                                {comment.mentions.map((mention) => (
                                                  <span
                                                    key={`${comment.id}-${mention.email}`}
                                                    className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-semibold text-sky-700"
                                                  >
                                                    @{mention.name?.trim() || mention.email}
                                                  </span>
                                                ))}
                                              </div>
                                            ) : null}
                                            <p className="mt-2 text-[11px] text-slate-500">
                                              {comment.user.name?.trim() || comment.user.email} ·{" "}
                                              {new Date(comment.createdAt).toLocaleString()}
                                            </p>
                                            {canManageComment ? (
                                              <div className="mt-3 flex flex-wrap gap-2">
                                                {editingCommentId === comment.id ? (
                                                  <>
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        void handleUpdateComment(
                                                          comment.id,
                                                          commentEditDrafts[comment.id] ??
                                                            comment.content,
                                                        )
                                                      }
                                                      disabled={commentBusyKey === `edit:${comment.id}`}
                                                      className="cursor-pointer rounded-full border border-slate-200 bg-slate-950 px-3 py-1.5 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                      {commentBusyKey === `edit:${comment.id}`
                                                        ? "Saving..."
                                                        : "Save"}
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => setEditingCommentId(null)}
                                                      className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-700"
                                                    >
                                                      Cancel
                                                    </button>
                                                  </>
                                                ) : (
                                                  <>
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        setEditingCommentId(comment.id);
                                                        setCommentEditDrafts((prev) => ({
                                                          ...prev,
                                                          [comment.id]: comment.content,
                                                        }));
                                                      }}
                                                      className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-700"
                                                    >
                                                      Edit
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        void handleDeleteComment(comment.id)
                                                      }
                                                      disabled={commentBusyKey === `delete:${comment.id}`}
                                                      className="cursor-pointer rounded-full border border-red-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                      Delete
                                                    </button>
                                                  </>
                                                )}
                                              </div>
                                            ) : null}
                                          </>
                                        );
                                      })()}
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-sm text-slate-500">
                                    No comments yet for this workspace insight.
                                  </p>
                                )}
                              </div>
                              <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end">
                                <label className="flex-1">
                                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                    Add Workspace Insight Comment
                                  </span>
                                  <textarea
                                    value={workspaceInsightCommentDrafts[insight.id] || ""}
                                    onChange={(event) =>
                                      setWorkspaceInsightCommentDrafts((prev) => ({
                                        ...prev,
                                        [insight.id]: event.target.value,
                                      }))
                                    }
                                    rows={2}
                                    placeholder="Add a note or mention a teammate with @name"
                                    className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleCreateComment({
                                      content: workspaceInsightCommentDrafts[insight.id] || "",
                                      workspaceInsightId: insight.id,
                                    })
                                  }
                                  disabled={
                                    !(workspaceInsightCommentDrafts[insight.id] || "").trim() ||
                                    commentBusyKey === `workspace-insight:${insight.id}`
                                  }
                                  className="cursor-pointer rounded-full border border-slate-200 bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {commentBusyKey === `workspace-insight:${insight.id}`
                                    ? "Posting..."
                                    : "Post"}
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-500">
                      No saved workspace insights match this filter yet.
                    </p>
                  )
                ) : projectInsightsLoading ? (
                  <p className="text-sm text-slate-500">Loading saved insights...</p>
                ) : filteredProjectInsights.length ? (
                  filteredProjectInsights.map((insight) => {
                    const canDeleteInsight =
                      !!currentUser &&
                      (insight.createdBy?.id === currentUser.id || activeWorkspace?.canManage);

                    return (
                      <div
                        key={insight.id}
                        className={`rounded-[18px] border px-4 py-4 ${
                          selectedProjectInsightId === insight.id
                            ? "border-slate-900 bg-[#fcfbf8]"
                            : "border-slate-200 bg-[#fcfbf8]"
                        }`}
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {insight.title}
                              </p>
                              {insight.isPinned ? (
                                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                                  Pinned
                                </span>
                              ) : null}
                              {insight.archivedAt ? (
                                <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                                  Archived
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
                              {insight.question}
                            </p>
                            <p className="mt-2 text-[11px] text-slate-400">
                              {new Date(insight.createdAt).toLocaleString()}
                              {insight.createdBy
                                ? ` · ${insight.createdBy.name?.trim() || insight.createdBy.email}`
                                : ""}
                              {insight.archivedAt
                                ? ` · archived ${new Date(insight.archivedAt).toLocaleDateString()}`
                                : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void handleToggleProjectInsightPinned(insight)}
                              disabled={projectInsightBusyKey === `pin:${insight.id}`}
                              className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {projectInsightBusyKey === `pin:${insight.id}`
                                ? "Saving..."
                                : insight.isPinned
                                  ? "Unpin"
                                  : "Pin"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleToggleProjectInsightArchived(insight)}
                              disabled={projectInsightBusyKey === `archive:${insight.id}`}
                              className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {projectInsightBusyKey === `archive:${insight.id}`
                                ? "Saving..."
                                : insight.archivedAt
                                  ? "Restore"
                                  : "Archive"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenSavedProjectInsight(insight)}
                              className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void handleCopyInsightForNotion("project", insight.id)
                              }
                              className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                            >
                              Copy for Notion
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void handleExportInsightMarkdown("project", insight.id)
                              }
                              disabled={exportBusy === `insight:project:${insight.id}`}
                              className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {exportBusy === `insight:project:${insight.id}`
                                ? "Exporting..."
                                : "Export Markdown"}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void handlePublishProjectInsightToNotion(insight.id)
                              }
                              disabled={
                                notionShareBusyKey === `project:${insight.id}` ||
                                !workspaceNotionSettings?.configured ||
                                !workspaceNotionSettings?.enabled
                              }
                              className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {notionShareBusyKey === `project:${insight.id}`
                                ? "Publishing..."
                                : "Publish to Notion"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleShareProjectInsightToSlack(insight.id)}
                              disabled={
                                slackShareBusyKey === `project:${insight.id}` ||
                                !workspaceSlackSettings?.configured ||
                                !workspaceSlackSettings?.enabled
                              }
                              className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {slackShareBusyKey === `project:${insight.id}`
                                ? "Sharing..."
                                : "Share to Slack"}
                            </button>
                            {canDeleteInsight ? (
                              <button
                                type="button"
                                onClick={() => void handleDeleteProjectInsight(insight.id)}
                                disabled={projectInsightBusyKey === `delete:${insight.id}`}
                                className="cursor-pointer rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {projectInsightBusyKey === `delete:${insight.id}`
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                        {selectedProjectInsightId === insight.id ? (
                          <div className="mt-4 rounded-[16px] border border-slate-200 bg-white px-4 py-4">
                            <div className="flex items-center justify-between gap-3">
                              <h5 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                Insight Discussion
                              </h5>
                              <span className="text-[11px] font-semibold text-slate-400">
                                {currentProjectInsightComments.length}
                              </span>
                            </div>
                            <div className="mt-3 space-y-3">
                              {currentProjectInsightComments.length ? (
                                currentProjectInsightComments.map((comment) => (
                                  <div
                                    key={comment.id}
                                    className="rounded-[14px] border border-slate-200 bg-[#fcfbf8] px-3 py-3"
                                  >
                                    {(() => {
                                      const canManageComment =
                                        !!currentUser &&
                                        (comment.user.id === currentUser.id ||
                                          activeWorkspace?.canManage);

                                      return (
                                        <>
                                          {editingCommentId === comment.id ? (
                                            <textarea
                                              value={
                                                commentEditDrafts[comment.id] ?? comment.content
                                              }
                                              onChange={(event) =>
                                                setCommentEditDrafts((prev) => ({
                                                  ...prev,
                                                  [comment.id]: event.target.value,
                                                }))
                                              }
                                              rows={3}
                                              className="w-full rounded-[12px] border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none"
                                            />
                                          ) : (
                                            <p className="text-sm leading-6 text-slate-900">
                                              {comment.content}
                                            </p>
                                          )}
                                          {comment.mentions?.length ? (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                              {comment.mentions.map((mention) => (
                                                <span
                                                  key={`${comment.id}-${mention.email}`}
                                                  className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-semibold text-sky-700"
                                                >
                                                  @{mention.name?.trim() || mention.email}
                                                </span>
                                              ))}
                                            </div>
                                          ) : null}
                                          <p className="mt-2 text-[11px] text-slate-500">
                                            {comment.user.name?.trim() || comment.user.email} ·{" "}
                                            {new Date(comment.createdAt).toLocaleString()}
                                          </p>
                                          {canManageComment ? (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                              {editingCommentId === comment.id ? (
                                                <>
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      void handleUpdateComment(
                                                        comment.id,
                                                        commentEditDrafts[comment.id] ??
                                                          comment.content,
                                                      )
                                                    }
                                                    disabled={commentBusyKey === `edit:${comment.id}`}
                                                    className="cursor-pointer rounded-full border border-slate-200 bg-slate-950 px-3 py-1.5 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                                                  >
                                                    {commentBusyKey === `edit:${comment.id}`
                                                      ? "Saving..."
                                                      : "Save"}
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => setEditingCommentId(null)}
                                                    className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-700"
                                                  >
                                                    Cancel
                                                  </button>
                                                </>
                                              ) : (
                                                <>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setEditingCommentId(comment.id);
                                                      setCommentEditDrafts((prev) => ({
                                                        ...prev,
                                                        [comment.id]: comment.content,
                                                      }));
                                                    }}
                                                    className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-700"
                                                  >
                                                    Edit
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => void handleDeleteComment(comment.id)}
                                                    disabled={commentBusyKey === `delete:${comment.id}`}
                                                    className="cursor-pointer rounded-full border border-red-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                                                  >
                                                    Delete
                                                  </button>
                                                </>
                                              )}
                                            </div>
                                          ) : null}
                                        </>
                                      );
                                    })()}
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-slate-500">
                                  No comments yet for this insight.
                                </p>
                              )}
                            </div>
                            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end">
                              <label className="flex-1">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                  Add Insight Comment
                                </span>
                                <textarea
                                  value={projectInsightCommentDrafts[insight.id] || ""}
                                  onChange={(event) =>
                                    setProjectInsightCommentDrafts((prev) => ({
                                      ...prev,
                                      [insight.id]: event.target.value,
                                    }))
                                  }
                                  rows={2}
                                  placeholder="Add a note or mention a teammate with @name"
                                  className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleCreateComment({
                                    content: projectInsightCommentDrafts[insight.id] || "",
                                    projectInsightId: insight.id,
                                  })
                                }
                                disabled={
                                  !(projectInsightCommentDrafts[insight.id] || "").trim() ||
                                  commentBusyKey === `insight:${insight.id}`
                                }
                                className="cursor-pointer rounded-full border border-slate-200 bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {commentBusyKey === `insight:${insight.id}`
                                  ? "Posting..."
                                  : "Post"}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-500">
                    No saved insights match this filter yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
        <section
          id="upload"
          className={`${
            isOverviewSurface
              ? "border-t border-slate-200/80 px-5 py-5 sm:px-6"
              : "rounded-[28px] border border-white/80 bg-white/90 p-6 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)] sm:p-7"
          } ${
            isUploadSurfaceVisible ? "" : "hidden"
          }`}
        >
          {workspaceSurface === "overview" ? (
            <OverviewUploadSection
              key={`${focusedSummary?.id || "no-focus"}:${overviewUploadPanelVersion}`}
              hasFocusedSummary={!!focusedSummary}
              startExpanded={overviewUploadPanelStartExpanded}
              bodyProps={{
                fileInputId,
                file,
                onFileChange: (nextFile) => {
                  setFile(nextFile);
                  setEstimatedDurationSeconds(null);
                  if (nextFile) {
                    void readMediaDuration(nextFile);
                  }
                },
                estimatedDurationSeconds,
                isDev,
                testDataLoading,
                testDataStatus,
                onLoadTestData: handleLoadTestData,
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
              }}
            />
          ) : (
            <>
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
              <UploadPanelBody
                fileInputId={fileInputId}
                file={file}
                onFileChange={(nextFile) => {
                  setFile(nextFile);
                  setEstimatedDurationSeconds(null);
                  if (nextFile) {
                    void readMediaDuration(nextFile);
                  }
                }}
                estimatedDurationSeconds={estimatedDurationSeconds}
                isDev={isDev}
                testDataLoading={testDataLoading}
                testDataStatus={testDataStatus}
                onLoadTestData={handleLoadTestData}
                uploadTemplate={uploadTemplate}
                onUploadTemplateChange={setUploadTemplate}
                templateOptions={templateOptions}
                templatesStatusText={
                  templatesLoading
                    ? "Loading templates..."
                    : customTemplates.length
                      ? `${customTemplates.length} custom template${customTemplates.length === 1 ? "" : "s"}`
                      : "No custom templates yet."
                }
                templateBusy={templateBusy}
                onCreateTemplate={handleCreateTemplate}
                uploadProjectId={uploadProjectId}
                onUploadProjectIdChange={setUploadProjectId}
                projects={projects}
                projectsStatusText={
                  projectsLoading
                    ? "Loading projects..."
                    : projects.length
                      ? `${projects.length} project${projects.length === 1 ? "" : "s"}`
                      : "No projects yet."
                }
                projectBusy={projectBusy}
                onCreateProject={handleCreateProject}
                onUpload={handleUpload}
                uploading={uploading}
                durationLoading={durationLoading}
                hasEnoughEstimatedCredits={hasEnoughEstimatedCredits}
                estimatedCredits={estimatedCredits}
                billing={billing}
              />
            </>
          )}

          {shouldShowGlobalError && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800 shadow-sm">
              {error}
            </div>
          )}
        </section>

        <section
          ref={resultAreaRef}
          className={`space-y-4 ${workspaceSurface === "overview" ? "" : "hidden"}`}
        >
          <OverviewCurrentRecording
            key={focusedSummary?.id || "no-recording"}
            activeWorkspace={activeWorkspace}
            focusedSummary={focusedSummary}
            displaySummary={displaySummary}
            selectedProjectName={selectedProjectName}
            currentRecordingText={currentRecordingText}
            currentRecordingSnippet={currentRecordingSnippet}
            hasExpandableCurrentRecordingText={hasExpandableCurrentRecordingText}
            focusedSummaryHiddenByFilters={focusedSummaryHiddenByFilters}
            isFocusedSummaryProcessing={isFocusedSummaryProcessing}
            canProcessFocusedSummary={canProcessFocusedSummary}
            currentActionTasks={currentActionTasks}
            activeTranscriptionId={activeTranscriptionId}
            actionTaskBusyKey={actionTaskBusyKey}
            onProcess={handleProcess}
            onCopySummary={() =>
              void handleCopyText(
                "Summary",
                buildSummaryText(displaySummary || focusedSummary),
              )
            }
            onStartUpload={() => scrollToSection("upload")}
            onCreateActionTask={handleCreateActionTask}
            onUpdateActionTask={handleUpdateActionTask}
            onDeleteActionTask={handleDeleteActionTask}
          />
        </section>

        <section
          id="transcriptions"
          className={`rounded-[30px] border border-white/80 bg-white/88 p-8 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)] ${
            workspaceSurface === "transcriptions" ? "" : "hidden"
          }`}
        >
          <div className="border-b border-slate-200 pb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">History</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Search recordings and narrow the list with quick filters.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-[#f8f5ef] active:scale-95"
                  >
                    Clear Filters
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void loadItems()}
                  className="cursor-pointer rounded-full border border-slate-200 bg-[#fcfbf8] px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-[#f5f1ea] active:scale-95"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_180px_180px_180px]">
              <label className="block">
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                  Search
                </span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search recordings, transcripts, or notes"
                  className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                  Status
                </span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
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
                  value={templateFilter}
                  onChange={(event) => setTemplateFilter(event.target.value)}
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
                  value={projectFilter}
                  onChange={(event) => setProjectFilter(event.target.value)}
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
          </div>

          {loading ? (
            <p className="mt-6 text-sm text-slate-400 text-center">
              Loading...
            </p>
          ) : sortedItems.length === 0 ? (
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
                  : "Upload your first recording to start building your workspace."}
              </p>
              <div className="mt-5 flex justify-center gap-3">
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    Clear Filters
                  </button>
                ) : (
                  <Link
                    href="/dashboard"
                    className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Start Upload
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {sortedItems.map((item) => {
                const isProcessing =
                  processingIds[item.id] || item.status === "processing";
                const canProcess =
                  !isProcessing &&
                  (item.status === "uploaded" || item.status === "done");

                return (
                  <div
                    key={item.id}
                    className="rounded-[18px] border border-slate-200 bg-white px-4 py-4 transition-all hover:border-slate-300"
                  >
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-slate-900">
                          {item.fileName}
                        </p>
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
                                {Math.max(1, Math.ceil(item.duration / 60))}{" "}
                                credits
                              </span>
                            </>
                          ) : null}
                          {item.projectId ? (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="text-xs text-slate-500">
                                {projects.find((project) => project.id === item.projectId)?.name ||
                                  "Project"}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 xl:max-w-[28rem] xl:justify-end">
                        <select
                          value={item.projectId || "none"}
                          onChange={(event) =>
                            void handleAssignProject(item.id, event.target.value)
                          }
                          className="cursor-pointer rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-700"
                        >
                          <option value="none">No project</option>
                          {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleProcess(item.id, item.template)}
                          disabled={!canProcess}
                          className={`cursor-pointer rounded-full border px-3.5 py-2 text-[11px] font-semibold active:scale-95 ${
                            isProcessing
                              ? "border-sky-200 bg-sky-50 text-sky-700 shadow-[0_10px_24px_-20px_rgba(14,165,233,0.9)]"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-[#fff4ec] hover:text-orange-700"
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          {isProcessing ? "Processing..." : "Process"}
                        </button>

                        {item.transcript && (
                          <button
                            type="button"
                            onClick={() => toggleTranscript(item.id)}
                            className="cursor-pointer rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-700 hover:border-slate-300 hover:bg-[#f2f7ff] hover:text-sky-700 active:scale-95"
                          >
                            {expandedTranscripts[item.id]
                              ? "Hide Transcript"
                              : "View Transcript"}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="cursor-pointer rounded-full border border-red-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
                        >
                          {deletingId === item.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>

                    {item.transcript && expandedTranscripts[item.id] && (
                      <div className="mt-4 rounded-[16px] border border-slate-200 bg-[#fcfbf8] p-4">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Transcript
                          </p>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                            {item.transcript.length.toLocaleString()} chars
                          </span>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap leading-6 text-sm text-slate-700">
                          {item.transcript}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <aside
        id="assistant"
        className={`self-start lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] ${
          workspaceSurface === "settings" ? "hidden" : ""
        }`}
      >
        <section className="flex h-full flex-col gap-4 rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.28)]">
          <div className="rounded-[24px] border border-slate-200 bg-[#fafaf7] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-sm font-semibold text-slate-900">Voxly Tab</span>
              </div>
              <button
                type="button"
                onClick={() => void handleRefreshNotes()}
                disabled={
                  assistantScope === "transcript" &&
                  (assistantRefreshing || assistantHistoryLoading)
                }
                className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {assistantScope === "transcript"
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
                  {assistantScope === "transcript"
                    ? "Ask Voxly to refine the notes"
                    : assistantScope === "project"
                      ? "Ask across this project"
                      : "Ask across the workspace"}
                </h3>
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
                    setAssistantScope(scopeId);
                    setAssistantError(null);
                    setAssistantPrompt("");
                  }}
                  className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                    assistantScope === scopeId
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {assistantScope === "project" ? (
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Project scope
                </span>
                <select
                  value={assistantProjectId}
                  onChange={(event) => setAssistantProjectId(event.target.value)}
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

            {assistantScope === "workspace" ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Narrow to projects
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {projects.length ? (
                    projects.map((project) => {
                      const selected = assistantWorkspaceProjectIds.includes(project.id);
                      return (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => handleToggleAssistantWorkspaceProject(project.id)}
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
                  {assistantScope === "transcript"
                    ? "How can I help with these notes?"
                    : assistantScope === "project"
                      ? "What should Voxly find across this project?"
                      : "What should Voxly synthesize across the workspace?"}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  {assistantScope === "transcript"
                    ? "I can directly edit your notes – add key points, update action items, change priorities, and more."
                    : "I can search across multiple transcripts, synthesize themes, and answer with grounded sources."}
                </p>
              </div>
            </div>

            {(assistantScope !== "transcript" || hasProcessedSummary) ? (
              <div className="mt-4 space-y-2">
                {assistantScopeSuggestions[assistantScope].map((text) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => handleAssistantSuggestion(text)}
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
                  assistantScope === "transcript"
                    ? "Ask me to edit your notes..."
                    : assistantScope === "project"
                      ? "Ask across this project..."
                      : "Ask across the workspace..."
                }
                ref={assistantInputRef}
                value={assistantPrompt}
                disabled={
                  assistantBusy || (assistantScope === "transcript" && !hasProcessedSummary)
                }
                onChange={(event) => setAssistantPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAssistantSubmit();
                  }
                }}
                className="flex-1 rounded-full border border-slate-200 bg-[#fcfbf8] px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none transition-all focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => handleAssistantSubmit()}
                disabled={
                  assistantBusy || (assistantScope === "transcript" && !hasProcessedSummary)
                }
                className="cursor-pointer rounded-full bg-[#f97316] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#ea580c] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Send
              </button>
            </div>
            {assistantError && (
              <p className="text-xs text-red-600">{assistantError}</p>
            )}
            {assistantHistoryLoading ? (
              <p className="text-xs text-slate-500">Loading notes history...</p>
            ) : null}
            <p className="text-xs leading-relaxed text-slate-500">
              {assistantScope === "transcript"
                ? hasProcessedSummary
                  ? "Ready to help. Choose a suggestion or type your own request."
                  : "Process a recording to unlock prompts and assistant edits."
                : assistantScope === "project"
                  ? "Project answers use grounded retrieval across recordings in the selected project."
                  : "Workspace answers search across your workspace, or just the projects you select above."}
            </p>
            </div>
          </div>

        </section>
      </aside>
      </div>
    </div>
  );
}
