"use client";

import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { Transcription } from "@/app/dashboard/TranscriptionClient";
import type { Project } from "./SessionAssistantRail";
import type { OnboardingState } from "./hooks/useOnboarding";
import { WhatNextPanel } from "./WhatNextPanel";
import { DigestUpsellBanner } from "./DigestUpsellBanner";

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee: string | null;
  createdAt: string;
};

type SessionSummaryPanelProps = {
  transcription: Transcription;
  projects: Project[];
  showDigestUpsell: boolean;
  onDigestDismiss: () => void;
  onProjectAssign: (projectId: string) => void;
  onShareCopied: () => void;
  onProcessingComplete: (updated: Transcription) => void;
  onboarding: OnboardingState;
  notionEnabled?: boolean;
  notionBusy?: boolean;
  onPublishToNotion?: () => Promise<void>;
};

export const SessionSummaryPanel = memo(function SessionSummaryPanel({
  transcription,
  projects,
  showDigestUpsell,
  onDigestDismiss,
  onProjectAssign,
  onShareCopied,
  onProcessingComplete,
  notionEnabled = false,
  notionBusy = false,
  onPublishToNotion,
}: SessionSummaryPanelProps) {
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const [processingStageIndex, setProcessingStageIndex] = useState(0);
  const [trackedIndices, setTrackedIndices] = useState<Set<number>>(new Set());
  const [trackingIndex, setTrackingIndex] = useState<number | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newTaskComment, setNewTaskComment] = useState("");
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (transcription.status !== "done") return;
    fetch(`/api/tasks?transcriptionId=${encodeURIComponent(transcription.id)}`)
      .then((r) => r.json())
      .then((data: { tasks?: Task[] }) => {
        if (data.tasks) setTasks(data.tasks);
      })
      .catch(() => {});
  }, [transcription.status, transcription.id]);

  // Initialise from DB — completed flags already persisted on the items
  const [completedSet, setCompletedSet] = useState<Set<number>>(() => {
    const set = new Set<number>();
    transcription.actionItems?.forEach((item, i) => {
      if ((item as { completed?: boolean }).completed) set.add(i);
    });
    return set;
  });

  async function toggleCompleted(index: number) {
    const nextCompleted = new Set(completedSet);
    if (nextCompleted.has(index)) {
      nextCompleted.delete(index);
    } else {
      nextCompleted.add(index);
    }
    setCompletedSet(nextCompleted); // optimistic

    const updatedItems = (transcription.actionItems ?? []).map((item, i) => ({
      ...item,
      completed: nextCompleted.has(i),
    }));

    await fetch("/api/transcriptions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: transcription.id, actionItems: updatedItems }),
    }).catch(() => {
      // revert on failure
      setCompletedSet(completedSet);
    });
  }

  async function createTask(input: {
    title: string;
    assignee?: string;
    comment?: string;
    sourceActionIndex?: number;
  }): Promise<Task> {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcriptionId: transcription.id,
        title: input.title.trim(),
        assignee: input.assignee?.trim() || undefined,
        sourceActionIndex: input.sourceActionIndex,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { task?: Task; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Failed to create task");
    const task = data.task!;
    if (input.comment?.trim()) {
      await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input.comment.trim(), taskId: task.id }),
      }).catch(() => {});
    }
    return task;
  }

  async function toggleTaskStatus(task: Task) {
    const nextStatus = task.status === "done" ? "open" : "done";
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: nextStatus } : t));
    setTogglingTaskId(task.id);
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
    } catch {
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: task.status } : t));
    } finally {
      setTogglingTaskId(null);
    }
  }

  async function deleteTask(task: Task) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id)); // optimistic
    setDeletingTaskId(task.id);
    try {
      await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    } catch {
      setTasks((prev) => [...prev, task]); // revert
    } finally {
      setDeletingTaskId(null);
    }
  }
  const abortRef = useRef<AbortController | null>(null);

  const isDone = transcription.status === "done";
  const isProcessing = transcription.status === "processing" || transcription.status === "uploaded";
  const deferredTranscript = useDeferredValue(transcription.transcript || "");
  const processingStages = useMemo(
    () => [
      { label: "Transcribing audio...", blocks: 1 },
      { label: "Generating summary...", blocks: 3 },
      { label: "Extracting action items...", blocks: 8 },
      { label: "Done", blocks: 10 },
    ],
    [],
  );
  const displayedProcessingStageIndex = isDone
    ? processingStages.length - 1
    : processingStageIndex;

  useEffect(() => {
    if (!isProcessing) {
      return;
    }

    const timers = [
      window.setTimeout(() => setProcessingStageIndex(0), 0),
      window.setTimeout(() => setProcessingStageIndex(1), 1800),
      window.setTimeout(() => setProcessingStageIndex(2), 4200),
    ];

    return () => {
      timers.forEach(window.clearTimeout);
    };
  }, [isProcessing]);

  // Poll for completion while status is not done
  useEffect(() => {
    if (isDone) return;

    const controller = new AbortController();
    abortRef.current = controller;

    function poll(delayMs: number) {
      if (controller.signal.aborted) return;
      setTimeout(async () => {
        if (controller.signal.aborted) return;
        try {
          const res = await fetch(
            `/api/transcriptions?id=${encodeURIComponent(transcription.id)}&allWorkspaces=true`,
            { signal: controller.signal },
          );
          if (!res.ok) return;
          const data = (await res.json()) as { items?: Transcription[] };
          const updated = data.items?.[0];
          if (!updated) return;
          if (updated.status === "done") {
            controller.abort();
            onProcessingComplete(updated);
          } else {
            // backoff: cap at 8s
            poll(Math.min(delayMs * 1.5, 8000));
          }
        } catch {
          if (!controller.signal.aborted) {
            poll(Math.min(delayMs * 1.5, 8000));
          }
        }
      }, delayMs);
    }

    poll(4000);

    return () => {
      controller.abort();
    };
  }, [isDone, transcription.id, onProcessingComplete]);

  const TEMPLATE_LABELS: Record<string, string> = {
    interview: "Interview",
    brainstorm: "Brainstorm",
    sales_call: "Sales Call",
    sales: "Sales Call",
    "1on1": "1-on-1",
    one_on_one: "1-on-1",
    lecture: "Lecture",
    "voice-memo": "Voice Memo",
    default: "General",
  };

  const templateLabel = transcription.template
    ? (TEMPLATE_LABELS[transcription.template] ?? transcription.template)
    : null;

  const durationLabel = transcription.duration
    ? formatDuration(transcription.duration)
    : null;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {templateLabel && (
            <span className="rounded-full border border-orange-200 bg-[#fff4ec] px-2.5 py-0.5 text-[11px] font-semibold text-orange-700">
              {templateLabel}
            </span>
          )}
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              isDone
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {isDone ? "Done" : "Processing"}
          </span>
          {durationLabel && (
            <span className="text-[11px] text-slate-400">{durationLabel}</span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-slate-900 leading-tight">
          {transcription.fileName}
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          {new Date(transcription.createdAt).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      {isProcessing && (
        <ProcessingProgressPanel
          stages={processingStages}
          activeStageIndex={displayedProcessingStageIndex}
        />
      )}

      {isDone && (
        <>
          {transcription.keyPoints && transcription.keyPoints.length > 0 && (
            <Section title="Key Points" revealDelayMs={0}>
              <ul className="space-y-2">
                {transcription.keyPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-orange-400" />
                    {point}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {transcription.decisions && transcription.decisions.length > 0 && (
            <Section title="Decisions" revealDelayMs={80}>
              <ul className="space-y-2">
                {transcription.decisions.map((decision, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-1 text-slate-400">→</span>
                    {decision}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {transcription.nextSteps && transcription.nextSteps.length > 0 && (
            <Section title="Next Steps" revealDelayMs={140}>
              <ul className="space-y-2">
                {transcription.nextSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-1 text-slate-400">☐</span>
                    {step}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {transcription.actionItems && transcription.actionItems.length > 0 && (
            <Section title="Action Items" revealDelayMs={200}>
              <ul className="space-y-2">
                {transcription.actionItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                    <button
                      type="button"
                      onClick={() => void toggleCompleted(i)}
                      aria-label={completedSet.has(i) ? "Mark incomplete" : "Mark complete"}
                      className={`mt-0.5 flex-shrink-0 h-4 w-4 rounded border transition-colors cursor-pointer ${
                        completedSet.has(i)
                          ? "border-emerald-500 bg-emerald-500"
                          : "border-slate-300 bg-white hover:border-emerald-400"
                      }`}
                    >
                      {completedSet.has(i) && (
                        <svg viewBox="0 0 10 8" fill="none" className="h-full w-full p-[2px]">
                          <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <span className={`flex-1 transition-colors ${completedSet.has(i) ? "line-through text-slate-400" : ""}`}>
                      {item.text}
                    </span>
                    {item.assignee && (
                      <span className="text-xs text-slate-400">{item.assignee}</span>
                    )}
                    {item.priority && item.priority !== "medium" && (
                      <span
                        className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                          item.priority === "high"
                            ? "bg-red-50 text-red-600"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {item.priority}
                      </span>
                    )}
                    {trackedIndices.has(i) ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Tracked
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={trackingIndex === i}
                        onClick={async () => {
                          setTrackingIndex(i);
                          try {
                            const task = await createTask({
                              title: item.text,
                              assignee: item.assignee ?? undefined,
                              sourceActionIndex: i,
                            });
                            setTrackedIndices((prev) => new Set([...prev, i]));
                            setTasks((prev) => [...prev, task]);
                          } catch {
                            // silently ignore — user can retry
                          } finally {
                            setTrackingIndex(null);
                          }
                        }}
                        className="cursor-pointer rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 transition hover:border-orange-300 hover:bg-[#fff4ec] hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {trackingIndex === i ? "..." : "Track"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>

            </Section>
          )}

          <Section title="Tasks" revealDelayMs={220}>
            {/* ── Add task form ── */}
            <div className="mb-5 rounded-[16px] border border-slate-200 bg-[#fafaf7] p-4">
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                New Task
              </p>
              {/* Title */}
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
              {/* Assignee */}
              <input
                type="text"
                value={newTaskAssignee}
                onChange={(e) => setNewTaskAssignee(e.target.value)}
                placeholder="Assignee (optional)"
                className="mt-2 w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
              {/* Comment textarea */}
              <textarea
                value={newTaskComment}
                onChange={(e) => setNewTaskComment(e.target.value)}
                placeholder="Add a comment or note… (optional)"
                rows={3}
                className="mt-2 w-full resize-none rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
              {/* Footer row */}
              <div className="mt-3 flex items-center justify-between">
                {taskError ? (
                  <p className="text-[11px] text-red-600">{taskError}</p>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  disabled={isAddingTask || !newTaskTitle.trim()}
                  onClick={async () => {
                    if (!newTaskTitle.trim()) return;
                    setIsAddingTask(true);
                    setTaskError(null);
                    try {
                      const task = await createTask({ title: newTaskTitle, assignee: newTaskAssignee, comment: newTaskComment });
                      setTasks((prev) => [...prev, task]);
                      setNewTaskTitle("");
                      setNewTaskAssignee("");
                      setNewTaskComment("");
                    } catch (err) {
                      setTaskError(err instanceof Error ? err.message : "Failed to create task");
                    } finally {
                      setIsAddingTask(false);
                    }
                  }}
                  className="cursor-pointer rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isAddingTask ? "Adding…" : "Add Task"}
                </button>
              </div>
            </div>

            {/* ── Task list ── */}
            {tasks.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {tasks.map((task) => {
                  const taskDone = task.status === "done";
                  const isConfirming = confirmDeleteId === task.id;
                  return (
                    <li key={task.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => void toggleTaskStatus(task)}
                        disabled={togglingTaskId === task.id}
                        aria-label={taskDone ? "Mark open" : "Mark done"}
                        className={`mt-0.5 flex-shrink-0 h-4 w-4 rounded border transition-colors cursor-pointer disabled:opacity-50 ${
                          taskDone
                            ? "border-emerald-500 bg-emerald-500"
                            : "border-slate-300 bg-white hover:border-emerald-400"
                        }`}
                      >
                        {taskDone && (
                          <svg viewBox="0 0 10 8" fill="none" className="h-full w-full p-[2px]">
                            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${taskDone ? "line-through text-slate-400" : "text-slate-800"}`}>
                          {task.title}
                        </p>
                        {(task.assignee || (task.priority && task.priority !== "MEDIUM")) && (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {task.assignee && (
                              <span className="text-[11px] text-slate-400">{task.assignee}</span>
                            )}
                            {task.priority && task.priority !== "MEDIUM" && (
                              <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                                task.priority === "HIGH" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"
                              }`}>
                                {task.priority.toLowerCase()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Delete / confirm */}
                      {isConfirming ? (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[11px] text-slate-500">Delete?</span>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteId(null);
                              void deleteTask(task);
                            }}
                            disabled={deletingTaskId === task.id}
                            className="cursor-pointer rounded-full bg-red-500 px-2.5 py-0.5 text-[10px] font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="cursor-pointer rounded-full border border-slate-200 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(task.id)}
                          disabled={deletingTaskId === task.id}
                          aria-label="Delete task"
                          className="mt-0.5 flex-shrink-0 cursor-pointer rounded-full p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <svg viewBox="0 0 14 14" fill="none" className="h-3 w-3">
                            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {tasks.length === 0 && (
              <p className="text-xs text-slate-400">No tasks yet. Add one above.</p>
            )}
          </Section>

          {transcription.transcript && (
            <Section title="Transcript" revealDelayMs={260}>
              <button
                type="button"
                onClick={() => setTranscriptExpanded((v) => !v)}
                className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-700 transition"
              >
                {transcriptExpanded ? "Hide transcript ▲" : "Show transcript ▼"}
              </button>
              {transcriptExpanded && (
                <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">
                  {deferredTranscript}
                </p>
              )}
            </Section>
          )}

          <WhatNextPanel
            projects={projects}
            onProjectAssign={onProjectAssign}
            onShareCopied={onShareCopied}
            notionEnabled={notionEnabled}
            notionBusy={notionBusy}
            onPublishToNotion={onPublishToNotion}
          />

          {showDigestUpsell && <DigestUpsellBanner onDismiss={onDigestDismiss} />}
        </>
      )}
    </div>
  );
});

function ProcessingProgressPanel({
  stages,
  activeStageIndex,
}: {
  stages: Array<{ label: string; blocks: number }>;
  activeStageIndex: number;
}) {
  const activeStage = stages[activeStageIndex] || stages[0];

  return (
    <div className="rounded-[22px] border border-orange-200 bg-[#fff7ed] px-5 py-5 shadow-[0_18px_54px_-38px_rgba(249,115,22,0.7)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-700">
            Processing
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {activeStage.label}
          </p>
        </div>
        <div className="flex items-center gap-1" aria-hidden="true">
          {Array.from({ length: 10 }).map((_, index) => (
            <span
              key={index}
              className={`h-2.5 w-5 rounded-full transition-all duration-300 ${
                index < activeStage.blocks ? "bg-orange-500" : "bg-orange-100"
              }`}
            />
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {stages.slice(0, 3).map((stage, index) => {
          const reached = activeStageIndex >= index;
          return (
            <div
              key={stage.label}
              className={`rounded-[16px] border px-3 py-3 transition ${
                reached
                  ? "border-orange-200 bg-white text-slate-800"
                  : "border-orange-100 bg-orange-50/60 text-orange-700/70"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    reached ? "bg-orange-500" : "bg-orange-200"
                  }`}
                />
                <span className="text-xs font-semibold">{stage.label}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 rounded-[18px] border border-dashed border-orange-200 bg-white/70 px-4 py-3">
        <p className="text-xs font-semibold text-slate-700">
          3 action items found — loading details
        </p>
        <div className="mt-3 space-y-2">
          {[0, 1, 2].map((item) => (
            <div key={item} className="flex items-center gap-3">
              <span className="h-4 w-4 rounded border border-slate-200 bg-slate-100" />
              <span className="h-2.5 flex-1 animate-pulse rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-orange-700">
        You can leave this page open. Voxly will reveal each section as soon as
        the final result is ready.
      </p>
    </div>
  );
}

function Section({
  title,
  children,
  revealDelayMs = 0,
}: {
  title: string;
  children: React.ReactNode;
  revealDelayMs?: number;
}) {
  return (
    <div
      className="voxly-section-reveal mb-6 rounded-[20px] border border-slate-200 bg-white p-5"
      style={{ animationDelay: `${revealDelayMs}ms` }}
    >
      <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">
        {title}
      </p>
      {children}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}
