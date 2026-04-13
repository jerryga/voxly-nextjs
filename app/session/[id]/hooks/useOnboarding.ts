"use client";

import { useCallback, useEffect, useState } from "react";

const KEYS = {
  firstSession: "voxly:onboarding:firstSession",
  firstAIPrompt: "voxly:onboarding:firstAIPrompt",
  firstProject: "voxly:onboarding:firstProject",
  firstShare: "voxly:onboarding:firstShare",
  dismissed: "voxly:onboarding:dismissed",
} as const;

type OnboardingKey = keyof Omit<typeof KEYS, "dismissed">;

export type OnboardingState = {
  /** True only on the user's very first session view (localStorage-based). */
  isNew: boolean;
  /** Set of step keys the user has completed. */
  completedSteps: Set<OnboardingKey>;
  /** True once the user dismisses the checklist (or it auto-dismisses). */
  dismissed: boolean;
  markComplete: (step: OnboardingKey) => void;
  dismiss: () => void;
};

function readKey(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function writeKey(key: string): void {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Silently ignore private-browsing quota errors
  }
}

export function useOnboarding(): OnboardingState {
  const [isNew, setIsNew] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<OnboardingKey>>(new Set());
  const [dismissed, setDismissed] = useState(false);

  // Read localStorage only on the client (SSR-safe)
  useEffect(() => {
    const alreadySeen = readKey(KEYS.firstSession);
    const alreadyDismissed = readKey(KEYS.dismissed);

    if (!alreadySeen) {
      // First-ever session view — write the key and show onboarding
      writeKey(KEYS.firstSession);
      setIsNew(true);
    }

    if (alreadyDismissed) {
      setDismissed(true);
    }

    // Hydrate any steps already completed in past sessions
    const completed = new Set<OnboardingKey>();
    for (const step of Object.keys(KEYS) as OnboardingKey[]) {
      if (step === ("dismissed" as string)) continue;
      if (readKey(KEYS[step])) completed.add(step);
    }
    setCompletedSteps(completed);
  }, []);

  const markComplete = useCallback((step: OnboardingKey) => {
    writeKey(KEYS[step]);
    setCompletedSteps((prev) => {
      if (prev.has(step)) return prev;
      return new Set([...prev, step]);
    });
  }, []);

  const dismiss = useCallback(() => {
    writeKey(KEYS.dismissed);
    setDismissed(true);
  }, []);

  // Auto-mark step 1 complete whenever onboarding is active
  useEffect(() => {
    if (isNew) markComplete("firstSession");
  }, [isNew, markComplete]);

  return { isNew, completedSteps, dismissed, markComplete, dismiss };
}
