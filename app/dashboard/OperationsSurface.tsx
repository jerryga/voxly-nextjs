"use client";

import { memo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import type {
  ActionTask,
  RecurringReportRun,
  ReportRunSummary,
  WorkspaceNotification,
} from "./TranscriptionClient";

type WorkspaceTaskCounts = {
  total: number;
  open: number;
  inProgress: number;
  done: number;
};

export type WorkspaceTasksSurfaceProps = {
  isActive: boolean;
  workspaceTaskCounts: WorkspaceTaskCounts;
  workspaceTaskStatusFilter: string;
  workspaceTaskAssignmentFilter: string;
  taskStatusOptions: Array<{ id: string; label: string }>;
  taskAssignmentOptions: Array<{ id: string; label: string }>;
  workspaceTasksLoading: boolean;
  filteredWorkspaceTasks: ActionTask[];
  actionTaskBusyKey: string | null;
  onWorkspaceTaskStatusFilterChange: (value: string) => void;
  onWorkspaceTaskAssignmentFilterChange: (value: string) => void;
  onUpdateActionTask: (
    taskId: string,
    updates: Partial<Pick<ActionTask, "status" | "assignee" | "dueDate">>,
  ) => Promise<void>;
  onDeleteActionTask: (taskId: string) => Promise<void>;
  onOpenTaskTranscript: (task: ActionTask) => void;
};

export const WorkspaceTasksSurface = memo(function WorkspaceTasksSurface({
  isActive,
  workspaceTaskCounts,
  workspaceTaskStatusFilter,
  workspaceTaskAssignmentFilter,
  taskStatusOptions,
  taskAssignmentOptions,
  workspaceTasksLoading,
  filteredWorkspaceTasks,
  actionTaskBusyKey,
  onWorkspaceTaskStatusFilterChange,
  onWorkspaceTaskAssignmentFilterChange,
  onUpdateActionTask,
  onDeleteActionTask,
  onOpenTaskTranscript,
}: WorkspaceTasksSurfaceProps) {
  const listParentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filteredWorkspaceTasks.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: () => 136, // approximate card height + gap
    overscan: 3,
  });

  return (
    <div
      id="workspace-tasks"
      className={`mt-5 rounded-[22px] border border-slate-200 bg-[#fcfbf8] p-4 ${
        isActive ? "" : "hidden"
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
            onChange={(event) => onWorkspaceTaskStatusFilterChange(event.target.value)}
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
              onWorkspaceTaskAssignmentFilterChange(event.target.value)
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
      <div className="mt-4">
        {workspaceTasksLoading ? (
          <p className="text-sm text-slate-500">Loading workspace tasks...</p>
        ) : filteredWorkspaceTasks.length ? (
          <div
            ref={listParentRef}
            className="max-h-[640px] overflow-auto"
          >
            <div
              style={{ height: virtualizer.getTotalSize(), position: "relative" }}
            >
              {virtualizer.getVirtualItems().map((vItem) => {
                const task = filteredWorkspaceTasks[vItem.index];
                return (
                  <div
                    key={task.id}
                    data-index={vItem.index}
                    ref={virtualizer.measureElement}
                    style={{ position: "absolute", top: vItem.start, width: "100%", paddingBottom: "12px" }}
                  >
                    <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">
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
                            <span>Added {new Date(task.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 xl:justify-end">
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
                            onClick={() => onOpenTaskTranscript(task)}
                            className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                          >
                            Open Transcript
                          </button>
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
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No tracked tasks match these filters yet.
          </p>
        )}
      </div>
    </div>
  );
});

export type OperationsActivitySurfaceProps = {
  isActive: boolean;
  unreadNotificationsCount: number;
  notificationBusyId: string | null;
  reportRunSummaryLoading: boolean;
  reportRunSummary: ReportRunSummary | null;
  notificationsLoading: boolean;
  notifications: WorkspaceNotification[];
  reportRunScopeFilter: "all" | "workspace" | "project";
  reportRunStatusFilter: "all" | "success" | "failed";
  reportRunExportBusy: string | null;
  reportRunsLoading: boolean;
  reportRuns: RecurringReportRun[];
  reportRunBusyId: string | null;
  canManageWorkspace: boolean;
  onMarkNotificationRead: (notificationId?: string) => Promise<void>;
  onReportRunScopeFilterChange: (value: "all" | "workspace" | "project") => void;
  onReportRunStatusFilterChange: (value: "all" | "success" | "failed") => void;
  onExportReportRuns: (format: "csv" | "md") => Promise<void>;
  onRetryReportRun: (runId: string) => Promise<void>;
};

export const OperationsActivitySurface = memo(function OperationsActivitySurface({
  isActive,
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
  canManageWorkspace,
  onMarkNotificationRead,
  onReportRunScopeFilterChange,
  onReportRunStatusFilterChange,
  onExportReportRuns,
  onRetryReportRun,
}: OperationsActivitySurfaceProps) {
  return (
    <>
      <div
        id="report-history"
        className={`rounded-[22px] border border-slate-200 bg-[#fcfbf8] p-4 ${
          isActive ? "" : "hidden"
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
              onClick={() => void onMarkNotificationRead()}
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
                  {reportRunSummary.workspaceRuns} workspace,{" "}
                  {reportRunSummary.projectRuns} project
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
                  {reportRunSummary.successCount} success,{" "}
                  {reportRunSummary.failedCount} failed
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
                  Slack deliveries, {reportRunSummary.emailRecipientCount} email
                  recipients
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
                  {reportRunSummary.scheduledRuns} scheduled,{" "}
                  {reportRunSummary.manualRuns} manual
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
                        onClick={() => void onMarkNotificationRead(notification.id)}
                        disabled={notificationBusyId === notification.id}
                        className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {notificationBusyId === notification.id
                          ? "Saving..."
                          : "Mark read"}
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
          isActive ? "" : "hidden"
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
                  onReportRunScopeFilterChange(
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
                  onReportRunStatusFilterChange(
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
              onClick={() => void onExportReportRuns("csv")}
              disabled={reportRunExportBusy !== null}
              className="cursor-pointer rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 lg:self-end"
            >
              {reportRunExportBusy === "csv" ? "Exporting..." : "Export CSV"}
            </button>
            <button
              type="button"
              onClick={() => void onExportReportRuns("md")}
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
                  {run.project?.name ? `${run.project.name} - ` : ""}
                  {run.cadence} -{" "}
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
                      onClick={() => void onRetryReportRun(run.id)}
                      disabled={reportRunBusyId !== null || !canManageWorkspace}
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
    </>
  );
});
