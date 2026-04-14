"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `callback` whenever the browser tab becomes visible again.
 * Keeps the callback ref current so callers don't need useCallback.
 *
 * Usage:
 *   useFocusRevalidate(() => void loadTasks());
 */
export function useFocusRevalidate(callback: () => void) {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    function handleVisibilityChange() {
      if (!document.hidden) callbackRef.current();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
