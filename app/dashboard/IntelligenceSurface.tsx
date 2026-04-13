"use client";

import { type Dispatch, type FormEvent, memo, type SetStateAction } from "react";
import { DeferredCheckbox } from "./SettingsSurface";
import type {
  ActiveWorkspaceDetails,
  ProjectDigestSettings,
  SavedProjectInsight,
  SavedWorkspaceInsight,
  WorkspaceComment,
  WorkspaceNotionSettings,
  WorkspaceSlackDestination,
  WorkspaceSlackSettings,
} from "./TranscriptionClient";

type DigestCadence = "weekly" | "monthly";
type DigestReportType = "summary" | "new_insights" | "open_tasks" | "risk_watch";

type ProjectDigestPanelProps = {
  intelligenceScope: "project" | "workspace";
  intelligenceProjectId: string;
  activeWorkspace: ActiveWorkspaceDetails | null;
  projectDigestSettings: ProjectDigestSettings | null;
  projectDigestEnabled: boolean;
  projectDigestLoading: boolean;
  projectDigestCadence: DigestCadence;
  projectDigestReportType: DigestReportType;
  projectDigestRecipientScope: string;
  projectDigestSendEmail: boolean;
  projectDigestSendSlack: boolean;
  projectDigestSlackDestinationId: string;
  projectDigestWeekday: string;
  projectDigestDayOfMonth: string;
  projectDigestHour: string;
  projectDigestBusy: string | null;
  projectDigestTemplateName: string;
  reportTemplateBusyKey: string | null;
  workspaceSlackDestinations: WorkspaceSlackDestination[];
  workspaceSlackDestinationName: string;
  workspaceSlackDestinationWebhook: string;
  workspaceSlackDestinationBusy: string | null;
  digestReportTypeOptions: Array<{ id: string; label: string; description: string }>;
  digestCadenceOptions: Array<{ id: string; label: string }>;
  digestRecipientOptions: Array<{ id: string; label: string }>;
  digestWeekdayOptions: Array<{ id: string; label: string }>;
  setProjectDigestEnabled: (checked: boolean) => void;
  setProjectDigestCadence: (value: DigestCadence) => void;
  setProjectDigestReportType: (value: DigestReportType) => void;
  setProjectDigestRecipientScope: (value: string) => void;
  setProjectDigestSendEmail: (checked: boolean) => void;
  setProjectDigestSendSlack: (checked: boolean) => void;
  setProjectDigestSlackDestinationId: (value: string) => void;
  setProjectDigestWeekday: (value: string) => void;
  setProjectDigestDayOfMonth: (value: string) => void;
  setProjectDigestHour: (value: string) => void;
  setProjectDigestTemplateName: (value: string) => void;
  setWorkspaceSlackDestinationName: (value: string) => void;
  setWorkspaceSlackDestinationWebhook: (value: string) => void;
  handleSaveProjectDigestSettings: (event: FormEvent<HTMLFormElement>) => void;
  handleSendProjectDigestNow: () => Promise<void>;
  handleSaveReportTemplate: (scope: "project") => Promise<void>;
  handleCreateSlackDestination: () => Promise<void>;
  handleDeleteSlackDestination: (destinationId: string) => Promise<void>;
};

export const ProjectDigestPanel = memo(function ProjectDigestPanel({
  intelligenceScope,
  intelligenceProjectId,
  activeWorkspace,
  projectDigestSettings,
  projectDigestEnabled,
  projectDigestLoading,
  projectDigestCadence,
  projectDigestReportType,
  projectDigestRecipientScope,
  projectDigestSendEmail,
  projectDigestSendSlack,
  projectDigestSlackDestinationId,
  projectDigestWeekday,
  projectDigestDayOfMonth,
  projectDigestHour,
  projectDigestBusy,
  projectDigestTemplateName,
  reportTemplateBusyKey,
  workspaceSlackDestinations,
  workspaceSlackDestinationName,
  workspaceSlackDestinationWebhook,
  workspaceSlackDestinationBusy,
  digestReportTypeOptions,
  digestCadenceOptions,
  digestRecipientOptions,
  digestWeekdayOptions,
  setProjectDigestEnabled,
  setProjectDigestCadence,
  setProjectDigestReportType,
  setProjectDigestRecipientScope,
  setProjectDigestSendEmail,
  setProjectDigestSendSlack,
  setProjectDigestSlackDestinationId,
  setProjectDigestWeekday,
  setProjectDigestDayOfMonth,
  setProjectDigestHour,
  setProjectDigestTemplateName,
  setWorkspaceSlackDestinationName,
  setWorkspaceSlackDestinationWebhook,
  handleSaveProjectDigestSettings,
  handleSendProjectDigestNow,
  handleSaveReportTemplate,
  handleCreateSlackDestination,
  handleDeleteSlackDestination,
}: ProjectDigestPanelProps) {
  if (intelligenceScope !== "project" || intelligenceProjectId === "all") {
    return null;
  }

  return (
    <>
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
          <DeferredCheckbox
            checked={projectDigestEnabled}
            onCheckedChange={setProjectDigestEnabled}
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
            <DeferredCheckbox
              checked={projectDigestSendEmail}
              onCheckedChange={setProjectDigestSendEmail}
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
            <DeferredCheckbox
              checked={projectDigestSendSlack}
              onCheckedChange={setProjectDigestSendSlack}
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
    </>
  );
});

type CurrentUserSummary = {
  id: string;
  email: string;
  name?: string | null;
} | null;

type InsightCommentInput = {
  content: string;
  transcriptionId?: string;
  taskId?: string;
  projectInsightId?: string;
  workspaceInsightId?: string;
};

export type SavedInsightsPanelProps = {
  intelligenceScope: "project" | "workspace";
  activeWorkspace: ActiveWorkspaceDetails | null;
  currentUser: CurrentUserSummary;
  projectInsightFilterOptions: Array<{ id: string; label: string }>;
  projectInsightFilter: string;
  workspaceInsightFilter: string;
  filteredProjectInsights: SavedProjectInsight[];
  filteredWorkspaceInsights: SavedWorkspaceInsight[];
  projectInsightsLoading: boolean;
  workspaceInsightsLoading: boolean;
  selectedProjectInsightId: string | null;
  selectedWorkspaceInsightId: string | null;
  projectInsightBusyKey: string | null;
  workspaceInsightBusyKey: string | null;
  exportBusy: string | null;
  notionShareBusyKey: string | null;
  slackShareBusyKey: string | null;
  workspaceNotionSettings: WorkspaceNotionSettings | null;
  workspaceSlackSettings: WorkspaceSlackSettings | null;
  currentProjectInsightComments: WorkspaceComment[];
  currentWorkspaceInsightComments: WorkspaceComment[];
  editingCommentId: string | null;
  commentEditDrafts: Record<string, string>;
  commentBusyKey: string | null;
  projectInsightCommentDrafts: Record<string, string>;
  workspaceInsightCommentDrafts: Record<string, string>;
  setProjectInsightFilter: (value: string) => void;
  setWorkspaceInsightFilter: (value: string) => void;
  setEditingCommentId: (value: string | null) => void;
  setCommentEditDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setProjectInsightCommentDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setWorkspaceInsightCommentDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  handleToggleProjectInsightPinned: (insight: SavedProjectInsight) => Promise<void>;
  handleToggleProjectInsightArchived: (insight: SavedProjectInsight) => Promise<void>;
  handleOpenSavedProjectInsight: (insight: SavedProjectInsight) => void;
  handleToggleWorkspaceInsightPinned: (insight: SavedWorkspaceInsight) => Promise<void>;
  handleToggleWorkspaceInsightArchived: (insight: SavedWorkspaceInsight) => Promise<void>;
  handleOpenSavedWorkspaceInsight: (insight: SavedWorkspaceInsight) => void;
  handleCopyInsightForNotion: (scope: "project" | "workspace", insightId: string) => Promise<void>;
  handleExportInsightMarkdown: (scope: "project" | "workspace", insightId: string) => Promise<void>;
  handlePublishProjectInsightToNotion: (insightId: string) => Promise<void>;
  handlePublishWorkspaceInsightToNotion: (insightId: string) => Promise<void>;
  handleShareProjectInsightToSlack: (insightId: string) => Promise<void>;
  handleShareWorkspaceInsightToSlack: (insightId: string) => Promise<void>;
  handleDeleteProjectInsight: (insightId: string) => Promise<void>;
  handleDeleteWorkspaceInsight: (insightId: string) => Promise<void>;
  handleUpdateComment: (commentId: string, content: string) => Promise<void>;
  handleDeleteComment: (commentId: string) => Promise<void>;
  handleCreateComment: (input: InsightCommentInput) => Promise<void>;
};

type InsightCommentThreadProps = {
  title: string;
  emptyLabel: string;
  addLabel: string;
  comments: WorkspaceComment[];
  currentUser: CurrentUserSummary;
  canManageWorkspace: boolean;
  editingCommentId: string | null;
  commentEditDrafts: Record<string, string>;
  commentBusyKey: string | null;
  draft: string;
  draftBusyKey: string;
  onDraftChange: (value: string) => void;
  onCreateComment: () => Promise<void>;
  setEditingCommentId: (value: string | null) => void;
  setCommentEditDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  handleUpdateComment: (commentId: string, content: string) => Promise<void>;
  handleDeleteComment: (commentId: string) => Promise<void>;
};

const InsightCommentThread = memo(function InsightCommentThread({
  title,
  emptyLabel,
  addLabel,
  comments,
  currentUser,
  canManageWorkspace,
  editingCommentId,
  commentEditDrafts,
  commentBusyKey,
  draft,
  draftBusyKey,
  onDraftChange,
  onCreateComment,
  setEditingCommentId,
  setCommentEditDrafts,
  handleUpdateComment,
  handleDeleteComment,
}: InsightCommentThreadProps) {
  return (
    <div className="mt-4 rounded-[16px] border border-slate-200 bg-white px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <h5 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          {title}
        </h5>
        <span className="text-[11px] font-semibold text-slate-400">
          {comments.length}
        </span>
      </div>
      <div className="mt-3 space-y-3">
        {comments.length ? (
          comments.map((comment) => {
            const canManageComment =
              !!currentUser &&
              (comment.user.id === currentUser.id || canManageWorkspace);

            return (
              <div
                key={comment.id}
                className="rounded-[14px] border border-slate-200 bg-[#fcfbf8] px-3 py-3"
              >
                {editingCommentId === comment.id ? (
                  <textarea
                    value={commentEditDrafts[comment.id] ?? comment.content}
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
                              commentEditDrafts[comment.id] ?? comment.content,
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
              </div>
            );
          })
        ) : (
          <p className="text-sm text-slate-500">{emptyLabel}</p>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="flex-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {addLabel}
          </span>
          <textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            rows={2}
            placeholder="Add a note or mention a teammate with @name"
            className="mt-2 w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => void onCreateComment()}
          disabled={!draft.trim() || commentBusyKey === draftBusyKey}
          className="cursor-pointer rounded-full border border-slate-200 bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {commentBusyKey === draftBusyKey ? "Posting..." : "Post"}
        </button>
      </div>
    </div>
  );
});


type WorkspaceSavedInsightCardProps = Pick<
  SavedInsightsPanelProps,
  | "activeWorkspace"
  | "currentUser"
  | "workspaceInsightBusyKey"
  | "exportBusy"
  | "notionShareBusyKey"
  | "slackShareBusyKey"
  | "workspaceNotionSettings"
  | "workspaceSlackSettings"
  | "selectedWorkspaceInsightId"
  | "currentWorkspaceInsightComments"
  | "editingCommentId"
  | "commentEditDrafts"
  | "commentBusyKey"
  | "workspaceInsightCommentDrafts"
  | "setEditingCommentId"
  | "setCommentEditDrafts"
  | "setWorkspaceInsightCommentDrafts"
  | "handleToggleWorkspaceInsightPinned"
  | "handleToggleWorkspaceInsightArchived"
  | "handleOpenSavedWorkspaceInsight"
  | "handleCopyInsightForNotion"
  | "handleExportInsightMarkdown"
  | "handlePublishWorkspaceInsightToNotion"
  | "handleShareWorkspaceInsightToSlack"
  | "handleDeleteWorkspaceInsight"
  | "handleUpdateComment"
  | "handleDeleteComment"
  | "handleCreateComment"
> & {
  insight: SavedWorkspaceInsight;
  canDeleteInsight: boolean;
};

function isWorkspaceInsightBusyKeyRelevant(key: string | null, insightId: string) {
  return (
    key === `pin:${insightId}` ||
    key === `archive:${insightId}` ||
    key === `delete:${insightId}`
  );
}

function isProjectInsightBusyKeyRelevant(key: string | null, insightId: string) {
  return (
    key === `pin:${insightId}` ||
    key === `archive:${insightId}` ||
    key === `delete:${insightId}`
  );
}

function isInsightExportBusyKeyRelevant(
  key: string | null,
  scope: "project" | "workspace",
  insightId: string,
) {
  return key === `insight:${scope}:${insightId}`;
}

function isInsightShareBusyKeyRelevant(
  key: string | null,
  scope: "project" | "workspace",
  insightId: string,
) {
  return key === `${scope}:${insightId}`;
}

function isCommentBusyKeyRelevant(key: string | null, draftBusyKey: string) {
  return !!key && (key === draftBusyKey || key.startsWith("edit:") || key.startsWith("delete:"));
}

function areWorkspaceSavedInsightCardPropsEqual(
  prev: WorkspaceSavedInsightCardProps,
  next: WorkspaceSavedInsightCardProps,
) {
  const insightId = prev.insight.id;
  const wasSelected = prev.selectedWorkspaceInsightId === insightId;
  const isSelected = next.selectedWorkspaceInsightId === next.insight.id;

  return (
    prev.insight === next.insight &&
    prev.canDeleteInsight === next.canDeleteInsight &&
    Boolean(prev.activeWorkspace?.canManage) === Boolean(next.activeWorkspace?.canManage) &&
    prev.currentUser?.id === next.currentUser?.id &&
    wasSelected === isSelected &&
    isWorkspaceInsightBusyKeyRelevant(prev.workspaceInsightBusyKey, insightId) ===
      isWorkspaceInsightBusyKeyRelevant(next.workspaceInsightBusyKey, insightId) &&
    isInsightExportBusyKeyRelevant(prev.exportBusy, "workspace", insightId) ===
      isInsightExportBusyKeyRelevant(next.exportBusy, "workspace", insightId) &&
    isInsightShareBusyKeyRelevant(prev.notionShareBusyKey, "workspace", insightId) ===
      isInsightShareBusyKeyRelevant(next.notionShareBusyKey, "workspace", insightId) &&
    isInsightShareBusyKeyRelevant(prev.slackShareBusyKey, "workspace", insightId) ===
      isInsightShareBusyKeyRelevant(next.slackShareBusyKey, "workspace", insightId) &&
    prev.workspaceNotionSettings?.configured === next.workspaceNotionSettings?.configured &&
    prev.workspaceNotionSettings?.enabled === next.workspaceNotionSettings?.enabled &&
    prev.workspaceSlackSettings?.configured === next.workspaceSlackSettings?.configured &&
    prev.workspaceSlackSettings?.enabled === next.workspaceSlackSettings?.enabled &&
    (!isSelected ||
      (prev.currentWorkspaceInsightComments === next.currentWorkspaceInsightComments &&
        prev.editingCommentId === next.editingCommentId &&
        prev.commentEditDrafts === next.commentEditDrafts &&
        prev.workspaceInsightCommentDrafts[insightId] ===
          next.workspaceInsightCommentDrafts[insightId] &&
        isCommentBusyKeyRelevant(prev.commentBusyKey, `workspace-insight:${insightId}`) ===
          isCommentBusyKeyRelevant(next.commentBusyKey, `workspace-insight:${insightId}`)))
  );
}

const WorkspaceSavedInsightCard = memo(function WorkspaceSavedInsightCard({
  insight,
  canDeleteInsight,
  activeWorkspace,
  currentUser,
  workspaceInsightBusyKey,
  exportBusy,
  notionShareBusyKey,
  slackShareBusyKey,
  workspaceNotionSettings,
  workspaceSlackSettings,
  selectedWorkspaceInsightId,
  currentWorkspaceInsightComments,
  editingCommentId,
  commentEditDrafts,
  commentBusyKey,
  workspaceInsightCommentDrafts,
  setEditingCommentId,
  setCommentEditDrafts,
  setWorkspaceInsightCommentDrafts,
  handleToggleWorkspaceInsightPinned,
  handleToggleWorkspaceInsightArchived,
  handleOpenSavedWorkspaceInsight,
  handleCopyInsightForNotion,
  handleExportInsightMarkdown,
  handlePublishWorkspaceInsightToNotion,
  handleShareWorkspaceInsightToSlack,
  handleDeleteWorkspaceInsight,
  handleUpdateComment,
  handleDeleteComment,
  handleCreateComment,
}: WorkspaceSavedInsightCardProps) {
  return (
            <div
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
                <InsightCommentThread
                  title="Workspace Insight Discussion"
                  emptyLabel="No comments yet for this workspace insight."
                  addLabel="Add Workspace Insight Comment"
                  comments={currentWorkspaceInsightComments}
                  currentUser={currentUser}
                  canManageWorkspace={Boolean(activeWorkspace?.canManage)}
                  editingCommentId={editingCommentId}
                  commentEditDrafts={commentEditDrafts}
                  commentBusyKey={commentBusyKey}
                  draft={workspaceInsightCommentDrafts[insight.id] || ""}
                  draftBusyKey={`workspace-insight:${insight.id}`}
                  onDraftChange={(value) =>
                    setWorkspaceInsightCommentDrafts((prev) => ({
                      ...prev,
                      [insight.id]: value,
                    }))
                  }
                  onCreateComment={() =>
                    handleCreateComment({
                      content: workspaceInsightCommentDrafts[insight.id] || "",
                      workspaceInsightId: insight.id,
                    })
                  }
                  setEditingCommentId={setEditingCommentId}
                  setCommentEditDrafts={setCommentEditDrafts}
                  handleUpdateComment={handleUpdateComment}
                  handleDeleteComment={handleDeleteComment}
                />
              ) : null}
            </div>
  );
}, areWorkspaceSavedInsightCardPropsEqual);

type ProjectSavedInsightCardProps = Pick<
  SavedInsightsPanelProps,
  | "activeWorkspace"
  | "currentUser"
  | "projectInsightBusyKey"
  | "exportBusy"
  | "notionShareBusyKey"
  | "slackShareBusyKey"
  | "workspaceNotionSettings"
  | "workspaceSlackSettings"
  | "selectedProjectInsightId"
  | "currentProjectInsightComments"
  | "editingCommentId"
  | "commentEditDrafts"
  | "commentBusyKey"
  | "projectInsightCommentDrafts"
  | "setEditingCommentId"
  | "setCommentEditDrafts"
  | "setProjectInsightCommentDrafts"
  | "handleToggleProjectInsightPinned"
  | "handleToggleProjectInsightArchived"
  | "handleOpenSavedProjectInsight"
  | "handleCopyInsightForNotion"
  | "handleExportInsightMarkdown"
  | "handlePublishProjectInsightToNotion"
  | "handleShareProjectInsightToSlack"
  | "handleDeleteProjectInsight"
  | "handleUpdateComment"
  | "handleDeleteComment"
  | "handleCreateComment"
> & {
  insight: SavedProjectInsight;
  canDeleteInsight: boolean;
};

function areProjectSavedInsightCardPropsEqual(
  prev: ProjectSavedInsightCardProps,
  next: ProjectSavedInsightCardProps,
) {
  const insightId = prev.insight.id;
  const wasSelected = prev.selectedProjectInsightId === insightId;
  const isSelected = next.selectedProjectInsightId === next.insight.id;

  return (
    prev.insight === next.insight &&
    prev.canDeleteInsight === next.canDeleteInsight &&
    Boolean(prev.activeWorkspace?.canManage) === Boolean(next.activeWorkspace?.canManage) &&
    prev.currentUser?.id === next.currentUser?.id &&
    wasSelected === isSelected &&
    isProjectInsightBusyKeyRelevant(prev.projectInsightBusyKey, insightId) ===
      isProjectInsightBusyKeyRelevant(next.projectInsightBusyKey, insightId) &&
    isInsightExportBusyKeyRelevant(prev.exportBusy, "project", insightId) ===
      isInsightExportBusyKeyRelevant(next.exportBusy, "project", insightId) &&
    isInsightShareBusyKeyRelevant(prev.notionShareBusyKey, "project", insightId) ===
      isInsightShareBusyKeyRelevant(next.notionShareBusyKey, "project", insightId) &&
    isInsightShareBusyKeyRelevant(prev.slackShareBusyKey, "project", insightId) ===
      isInsightShareBusyKeyRelevant(next.slackShareBusyKey, "project", insightId) &&
    prev.workspaceNotionSettings?.configured === next.workspaceNotionSettings?.configured &&
    prev.workspaceNotionSettings?.enabled === next.workspaceNotionSettings?.enabled &&
    prev.workspaceSlackSettings?.configured === next.workspaceSlackSettings?.configured &&
    prev.workspaceSlackSettings?.enabled === next.workspaceSlackSettings?.enabled &&
    (!isSelected ||
      (prev.currentProjectInsightComments === next.currentProjectInsightComments &&
        prev.editingCommentId === next.editingCommentId &&
        prev.commentEditDrafts === next.commentEditDrafts &&
        prev.projectInsightCommentDrafts[insightId] ===
          next.projectInsightCommentDrafts[insightId] &&
        isCommentBusyKeyRelevant(prev.commentBusyKey, `insight:${insightId}`) ===
          isCommentBusyKeyRelevant(next.commentBusyKey, `insight:${insightId}`)))
  );
}

const ProjectSavedInsightCard = memo(function ProjectSavedInsightCard({
  insight,
  canDeleteInsight,
  activeWorkspace,
  currentUser,
  projectInsightBusyKey,
  exportBusy,
  notionShareBusyKey,
  slackShareBusyKey,
  workspaceNotionSettings,
  workspaceSlackSettings,
  selectedProjectInsightId,
  currentProjectInsightComments,
  editingCommentId,
  commentEditDrafts,
  commentBusyKey,
  projectInsightCommentDrafts,
  setEditingCommentId,
  setCommentEditDrafts,
  setProjectInsightCommentDrafts,
  handleToggleProjectInsightPinned,
  handleToggleProjectInsightArchived,
  handleOpenSavedProjectInsight,
  handleCopyInsightForNotion,
  handleExportInsightMarkdown,
  handlePublishProjectInsightToNotion,
  handleShareProjectInsightToSlack,
  handleDeleteProjectInsight,
  handleUpdateComment,
  handleDeleteComment,
  handleCreateComment,
}: ProjectSavedInsightCardProps) {
  return (
          <div
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
              <InsightCommentThread
                title="Insight Discussion"
                emptyLabel="No comments yet for this insight."
                addLabel="Add Insight Comment"
                comments={currentProjectInsightComments}
                currentUser={currentUser}
                canManageWorkspace={Boolean(activeWorkspace?.canManage)}
                editingCommentId={editingCommentId}
                commentEditDrafts={commentEditDrafts}
                commentBusyKey={commentBusyKey}
                draft={projectInsightCommentDrafts[insight.id] || ""}
                draftBusyKey={`insight:${insight.id}`}
                onDraftChange={(value) =>
                  setProjectInsightCommentDrafts((prev) => ({
                    ...prev,
                    [insight.id]: value,
                  }))
                }
                onCreateComment={() =>
                  handleCreateComment({
                    content: projectInsightCommentDrafts[insight.id] || "",
                    projectInsightId: insight.id,
                  })
                }
                setEditingCommentId={setEditingCommentId}
                setCommentEditDrafts={setCommentEditDrafts}
                handleUpdateComment={handleUpdateComment}
                handleDeleteComment={handleDeleteComment}
              />
            ) : null}
          </div>
  );
}, areProjectSavedInsightCardPropsEqual);

export const SavedInsightsPanel = memo(function SavedInsightsPanel({
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
  handleToggleProjectInsightPinned,
  handleToggleProjectInsightArchived,
  handleOpenSavedProjectInsight,
  handleToggleWorkspaceInsightPinned,
  handleToggleWorkspaceInsightArchived,
  handleOpenSavedWorkspaceInsight,
  handleCopyInsightForNotion,
  handleExportInsightMarkdown,
  handlePublishProjectInsightToNotion,
  handlePublishWorkspaceInsightToNotion,
  handleShareProjectInsightToSlack,
  handleShareWorkspaceInsightToSlack,
  handleDeleteProjectInsight,
  handleDeleteWorkspaceInsight,
  handleUpdateComment,
  handleDeleteComment,
  handleCreateComment,
}: SavedInsightsPanelProps) {
  return (
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
            <WorkspaceSavedInsightCard
              key={insight.id}
              insight={insight}
              canDeleteInsight={Boolean(canDeleteInsight)}
              activeWorkspace={activeWorkspace}
              currentUser={currentUser}
              workspaceInsightBusyKey={workspaceInsightBusyKey}
              exportBusy={exportBusy}
              notionShareBusyKey={notionShareBusyKey}
              slackShareBusyKey={slackShareBusyKey}
              workspaceNotionSettings={workspaceNotionSettings}
              workspaceSlackSettings={workspaceSlackSettings}
              selectedWorkspaceInsightId={selectedWorkspaceInsightId}
              currentWorkspaceInsightComments={currentWorkspaceInsightComments}
              editingCommentId={editingCommentId}
              commentEditDrafts={commentEditDrafts}
              commentBusyKey={commentBusyKey}
              workspaceInsightCommentDrafts={workspaceInsightCommentDrafts}
              setEditingCommentId={setEditingCommentId}
              setCommentEditDrafts={setCommentEditDrafts}
              setWorkspaceInsightCommentDrafts={setWorkspaceInsightCommentDrafts}
              handleToggleWorkspaceInsightPinned={handleToggleWorkspaceInsightPinned}
              handleToggleWorkspaceInsightArchived={handleToggleWorkspaceInsightArchived}
              handleOpenSavedWorkspaceInsight={handleOpenSavedWorkspaceInsight}
              handleCopyInsightForNotion={handleCopyInsightForNotion}
              handleExportInsightMarkdown={handleExportInsightMarkdown}
              handlePublishWorkspaceInsightToNotion={handlePublishWorkspaceInsightToNotion}
              handleShareWorkspaceInsightToSlack={handleShareWorkspaceInsightToSlack}
              handleDeleteWorkspaceInsight={handleDeleteWorkspaceInsight}
              handleUpdateComment={handleUpdateComment}
              handleDeleteComment={handleDeleteComment}
              handleCreateComment={handleCreateComment}
            />
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
          <ProjectSavedInsightCard
            key={insight.id}
            insight={insight}
            canDeleteInsight={Boolean(canDeleteInsight)}
            activeWorkspace={activeWorkspace}
            currentUser={currentUser}
            projectInsightBusyKey={projectInsightBusyKey}
            exportBusy={exportBusy}
            notionShareBusyKey={notionShareBusyKey}
            slackShareBusyKey={slackShareBusyKey}
            workspaceNotionSettings={workspaceNotionSettings}
            workspaceSlackSettings={workspaceSlackSettings}
            selectedProjectInsightId={selectedProjectInsightId}
            currentProjectInsightComments={currentProjectInsightComments}
            editingCommentId={editingCommentId}
            commentEditDrafts={commentEditDrafts}
            commentBusyKey={commentBusyKey}
            projectInsightCommentDrafts={projectInsightCommentDrafts}
            setEditingCommentId={setEditingCommentId}
            setCommentEditDrafts={setCommentEditDrafts}
            setProjectInsightCommentDrafts={setProjectInsightCommentDrafts}
            handleToggleProjectInsightPinned={handleToggleProjectInsightPinned}
            handleToggleProjectInsightArchived={handleToggleProjectInsightArchived}
            handleOpenSavedProjectInsight={handleOpenSavedProjectInsight}
            handleCopyInsightForNotion={handleCopyInsightForNotion}
            handleExportInsightMarkdown={handleExportInsightMarkdown}
            handlePublishProjectInsightToNotion={handlePublishProjectInsightToNotion}
            handleShareProjectInsightToSlack={handleShareProjectInsightToSlack}
            handleDeleteProjectInsight={handleDeleteProjectInsight}
            handleUpdateComment={handleUpdateComment}
            handleDeleteComment={handleDeleteComment}
            handleCreateComment={handleCreateComment}
          />
        );
      })
    ) : (
      <p className="text-sm text-slate-500">
        No saved insights match this filter yet.
      </p>
    )}
  </div>
</div>
  );
});
