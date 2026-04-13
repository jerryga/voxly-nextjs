"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Transcription } from "@/app/dashboard/TranscriptionClient";
import type { AssistantMessage, AssistantScope, ActiveWorkspaceDetails, Project } from "./SessionAssistantRail";
import { SessionSummaryPanel } from "./SessionSummaryPanel";
import { SessionAssistantPanel } from "./SessionAssistantPanel";
import { OnboardingChecklist } from "./OnboardingChecklist";
import { useOnboarding } from "./hooks/useOnboarding";

type ProjectIntelligenceResponse = {
  answer?: string;
  confidenceNote?: string;
  sources?: { fileName: string; excerpt: string }[];
  error?: string;
};

function formatIntelligenceAssistantReply(payload: ProjectIntelligenceResponse): string {
  const parts: string[] = [];
  if (payload.answer?.trim()) parts.push(payload.answer.trim());
  if (payload.confidenceNote?.trim()) parts.push(`Confidence note: ${payload.confidenceNote.trim()}`);
  if (payload.sources?.length) {
    parts.push(
      `Sources:\n${payload.sources
        .slice(0, 4)
        .map((s) => `- ${s.fileName}: ${s.excerpt}`)
        .join("\n")}`,
    );
  }
  return parts.join("\n\n").trim() || "(No reply)";
}

const DEFAULT_MESSAGES: AssistantMessage[] = [
  { role: "assistant", content: "Hi! I can edit these notes or answer questions about them." },
];

type SessionClientProps = {
  transcription: Transcription;
  projects: Project[];
  activeWorkspace: ActiveWorkspaceDetails | null;
  hasDigestConfigured: boolean;
};

export function SessionClient({
  transcription: initialTranscription,
  projects,
  activeWorkspace,
  hasDigestConfigured,
}: SessionClientProps) {
  const [transcription, setTranscription] = useState(initialTranscription);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>(DEFAULT_MESSAGES);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [showDigestUpsell, setShowDigestUpsell] = useState(!hasDigestConfigured);
  const [assistantOpen, setAssistantOpen] = useState(false);

  const onboarding = useOnboarding();

  // Computed once from initial prop — used to trigger warm-start
  const wasAlreadyDoneRef = useRef(initialTranscription.status === "done");
  const wasAlreadyDone = wasAlreadyDoneRef.current;

  const handleAssistantSubmit = useCallback(
    async (input: {
      text: string;
      scope: AssistantScope;
      projectId: string;
      workspaceProjectIds: string[];
    }) => {
      const text = input.text.trim();
      if (!text) return;

      if (input.scope === "transcript" && transcription.status !== "done") {
        setAssistantError("No summary available yet.");
        return;
      }
      if (input.scope === "project" && input.projectId === "all") {
        setAssistantError("Choose a project before asking across recordings.");
        return;
      }

      setAssistantBusy(true);
      setAssistantError(null);

      const nextMessages: AssistantMessage[] = [
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
              : { projectId: input.projectId, question: text };

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
          setAssistantMessages((prev) => [
            ...prev,
            { role: "assistant", content: formatIntelligenceAssistantReply(payload) },
          ]);
          onboarding.markComplete("firstAIPrompt");
          return;
        }

        // Transcript scope
        const summaryPayload = {
          decisions: transcription.decisions ?? [],
          keyPoints: transcription.keyPoints ?? [],
          nextSteps: transcription.nextSteps ?? [],
          actionItems: transcription.actionItems ?? [],
        };

        const [editResp, chatResp] = await Promise.all([
          fetch("/api/assistant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: text, summary: summaryPayload }),
          }).then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) })),
          fetch("/api/assistant/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transcriptionId: transcription.id,
              messages: nextMessages,
              summary: summaryPayload,
            }),
          }).then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) })),
        ]);

        if (!editResp.ok) throw new Error(editResp.data?.error || "Assistant edit failed");
        if (!chatResp.ok) throw new Error(chatResp.data?.error || "Assistant chat failed");

        const updatedSummary = editResp.data?.summary ?? null;
        if (updatedSummary) {
          setTranscription((prev) => ({
            ...prev,
            decisions: updatedSummary.decisions ?? prev.decisions,
            keyPoints: updatedSummary.keyPoints ?? prev.keyPoints,
            nextSteps: updatedSummary.nextSteps ?? prev.nextSteps,
            actionItems: updatedSummary.actionItems ?? prev.actionItems,
          }));
        }

        const assistantReply = chatResp.data?.message ?? "(No reply)";
        setAssistantMessages((prev) => [
          ...prev,
          { role: "assistant", content: assistantReply },
        ]);
        onboarding.markComplete("firstAIPrompt");
      } catch (err) {
        setAssistantError(err instanceof Error ? err.message : "Assistant request failed");
        setAssistantMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, I couldn't update the notes. Please try again." },
        ]);
      } finally {
        setAssistantBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assistantMessages, transcription],
  );

  const handleRefresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/assistant/chat?transcriptionId=${encodeURIComponent(transcription.id)}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { messages?: AssistantMessage[] };
      if (data.messages) {
        setAssistantMessages([...DEFAULT_MESSAGES, ...data.messages]);
      }
    } catch {
      // ignore
    }
  }, [transcription.id]);

  const handleProjectAssign = useCallback(
    async (projectId: string) => {
      try {
        const res = await fetch("/api/transcriptions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: transcription.id, projectId }),
        });
        if (!res.ok) return;
        setTranscription((prev) => ({ ...prev, projectId }));
        onboarding.markComplete("firstProject");
      } catch {
        // ignore
      }
    },
    [transcription.id, onboarding],
  );

  const handleShareCopied = useCallback(() => {
    onboarding.markComplete("firstShare");
  }, [onboarding]);

  const handleProcessingComplete = useCallback((updated: Transcription) => {
    setTranscription(updated);
  }, []);

  // Close bottom sheet on lg+ (no orphaned open state when resizing)
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1024) setAssistantOpen(false);
    }
    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Scroll-lock body when bottom sheet is open
  useEffect(() => {
    if (assistantOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [assistantOpen]);

  const assistantPanel = (
    <SessionAssistantPanel
      transcription={transcription}
      projects={projects}
      activeWorkspace={activeWorkspace}
      assistantMessages={assistantMessages}
      assistantBusy={assistantBusy}
      assistantError={assistantError}
      onSubmit={handleAssistantSubmit}
      onRefresh={handleRefresh}
      onboardingHighlight={
        onboarding.isNew &&
        !onboarding.completedSteps.has("firstAIPrompt")
      }
      wasAlreadyDone={wasAlreadyDone}
    />
  );

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6">
      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-6 lg:items-start">
        {/* Left: summary + content */}
        <div>
          {onboarding.isNew && !onboarding.dismissed && (
            <OnboardingChecklist onboarding={onboarding} />
          )}
          <SessionSummaryPanel
            transcription={transcription}
            projects={projects}
            showDigestUpsell={showDigestUpsell}
            onDigestDismiss={() => setShowDigestUpsell(false)}
            onProjectAssign={handleProjectAssign}
            onShareCopied={handleShareCopied}
            onProcessingComplete={handleProcessingComplete}
            onboarding={onboarding}
          />
        </div>

        {/* Right: assistant — desktop sticky column */}
        <div id="session-assistant" className="hidden lg:block lg:sticky lg:top-8">
          {assistantPanel}
        </div>
      </div>

      {/* ── Mobile / tablet assistant ─────────────────────────────────── */}

      {/* FAB — visible below lg */}
      <button
        type="button"
        onClick={() => setAssistantOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-[#f97316] px-5 py-3 text-sm font-bold text-white shadow-[0_8px_32px_-8px_rgba(249,115,22,0.7)] transition hover:bg-[#ea580c] active:scale-95 lg:hidden"
        aria-label="Open AI assistant"
      >
        <span>Ask AI</span>
        <span className="text-base leading-none">✦</span>
      </button>

      {/* Bottom sheet backdrop */}
      {assistantOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setAssistantOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Bottom sheet drawer */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-[28px] bg-white shadow-[0_-20px_60px_-16px_rgba(15,23,42,0.3)] transition-transform duration-300 ease-out lg:hidden ${
          assistantOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight: "88dvh" }}
        aria-modal="true"
        role="dialog"
        aria-label="AI Assistant"
      >
        {/* Drag handle + close */}
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <div className="mx-auto h-1 w-10 rounded-full bg-slate-300" />
        </div>
        <div className="flex items-center justify-between px-5 pb-2">
          <p className="text-sm font-bold text-slate-900">AI Assistant</p>
          <button
            type="button"
            onClick={() => setAssistantOpen(false)}
            className="cursor-pointer rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-6" id="session-assistant">
          {assistantPanel}
        </div>
      </div>
    </div>
  );
}
