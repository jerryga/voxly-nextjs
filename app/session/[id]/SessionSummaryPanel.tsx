"use client";

import { memo, useEffect, useRef, useState } from "react";
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
  onboarding: _onboarding,
}: SessionSummaryPanelProps) {
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const isDone = transcription.status === "done";
  const isProcessing = transcription.status === "processing" || transcription.status === "uploaded";

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

      {/* Processing state */}
      {isProcessing && (
        <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-amber-400" />
            <p className="text-sm font-semibold text-amber-800">
              Processing your recording…
            </p>
          </div>
          <p className="mt-1.5 text-xs text-amber-700 pl-6">
            This usually takes under a minute. The page will update automatically.
          </p>
        </div>
      )}

      {/* Content — shown when done */}
      {isDone && (
        <>
          {/* Key Points */}
          {transcription.keyPoints && transcription.keyPoints.length > 0 && (
            <Section title="Key Points">
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

          {/* Decisions */}
          {transcription.decisions && transcription.decisions.length > 0 && (
            <Section title="Decisions">
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

          {/* Next Steps */}
          {transcription.nextSteps && transcription.nextSteps.length > 0 && (
            <Section title="Next Steps">
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

          {/* Action Items */}
          {transcription.actionItems && transcription.actionItems.length > 0 && (
            <Section title="Action Items">
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

          {/* Transcript (collapsible) */}
          {transcription.transcript && (
            <Section title="Transcript">
              <button
                type="button"
                onClick={() => setTranscriptExpanded((v) => !v)}
                className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-700 transition"
              >
                {transcriptExpanded ? "Hide transcript ▲" : "Show transcript ▼"}
              </button>
              {transcriptExpanded && (
                <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">
                  {transcription.transcript}
                </p>
              )}
            </Section>
          )}

          {/* What's Next */}
          <WhatNextPanel
            projects={projects}
            onProjectAssign={onProjectAssign}
            onShareCopied={onShareCopied}
          />

          {/* Digest upsell */}
          {showDigestUpsell && <DigestUpsellBanner onDismiss={onDigestDismiss} />}
        </>
      )}
    </div>
  );
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-[20px] border border-slate-200 bg-white p-5">
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
