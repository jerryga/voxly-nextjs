"use client";

import { useMemo } from "react";
import type { Transcription } from "@/app/dashboard/TranscriptionClient";

export type AssistantScope = "transcript" | "project" | "workspace";

const PROJECT_SUGGESTIONS = [
  "What themes are recurring across this project?",
  "Summarize the key decisions across these recordings",
  "What open risks should we watch?",
  "List the main follow-ups still unresolved",
];

const WORKSPACE_SUGGESTIONS = [
  "What themes came up across the workspace?",
  "Which projects mention the most risks?",
  "Summarize open follow-ups across recordings",
  "What patterns are emerging this week?",
];

const FALLBACK_TRANSCRIPT = [
  "Draft a follow-up email from these notes",
  "What follow-up actions are still unresolved?",
  "Summarize this in 3 bullets",
  "Who owns each action item?",
];

/**
 * Generates context-aware assistant suggestions derived from the actual
 * content of the transcription rather than static generic prompts.
 */
export function useProactiveSuggestions(
  transcription: Transcription,
): Record<AssistantScope, string[]> {
  return useMemo(() => {
    const prompts: string[] = [];
    const actionCount = transcription.actionItems?.length ?? 0;
    const durationMinutes = (transcription.duration ?? 0) / 60;
    const template = transcription.template ?? "default";
    const decisionCount = transcription.decisions?.length ?? 0;
    const keyPointCount = transcription.keyPoints?.length ?? 0;

    // Volume signals
    if (actionCount >= 5) {
      prompts.push("Who should own each action item?");
    } else if (actionCount >= 2) {
      prompts.push("Draft a message to each action item owner");
    }

    // Duration signals
    if (durationMinutes > 45) {
      prompts.push("What were the top 3 decisions made?");
    } else if (durationMinutes > 20) {
      prompts.push("Summarize the key decisions in one paragraph");
    }

    // Template-specific signals
    if (template === "interview") {
      prompts.push("What are the candidate's strongest signals?");
      prompts.push("Draft a hiring recommendation from these notes");
    } else if (template === "brainstorm") {
      prompts.push("Which ideas have the highest potential?");
      prompts.push("Group these ideas into themes");
    } else if (template === "sales_call" || template === "sales") {
      prompts.push("What objections came up and how were they handled?");
      prompts.push("What next steps did the prospect agree to?");
    } else if (template === "1on1" || template === "one_on_one") {
      prompts.push("What are the main coaching points from this conversation?");
      prompts.push("Summarize the action items by owner");
    }

    // Content structure signals
    if (decisionCount > 0 && !prompts.some((p) => p.includes("decision"))) {
      prompts.push("Summarize the decisions and who owns them");
    }
    if (keyPointCount > 3 && prompts.length < 2) {
      prompts.push("What are the 3 most important takeaways?");
    }

    // Fill to 3 with universal fallbacks
    const fallbacks = [...FALLBACK_TRANSCRIPT];
    while (prompts.length < 3) {
      const next = fallbacks.shift();
      if (!next) break;
      if (!prompts.includes(next)) prompts.push(next);
    }

    return {
      transcript: prompts.slice(0, 4),
      project: PROJECT_SUGGESTIONS,
      workspace: WORKSPACE_SUGGESTIONS,
    };
  }, [
    transcription.actionItems?.length,
    transcription.duration,
    transcription.template,
    transcription.decisions?.length,
    transcription.keyPoints?.length,
  ]);
}
