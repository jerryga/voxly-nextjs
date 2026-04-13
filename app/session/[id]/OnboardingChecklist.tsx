"use client";

import { useEffect } from "react";
import type { OnboardingState } from "./hooks/useOnboarding";

type OnboardingChecklistProps = {
  onboarding: OnboardingState;
};

type StepKey = "firstSession" | "firstAIPrompt" | "firstProject" | "firstShare";

const STEPS: { key: StepKey; label: string }[] = [
  { key: "firstSession", label: "Open your first session" },
  { key: "firstAIPrompt", label: "Ask the AI a question" },
  { key: "firstProject", label: "Add recording to a project" },
  { key: "firstShare", label: "Share a recording" },
];

export function OnboardingChecklist({ onboarding }: OnboardingChecklistProps) {
  const { completedSteps, dismissed, dismiss } = onboarding;

  const allDone = STEPS.every(({ key }) => completedSteps.has(key));

  // Auto-dismiss 2.5s after all steps complete
  useEffect(() => {
    if (!allDone) return;
    const timer = setTimeout(() => dismiss(), 2500);
    return () => clearTimeout(timer);
  }, [allDone, dismiss]);

  if (dismissed) return null;

  return (
    <div className="mb-6 rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-orange-700">
            Getting started
          </p>
          <h2 className="mt-1 text-base font-bold text-slate-900">
            {allDone ? "You're all set!" : "Welcome to Voxly"}
          </h2>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss checklist"
          className="cursor-pointer text-xs text-slate-400 transition hover:text-slate-600"
        >
          Dismiss
        </button>
      </div>

      {allDone ? (
        <p className="mt-3 text-sm text-slate-500">
          You've completed all the basics. Enjoy Voxly!
        </p>
      ) : (
        <ol className="mt-4 space-y-2">
          {STEPS.map(({ key, label }, index) => {
            const done = completedSteps.has(key);
            return (
              <li key={key} className="flex items-center gap-3">
                <span
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    done
                      ? "bg-emerald-500 text-white"
                      : "border border-slate-300 bg-white text-slate-400"
                  }`}
                >
                  {done ? "✓" : index + 1}
                </span>
                <span
                  className={`text-sm ${done ? "text-slate-400 line-through" : "text-slate-700"}`}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
