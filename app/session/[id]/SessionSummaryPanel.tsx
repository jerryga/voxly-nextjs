"use client";

import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { Transcription } from "@/app/dashboard/TranscriptionClient";
import type { Project } from "./SessionAssistantRail";
import type { OnboardingState } from "./hooks/useOnboarding";
import { WhatNextPanel } from "./WhatNextPanel";
import { DigestUpsellBanner } from "./DigestUpsellBanner";

type SessionSummaryPanelProps = {
  transcription: Transcription;
  projects: Project[];
  showDigestUpsell: boolean;
  onDigestDismiss: () => void;
  onProjectAssign: (projectId: string) => void;
  onShareCopied: () => void;
  onProcessingComplete: (updated: Transcription) => void;
  onboarding: OnboardingState;
};

export const SessionSummaryPanel = memo(function SessionSummaryPanel({
  transcription,
  projects,
  showDigestUpsell,
  onDigestDismiss,
  onProjectAssign,
  onShareCopied,
  onProcessingComplete,
}: SessionSummaryPanelProps) {
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const [processingStageIndex, setProcessingStageIndex] = useState(0);
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
          const res = await fetch(`/api/transcriptions/${transcription.id}`, {
            signal: controller.signal,
          });
          if (!res.ok) return;
          const data = (await res.json()) as { transcription?: Transcription };
          const updated = data.transcription;
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
                    <span className="mt-0.5 flex-shrink-0 rounded border border-slate-300 h-4 w-4" />
                    <span className="flex-1">{item.text}</span>
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
                  </li>
                ))}
              </ul>
            </Section>
          )}

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
