"use client";

import { type FormEvent, type RefObject, memo, useState } from "react";
import type { BillingInfo } from "@/lib/billing-types";
import type {
  ActionItem,
  ActionTask,
  ActiveWorkspaceDetails,
  Project,
  Transcription,
  WorkspaceComment,
} from "./TranscriptionClient";

const builtInTemplates = [
  { id: "default", label: "Default Template (Default)" },
  { id: "brainstorm", label: "Brainstorm Session" },
  { id: "interview", label: "Interview Notes" },
  { id: "lecture", label: "Lecture Notes" },
  { id: "voice-memo", label: "Voice Memo Notes" },
];

export type UploadPanelBodyProps = {
  activeWorkspace: ActiveWorkspaceDetails | null;
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

export const UploadPanelBody = memo(function UploadPanelBody({
  activeWorkspace,
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
  const activeWorkspaceLabel = activeWorkspace
    ? `${activeWorkspace.name}${activeWorkspace.isPersonal ? " (Personal)" : ""}`
    : "the current workspace";

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
        <p className="mb-4 text-xs font-medium text-slate-500">
          Upload destination:{" "}
          <span className="font-semibold text-slate-900">{activeWorkspaceLabel}</span>
        </p>
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
                  placeholder="Group related transcripts inside this workspace."
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
                Upload to {activeWorkspaceLabel} and let Voxly continue processing in the background.
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

export const OverviewUploadSection = memo(function OverviewUploadSection({
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

export type OverviewCurrentRecordingProps = {
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
  detailsAutoOpenToken: number;
  onProcess: (transcriptionId: string, template?: string | null) => void;
  onCopySummary: () => void;
  onStartUpload: () => void;
  onCreateActionTask: (input: {
    title: string;
    priority?: string;
    assignee?: string;
    dueDate?: string;
    sourceActionIndex?: number;
  }) => Promise<ActionTask | null>;
  onUpdateActionTask: (
    taskId: string,
    updates: Partial<Pick<ActionTask, "status" | "assignee" | "dueDate">>,
  ) => Promise<void>;
  onDeleteActionTask: (taskId: string) => Promise<void>;
  taskCommentsById: Record<string, WorkspaceComment[]>;
  taskCommentDrafts: Record<string, string>;
  commentBusyKey: string | null;
  onTaskCommentDraftChange: (taskId: string, value: string) => void;
  onCreateTaskComment: (input: { taskId: string; content: string }) => Promise<void>;
};

export const OverviewCurrentRecording = memo(function OverviewCurrentRecording({
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
  detailsAutoOpenToken,
  onProcess,
  onCopySummary,
  onStartUpload,
  onCreateActionTask,
  onUpdateActionTask,
  onDeleteActionTask,
  taskCommentsById,
  taskCommentDrafts,
  commentBusyKey,
  onTaskCommentDraftChange,
  onCreateTaskComment,
}: OverviewCurrentRecordingProps) {
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const [isDetailsManuallyOpen, setIsDetailsManuallyOpen] = useState(false);
  const [detailsDismissedToken, setDetailsDismissedToken] = useState(0);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskComment, setNewTaskComment] = useState("");
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const isDetailsOpen = Boolean(
    focusedSummary &&
      (isDetailsManuallyOpen || detailsAutoOpenToken > detailsDismissedToken),
  );

  function handleToggleDetails() {
    if (isDetailsOpen) {
      setIsDetailsManuallyOpen(false);
      setDetailsDismissedToken(detailsAutoOpenToken);
      return;
    }

    setIsDetailsManuallyOpen(true);
  }

  return (
    <>
      <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-[0_12px_36px_-28px_rgba(15,23,42,0.18)] sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
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
            {focusedSummaryHiddenByFilters ? (
              <p className="mt-3 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                This selected transcript is hidden by the current filters.
              </p>
            ) : null}
          </div>
          {focusedSummary ? (
            <div className="flex flex-nowrap items-center gap-2 overflow-x-auto lg:overflow-visible lg:justify-end">
              <button
                type="button"
                onClick={handleToggleDetails}
                className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full border border-orange-200 bg-orange-50 px-4 text-xs font-semibold text-orange-800 transition hover:border-orange-300 hover:bg-orange-100"
              >
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
                  <path
                    d="M5 6h10M5 10h10M5 14h6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
                {isDetailsOpen ? "Hide Details" : "Show Details"}
              </button>
              <button
                type="button"
                onClick={() => onProcess(focusedSummary.id, focusedSummary.template)}
                disabled={!canProcessFocusedSummary}
                className={`inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full border border-orange-200 bg-orange-50 px-4 text-xs font-semibold text-orange-800 transition hover:border-orange-300 hover:bg-orange-100 ${
                  isFocusedSummaryProcessing
                    ? "border-orange-200 bg-orange-50 text-orange-700"
                    : ""
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
                  <path
                    d="M15.5 7.5A5.5 5.5 0 0 0 5.7 5.1L4 6.8M4.5 12.5a5.5 5.5 0 0 0 9.8 2.4L16 13.2M4 3.5v3.3h3.3M16 16.5v-3.3h-3.3"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {isFocusedSummaryProcessing
                  ? "Processing..."
                  : focusedSummary.status === "done"
                    ? "Reprocess Recording"
                    : "Process Recording"}
              </button>
              <button
                type="button"
                onClick={onCopySummary}
                className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full border border-orange-200 bg-orange-50 px-4 text-xs font-semibold text-orange-800 transition hover:border-orange-300 hover:bg-orange-100"
              >
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
                  <path
                    d="M7 6.5V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-1.5M4 7h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
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
        {focusedSummary ? (
          <div className="mt-4 flex w-full flex-nowrap items-center gap-2">
            <span className="min-w-fit flex-1 whitespace-nowrap rounded-full border border-slate-200 bg-[#fcfbf8] px-3 py-1 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
              {focusedSummary.status}
            </span>
            {focusedSummary.template ? (
              <span className="min-w-fit flex-1 whitespace-nowrap rounded-full border border-slate-200 bg-[#fcfbf8] px-3 py-1 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                {focusedSummary.template}
              </span>
            ) : null}
            {focusedSummary.projectId ? (
              <span className="min-w-fit flex-1 whitespace-nowrap rounded-full border border-slate-200 bg-[#fcfbf8] px-3 py-1 text-center text-[11px] font-semibold text-slate-600">
                {selectedProjectName}
              </span>
            ) : null}
            <span className="min-w-fit flex-1 whitespace-nowrap rounded-full border border-slate-200 bg-[#fcfbf8] px-3 py-1 text-center text-[11px] font-semibold text-slate-600">
              Updated {new Date(focusedSummary.updatedAt).toLocaleDateString()}
            </span>
          </div>
        ) : null}
        <div className="mt-4 w-full">
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
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_12rem_11rem_auto] lg:items-end">
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
              <label>
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
              <label>
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
                    if (newTaskComment.trim()) {
                      await onCreateTaskComment({
                        taskId: saved.id,
                        content: newTaskComment,
                      });
                    }
                    setNewTaskTitle("");
                    setNewTaskAssignee("");
                    setNewTaskDueDate("");
                    setNewTaskComment("");
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
            <label className="mt-4 block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Comment
              </span>
              <textarea
                value={newTaskComment}
                onChange={(event) => setNewTaskComment(event.target.value)}
                placeholder="Optional context, decision notes, or instructions for this task"
                rows={3}
                className="mt-2 w-full resize-none rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none"
              />
            </label>
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
              currentActionTasks.map((task) => {
                const taskComments = taskCommentsById[task.id] || [];
                const draft = taskCommentDrafts[task.id] || "";
                const commentKey = `task:${task.id}`;
                return (
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
                          <span className="text-slate-500">
                            @{task.assignee?.trim() || "Unassigned"}
                          </span>
                          {task.dueDate ? (
                            <span className="text-slate-500">
                              Due {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          ) : null}
                          <span className="text-slate-400">
                            {taskComments.length} comment{taskComments.length === 1 ? "" : "s"}
                          </span>
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
                    <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                      {taskComments.length ? (
                        <div className="space-y-2">
                          {taskComments.map((comment) => (
                            <div
                              key={comment.id}
                              className="rounded-[18px] border border-slate-200 bg-white px-4 py-3"
                            >
                              <p className="text-sm leading-6 text-slate-700">{comment.content}</p>
                              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                {comment.user?.name?.trim() ||
                                  comment.user?.email ||
                                  "Comment"}{" "}
                                · {new Date(comment.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="text"
                          value={draft}
                          onChange={(event) =>
                            onTaskCommentDraftChange(task.id, event.target.value)
                          }
                          placeholder="Add a comment"
                          className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            void onCreateTaskComment({
                              taskId: task.id,
                              content: draft,
                            })
                          }
                          disabled={!draft.trim() || commentBusyKey === commentKey}
                          className="cursor-pointer rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-semibold text-orange-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {commentBusyKey === commentKey ? "Adding..." : "Add Comment"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
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

export type OverviewSurfaceProps = {
  resultAreaRef: RefObject<HTMLElement | null>;
  isResolving: boolean;
  workspaceSwitching: boolean;
  activeWorkspace: ActiveWorkspaceDetails | null;
  focusedSummary: Transcription | null;
  overviewUploadPanelVersion: number;
  overviewUploadPanelStartExpanded: boolean;
  uploadBodyProps: UploadPanelBodyProps;
  currentRecordingProps: OverviewCurrentRecordingProps;
};

export const OverviewSurface = memo(function OverviewSurface({
  resultAreaRef,
  isResolving,
  workspaceSwitching,
  activeWorkspace,
  focusedSummary,
  overviewUploadPanelVersion,
  overviewUploadPanelStartExpanded,
  uploadBodyProps,
  currentRecordingProps,
}: OverviewSurfaceProps) {
  return (
    <>
      <section
        id="upload"
        className={`border-t border-slate-200/80 px-5 py-5 sm:px-6 ${
          isResolving ? "hidden" : ""
        }`}
      >
        <OverviewUploadSection
          key={`${focusedSummary?.id || "no-focus"}:${overviewUploadPanelVersion}`}
          hasFocusedSummary={!!focusedSummary}
          startExpanded={overviewUploadPanelStartExpanded}
          bodyProps={uploadBodyProps}
        />
      </section>

      <section ref={resultAreaRef} className="space-y-4">
        {isResolving ? (
          <div className="min-h-[420px] rounded-[28px] border border-slate-200 bg-white px-6 py-10 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.2)] sm:px-8">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
              Current Workspace:{" "}
              <span className="font-semibold normal-case tracking-normal text-slate-900">
                {activeWorkspace?.name || "No workspace selected"}
                {activeWorkspace?.isPersonal ? " (Personal)" : ""}
              </span>
            </p>
            <div className="flex h-full min-h-[320px] items-center justify-center">
              <div className="max-w-md text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-orange-200 bg-orange-50">
                  <span className="h-3 w-3 animate-pulse rounded-full bg-orange-500" />
                </div>
                <p className="mt-5 text-lg font-semibold text-slate-950">
                  {workspaceSwitching ? "Switching workspace..." : "Loading overview..."}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Fetching the latest recordings, projects, and workspace context before showing Overview.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <OverviewCurrentRecording
            key={focusedSummary?.id || "no-recording"}
            {...currentRecordingProps}
          />
        )}
      </section>
    </>
  );
});

