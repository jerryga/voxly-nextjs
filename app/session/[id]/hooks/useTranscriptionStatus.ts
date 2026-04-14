"use client";

import { useEffect, useRef } from "react";
import type { Transcription } from "@/app/dashboard/TranscriptionClient";

/**
 * Subscribes to server-sent events for transcription processing status.
 * Replaces the recursive-setTimeout polling pattern.
 *
 * - Opens an EventSource to /api/transcriptions/[id]/status-stream
 * - Calls onComplete once when status becomes "done" or "error"
 * - Closes the connection automatically; cleans up on unmount
 * - No-op when isDone is true (nothing to wait for)
 */
export function useTranscriptionStatus(
  transcriptionId: string,
  isDone: boolean,
  onComplete: (updated: Transcription) => void,
) {
  // Keep a stable ref to onComplete so the EventSource handler is never stale
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    if (isDone) return;

    const es = new EventSource(
      `/api/transcriptions/${encodeURIComponent(transcriptionId)}/status-stream`,
    );

    es.onmessage = (event: MessageEvent<string>) => {
      let data: Partial<Transcription> & { status?: string; error?: string };
      try {
        data = JSON.parse(event.data) as typeof data;
      } catch {
        return;
      }

      if (data.error) {
        es.close();
        return;
      }

      if (data.status === "done" || data.status === "error") {
        es.close();
        onCompleteRef.current(data as Transcription);
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects on network errors — no manual retry needed.
      // The server closes the stream on done/error, which produces a final error
      // event; at that point the status has already been handled via onmessage.
    };

    return () => {
      es.close();
    };
  }, [transcriptionId, isDone]);
}
