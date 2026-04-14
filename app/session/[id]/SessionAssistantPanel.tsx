"use client";

import { useEffect, useRef, useState } from "react";
import type { Transcription } from "@/app/dashboard/TranscriptionClient";
import type { AssistantMessage, AssistantScope, Project, ActiveWorkspaceDetails } from "./SessionAssistantRail";
import { SessionAssistantRail } from "./SessionAssistantRail";
import { useProactiveSuggestions } from "./hooks/useProactiveSuggestions";

type SessionAssistantPanelProps = {
  transcription: Transcription;
  projects: Project[];
  activeWorkspace: ActiveWorkspaceDetails | null;
  assistantMessages: AssistantMessage[];
  assistantBusy: boolean;
  assistantError: string | null;
  onSubmit: (input: {
    text: string;
    scope: AssistantScope;
    projectId: string;
    workspaceProjectIds: string[];
  }) => void;
  onRefresh: () => void;
  onboardingHighlight: boolean;
  wasAlreadyDone: boolean;
};

export function SessionAssistantPanel({
  transcription,
  projects,
  activeWorkspace,
  assistantMessages,
  assistantBusy,
  assistantError,
  onSubmit,
  onRefresh,
  onboardingHighlight,
  wasAlreadyDone,
}: SessionAssistantPanelProps) {
  const suggestions = useProactiveSuggestions(transcription);
  const [historyLoading, setHistoryLoading] = useState(true);
  const warmStartFiredRef = useRef(false);

  // Load chat history on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/assistant/chat?transcriptionId=${encodeURIComponent(transcription.id)}`,
        );
        if (!res.ok) return;
        // History is managed in SessionClient via the messages prop;
        // here we just signal that loading is complete.
      } catch {
        // ignore
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [transcription.id]);

  // Warm-start: fire one auto-prompt when the session was already done
  useEffect(() => {
    if (!wasAlreadyDone) return;
    if (historyLoading) return;
    if (assistantMessages.length > 1) return;
    if (warmStartFiredRef.current) return;
    warmStartFiredRef.current = true;

    const timer = setTimeout(() => {
      onSubmit({
        text: "Give me a quick 3-bullet summary of this recording",
        scope: "transcript",
        projectId: "all",
        workspaceProjectIds: [],
      });
    }, 600);

    return () => clearTimeout(timer);
  }, [wasAlreadyDone, historyLoading, assistantMessages.length, onSubmit]);

  const railContent = (
    <SessionAssistantRail
      projects={projects}
      activeWorkspace={activeWorkspace}
      assistantBusy={assistantBusy}
      assistantRefreshing={false}
      assistantHistoryLoading={historyLoading}
      assistantError={assistantError}
      assistantMessages={assistantMessages}
      hasProcessedSummary={transcription.status === "done"}
      initialScope="transcript"
      initialProjectId="all"
      initialWorkspaceProjectIds={[]}
      suggestions={suggestions}
      onRefresh={onRefresh}
      onSubmit={onSubmit}
    />
  );

  if (onboardingHighlight) {
    return (
      <div className="h-full ring-2 ring-orange-400 ring-offset-4 rounded-[28px]">
        {railContent}
      </div>
    );
  }

  return <div className="h-full">{railContent}</div>;
}
