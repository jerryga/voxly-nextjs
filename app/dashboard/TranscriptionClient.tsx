"use client";

import { useEffect, useMemo, useState, useId, useRef } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { BillingInfo, BillingResponse } from "@/lib/billing-types";

type ActionItem = {
  text: string;
  priority?: string;
  assignee?: string;
};

type Transcription = {
  id: string;
  fileName: string;
  status: string;
  template?: string | null;
  createdAt: string;
  duration?: number | null;
  transcript?: string | null;
  decisions?: string[];
  keyPoints?: string[];
  nextSteps?: string[];
  actionItems?: ActionItem[];
};

type ApiResponse = {
  ok?: boolean;
  items?: Transcription[];
  error?: string;
};

type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

const defaultAssistantMessages: AssistantMessage[] = [
  {
    role: "assistant",
    content: "Hi! I can edit these notes or answer questions about them.",
  },
];

export function TranscriptionClient() {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const assistantInputRef = useRef<HTMLInputElement | null>(null);
  const resultAreaRef = useRef<HTMLElement | null>(null);
  const tipsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [items, setItems] = useState<Transcription[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [estimatedDurationSeconds, setEstimatedDurationSeconds] = useState<
    number | null
  >(null);
  const [durationLoading, setDurationLoading] = useState(false);
  const [uploadTemplate, setUploadTemplate] = useState("default");
  const [testDataLoading, setTestDataLoading] = useState(false);
  const [testDataStatus, setTestDataStatus] = useState<string | null>(null);
  const [expandedTranscripts, setExpandedTranscripts] = useState<
    Record<string, boolean>
  >({});
  const [processingIds, setProcessingIds] = useState<Record<string, boolean>>(
    {},
  );
  const [focusedSummaryId, setFocusedSummaryId] = useState<string | null>(null);
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantRefreshing, setAssistantRefreshing] = useState(false);
  const [assistantHistoryLoading, setAssistantHistoryLoading] = useState(false);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [assistantSummary, setAssistantSummary] = useState<{
    decisions?: string[];
    keyPoints?: string[];
    nextSteps?: string[];
    actionItems?: ActionItem[];
  } | null>(null);
  const [assistantMessages, setAssistantMessages] =
    useState<AssistantMessage[]>(defaultAssistantMessages);
  const [completionTip, setCompletionTip] = useState<string | null>(null);

  const templates = [
    { id: "default", label: "Default Template (Default)" },
    { id: "brainstorm", label: "Brainstorm Session" },
    { id: "interview_notes", label: "Interview Notes" },
    { id: "lecture_notes", label: "Lecture Notes" },
    { id: "voice_memo", label: "Voice Memo Notes" },
  ];
  const isDev = process.env.NODE_ENV !== "production";

  const sortedItems = useMemo(() => {
    return [...items].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [items]);

  const latestSummary = useMemo(() => {
    return sortedItems.find((item) => item.status === "done") || null;
  }, [sortedItems]);
  const focusedSummary = useMemo(() => {
    if (!focusedSummaryId) {
      return latestSummary;
    }

    return sortedItems.find((item) => item.id === focusedSummaryId) || latestSummary;
  }, [focusedSummaryId, latestSummary, sortedItems]);
  const displaySummary = assistantSummary || focusedSummary;
  const activeTranscriptionId = focusedSummary?.id || null;
  const hasProcessedSummary = focusedSummary?.status === "done";
  const estimatedCredits =
    estimatedDurationSeconds && estimatedDurationSeconds > 0
      ? Math.max(1, Math.ceil(estimatedDurationSeconds / 60))
      : null;
  const hasEnoughEstimatedCredits =
    !estimatedCredits || !billing
      ? true
      : billing.creditsRemaining >= estimatedCredits;

  async function readMediaDuration(fileToRead: File) {
    setDurationLoading(true);
    try {
      const objectUrl = URL.createObjectURL(fileToRead);
      const media = document.createElement(
        fileToRead.type.startsWith("video/") ? "video" : "audio",
      );
      media.preload = "metadata";

      const duration = await new Promise<number | null>((resolve) => {
        const cleanup = () => {
          URL.revokeObjectURL(objectUrl);
          media.removeAttribute("src");
          media.load();
        };

        media.onloadedmetadata = () => {
          const nextDuration =
            Number.isFinite(media.duration) && media.duration > 0
              ? media.duration
              : null;
          cleanup();
          resolve(nextDuration);
        };

        media.onerror = () => {
          cleanup();
          resolve(null);
        };

        media.src = objectUrl;
      });

      setEstimatedDurationSeconds(duration);
    } finally {
      setDurationLoading(false);
    }
  }

  async function loadItems(options?: { showLoading?: boolean }) {
    const showLoading = options?.showLoading ?? true;
    if (showLoading) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetch("/api/transcriptions");
      const payload = (await res.json()) as ApiResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load transcriptions");
      }
      const nextItems = payload.items || [];
      setItems(nextItems);
      return nextItems;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
      return null;
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }

  async function loadBilling() {
    setBillingLoading(true);
    try {
      const res = await fetch("/api/billing/subscription");
      const payload = (await res.json()) as BillingResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load billing");
      }

      setBilling(payload.billing || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load billing");
    } finally {
      setBillingLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
    void loadBilling();
  }, []);

  useEffect(() => {
    if (!focusedSummaryId || !focusedSummary || focusedSummary.status !== "done") {
      return;
    }

    resultAreaRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [focusedSummary, focusedSummaryId]);

  useEffect(() => {
    return () => {
      if (tipsTimeoutRef.current) {
        clearTimeout(tipsTimeoutRef.current);
      }
    };
  }, []);

  function showCompletionTip(message: string) {
    setCompletionTip(message);

    if (tipsTimeoutRef.current) {
      clearTimeout(tipsTimeoutRef.current);
    }

    tipsTimeoutRef.current = setTimeout(() => {
      setCompletionTip(null);
      tipsTimeoutRef.current = null;
    }, 4500);
  }

  async function loadAssistantMessages(transcriptionId: string) {
    setAssistantHistoryLoading(true);
    setAssistantError(null);

    try {
      const res = await fetch(
        `/api/assistant/chat?transcriptionId=${encodeURIComponent(transcriptionId)}`,
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load assistant history");
      }

      const nextMessages = Array.isArray(payload?.messages)
        ? (payload.messages as AssistantMessage[])
        : [];
      setAssistantMessages(
        nextMessages.length
          ? [...defaultAssistantMessages, ...nextMessages]
          : defaultAssistantMessages,
      );
    } catch (err) {
      setAssistantMessages(defaultAssistantMessages);
      setAssistantError(
        err instanceof Error ? err.message : "Failed to load assistant history.",
      );
    } finally {
      setAssistantHistoryLoading(false);
    }
  }

  useEffect(() => {
    setAssistantSummary(null);
    setAssistantError(null);

    if (!activeTranscriptionId) {
      setAssistantMessages(defaultAssistantMessages);
      return;
    }

    void loadAssistantMessages(activeTranscriptionId);
  }, [activeTranscriptionId]);

  async function pollForProcessedResult(id: string) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
      const nextItems = await loadItems({ showLoading: false });
      if (!nextItems) {
        continue;
      }

      const currentItem = nextItems.find((item) => item.id === id);
      if (!currentItem) {
        break;
      }

      if (currentItem.status === "done" || currentItem.status === "error") {
        await loadBilling();
        return currentItem;
      }
    }

    return null;
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    setAssistantError(null);
    setAssistantSummary(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      formData.append("template", uploadTemplate);
      if (estimatedDurationSeconds) {
        formData.append(
          "estimatedDurationSeconds",
          String(estimatedDurationSeconds),
        );
      }

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Upload failed");
      }
      setFile(null);
      setEstimatedDurationSeconds(null);
      let currentItem =
        payload?.transcriptionId
          ? (await loadItems())?.find(
              (item) => item.id === payload.transcriptionId,
            ) || null
          : null;
      await loadBilling();

      if (
        payload?.queued ||
        currentItem?.status === "processing" ||
        currentItem?.status === "uploaded"
      ) {
        currentItem = await pollForProcessedResult(payload.transcriptionId);
      }

      if (currentItem?.status === "done") {
        setFocusedSummaryId(currentItem.id);
        showCompletionTip(
          "Voxly is ready. Try a prompt below to summarize, assign owners, or draft a follow-up.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleLoadTestData() {
    setError(null);
    setTestDataStatus(null);
    setTestDataLoading(true);

    try {
      const res = await fetch(
        `/api/transcriptions/training-data?template=${encodeURIComponent(uploadTemplate)}`,
      );
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load test data");
      }
      setTestDataStatus("Test data loaded successfully.");
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load test data");
    } finally {
      setTestDataLoading(false);
    }
  }

  async function handleProcess(id: string, template?: string | null) {
    setError(null);
    setAssistantError(null);
    setAssistantSummary(null);
    setFocusedSummaryId(id);
    setProcessingIds((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch("/api/transcriptions/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcriptionId: id,
          template: template || undefined,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Processing failed");
      }
      const nextItems = await loadItems({ showLoading: false });
      await loadBilling();
      let currentItem = nextItems?.find((item) => item.id === id) || null;

      if (
        payload?.queued ||
        currentItem?.status === "processing" ||
        currentItem?.status === "uploaded"
      ) {
        currentItem = await pollForProcessedResult(id);
      }

      if (currentItem?.status === "done") {
        setFocusedSummaryId(currentItem.id);
        showCompletionTip(
          "Voxly is ready. Try a prompt below to summarize, assign owners, or draft a follow-up.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
    } finally {
      setProcessingIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm(
      "Delete this transcription from history? This cannot be undone.",
    );
    if (!confirmed) return;

    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch("/api/transcriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Delete failed");
      }

      setExpandedTranscripts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  function toggleTranscript(id: string) {
    setExpandedTranscripts((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  async function handleRefreshNotes() {
    setAssistantRefreshing(true);
    setAssistantError(null);

    try {
      const nextItems = await loadItems({ showLoading: false });
      setAssistantSummary(null);

      const nextFocusedSummary =
        (focusedSummaryId
          ? nextItems?.find((item) => item.id === focusedSummaryId) || null
          : null) ||
        nextItems?.find((item) => item.status === "done") ||
        null;

      if (!nextFocusedSummary) {
        setAssistantError("No saved notes are available to refresh yet.");
        return;
      }

      setFocusedSummaryId(nextFocusedSummary.id);
      await loadAssistantMessages(nextFocusedSummary.id);
    } catch (err) {
      setAssistantError(
        err instanceof Error ? err.message : "Failed to refresh notes.",
      );
    } finally {
      setAssistantRefreshing(false);
    }
  }

  async function handleAssistantSubmit(promptText?: string) {
    const text = (promptText ?? assistantPrompt).trim();
    const activeSummary = focusedSummary;
    if (!text) return;
    if (!activeSummary) {
      setAssistantError("No summary available yet.");
      return;
    }

    setAssistantBusy(true);
    setAssistantError(null);
    const nextMessages: typeof assistantMessages = [
      ...assistantMessages,
      { role: "user", content: text },
    ];
    setAssistantMessages(nextMessages);
    try {
      const summaryPayload = {
        decisions: activeSummary.decisions || [],
        keyPoints: activeSummary.keyPoints || [],
        nextSteps: activeSummary.nextSteps || [],
        actionItems: activeSummary.actionItems || [],
      };

      const [editResp, chatResp] = await Promise.all([
        fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text, summary: summaryPayload }),
        }).then(async (response) => ({
          ok: response.ok,
          data: await response.json().catch(() => ({})),
        })),
        fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcriptionId: activeSummary.id,
            messages: nextMessages,
            summary: summaryPayload,
          }),
        }).then(async (response) => ({
          ok: response.ok,
          data: await response.json().catch(() => ({})),
        })),
      ]);

      if (!editResp.ok) {
        throw new Error(editResp.data?.error || "Assistant edit failed");
      }
      if (!chatResp.ok) {
        throw new Error(chatResp.data?.error || "Assistant chat failed");
      }

      const updatedSummary = editResp.data?.summary || null;
      setAssistantSummary(updatedSummary);
      if (updatedSummary && activeSummary?.id) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === activeSummary.id
              ? {
                  ...item,
                  decisions: updatedSummary.decisions || [],
                  keyPoints: updatedSummary.keyPoints || [],
                  nextSteps: updatedSummary.nextSteps || [],
                  actionItems: updatedSummary.actionItems || [],
                }
              : item,
          ),
        );
      }
      const assistantReply = chatResp.data?.message || "(No reply)";
      setAssistantMessages((prev) => {
        const newMessages: typeof assistantMessages = [
          ...prev,
          { role: "assistant", content: assistantReply },
        ];
        return newMessages;
      });
      setAssistantPrompt("");
    } catch (err) {
      setAssistantError(
        err instanceof Error ? err.message : "Assistant request failed",
      );
      setAssistantMessages((prev) => {
        const errorMessages: typeof assistantMessages = [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I couldn't update the notes. Please try again.",
          },
        ];
        return errorMessages;
      });
    } finally {
      setAssistantBusy(false);
    }
  }

  function handleAssistantSuggestion(text: string) {
    setAssistantPrompt(text);
    handleAssistantSubmit(text);
    requestAnimationFrame(() => assistantInputRef.current?.focus());
  }

  return (
    <div className="relative mt-6">
      {completionTip ? (
        <div className="pointer-events-none fixed left-1/2 top-24 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2">
          <div className="rounded-[22px] border border-emerald-200 bg-emerald-50/95 px-4 py-3 text-sm text-emerald-900 shadow-[0_18px_48px_-24px_rgba(16,185,129,0.75)] backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                !
              </div>
              <div>
                <p className="font-bold">Tips unlocked</p>
                <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                  {completionTip}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_420px]">
      <div className="min-w-0 space-y-4">
        <section className="rounded-[24px] border border-white/80 bg-white/72 p-4 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.28)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-700">
                Workspace
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">
                Turn raw recordings into clean notes and next steps.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Upload audio, generate transcripts, and shape the output into
                something your team can act on.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-[18px] border border-white/80 bg-[#fffdf9] px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Uploads
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-950">
                  {items.length}
                </p>
              </div>
              <div className="rounded-[18px] border border-white/80 bg-[#fffdf9] px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Ready
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-950">
                  {items.filter((item) => item.status === "done").length}
                </p>
              </div>
              <div className="rounded-[18px] border border-white/80 bg-[#fffdf9] px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Assistant
                </p>
                <p className="mt-1 text-xs font-semibold text-emerald-700">
                  Ready to help
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="rounded-[22px] border border-white/80 bg-white/88 p-3.5 shadow-[0_14px_34px_-30px_rgba(15,23,42,0.24)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-700">
                Billing
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
                Credits
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Quick balance view.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadBilling}
                disabled={billingLoading}
                className="cursor-pointer rounded-full border border-slate-200 bg-[#fcfbf8] px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-[#f5f1ea] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {billingLoading ? "Refreshing..." : "Refresh Credits"}
              </button>
            </div>
          </div>

          {billingLoading ? (
            <p className="mt-3 text-sm text-slate-500">Loading billing details...</p>
          ) : billing ? (
            <>
              <div className="mt-3 flex flex-col gap-2 rounded-[18px] border border-slate-200 bg-[#fffdf9] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Available Credits
                  </p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">
                    {billing.creditsRemaining}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {billing.hasActiveSubscription
                      ? `${billing.plan} plan`
                      : "No active subscription"}
                  </p>
                </div>
                <div className="flex justify-start sm:justify-end">
                  <Link
                    href="/billing"
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-[#f8f5ef]"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <p className="mt-6 text-sm text-slate-500">
              Billing details are not available yet.
            </p>
          )}
        </section>
        <section
          id="upload"
          className="rounded-[28px] border border-white/80 bg-white/90 p-6 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)] sm:p-7"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-700">
                Upload
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">
                Drop in a recording and let Voxly shape it.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Choose a notes template, upload your file, and Voxly will turn
                the recording into a transcript, summary, and action-ready
                output.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="min-w-0 rounded-[18px] border border-slate-200 bg-[#fffaf3] px-3 py-3">
                <p className="break-words text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Formats
                </p>
                <p className="mt-1 text-xs text-slate-950">
                  MP3, M4A, WAV
                </p>
              </div>
              <div className="min-w-0 rounded-[18px] border border-slate-200 bg-[#fffaf3] px-3 py-3">
                <p className="break-words text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Upload Limit
                </p>
                <p className="mt-1 text-xs text-slate-950">
                  500MB max
                </p>
              </div>
              <div className="min-w-0 rounded-[18px] border border-slate-200 bg-[#fffaf3] px-3 py-3">
                <p className="break-words text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Processing
                </p>
                <p className="mt-1 text-xs text-slate-950">
                  Background safe
                </p>
              </div>
            </div>
          </div>

          <input
            id={fileInputId}
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={(e) => {
              const nextFile = e.target.files?.[0] || null;
              setFile(nextFile);
              setEstimatedDurationSeconds(null);
              if (nextFile) {
                void readMediaDuration(nextFile);
              }
            }}
            className="hidden"
          />

          <div className="relative mt-5 space-y-4">
            <div className="pointer-events-none absolute bottom-8 left-8 top-8 w-px bg-[linear-gradient(180deg,rgba(148,163,184,0.28)_0%,rgba(148,163,184,0.55)_20%,rgba(148,163,184,0.55)_80%,rgba(148,163,184,0.18)_100%)]" />
            <div className="relative rounded-[24px] border border-slate-200 bg-[#fcfbf8] p-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.18)]">
              <div className="absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border-4 border-[#f5efe6] bg-slate-950 text-xs font-bold text-white shadow-[0_8px_18px_-12px_rgba(15,23,42,0.45)]">
                1
              </div>
              <div className="pl-12">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Step 1
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">
                  Choose File
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Select the recording you want to process.
                </p>
                <label
                  htmlFor={fileInputId}
                  className="mt-4 block cursor-pointer rounded-[18px] border border-dashed border-[#e6dccf] bg-[linear-gradient(180deg,#fbf8f2_0%,#fffdf9_100%)] p-4 transition-all duration-200 hover:border-[#d7cab7] hover:bg-[#f8f3eb]"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3 text-left">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/90">
                        <svg
                          className="h-5 w-5 text-orange-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v8"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-950">
                          Select an audio file
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          MP3, M4A, WAV up to 500MB
                        </p>
                      </div>
                    </div>
                    <span
                      className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-center text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-[#fff4ec] hover:text-orange-700 active:scale-95"
                    >
                      Choose File
                    </span>
                  </div>
                  {file ? (
                    <div className="mt-4 rounded-[18px] border border-slate-200 bg-white p-4 text-left">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Selected file
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-950">
                        {file.name}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full border border-slate-200 bg-[#fcfbf8] px-3 py-1.5 font-medium text-slate-600">
                          {(file.size / (1024 * 1024)).toFixed(1)} MB
                        </span>
                        {estimatedDurationSeconds ? (
                          <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 font-medium text-orange-700">
                            ~{Math.ceil(estimatedDurationSeconds / 60)} credits
                          </span>
                        ) : null}
                      </div>
                      {estimatedDurationSeconds ? (
                        <p className="mt-2 text-xs text-slate-500">
                          Estimated duration: {Math.round(estimatedDurationSeconds)} seconds
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">
                      No file selected yet.
                    </p>
                  )}
                </label>
                {isDev && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-[#f2f7ff] hover:text-sky-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
                      onClick={handleLoadTestData}
                      disabled={testDataLoading}
                    >
                      {testDataLoading ? "Loading..." : "Train"}
                    </button>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      Dev only
                    </span>
                  </div>
                )}
                {testDataStatus && (
                  <p className="mt-3 text-sm font-medium text-emerald-600">
                    {testDataStatus}
                  </p>
                )}
              </div>
            </div>

            <div className="relative rounded-[24px] border border-slate-200 bg-[#fcfbf8] p-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.18)]">
              <div className="absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border-4 border-[#f5efe6] bg-slate-950 text-xs font-bold text-white shadow-[0_8px_18px_-12px_rgba(15,23,42,0.45)]">
                2
              </div>
              <div className="pl-12">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Step 2
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">
                  Choose Template
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Pick the note style Voxly should use for this recording.
                </p>
                <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Notes style
                </label>
                <select
                  value={uploadTemplate}
                  onChange={(e) => setUploadTemplate(e.target.value)}
                  className="mt-2 w-full cursor-pointer rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="relative rounded-[24px] border border-orange-200 bg-[linear-gradient(180deg,#fff7ef_0%,#fffdf9_100%)] p-4 shadow-[0_14px_34px_-24px_rgba(249,115,22,0.18)]">
              <div className="absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border-4 border-[#fff3e8] bg-[#f97316] text-xs font-bold text-white shadow-[0_8px_18px_-12px_rgba(249,115,22,0.55)]">
                3
              </div>
              <div className="pl-12">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                  Step 3
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">
                  Start Voxly
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Kick off the upload and let Voxly process the recording.
                </p>
                <form
                  onSubmit={handleUpload}
                  className="mt-4 flex flex-col items-start gap-3"
                >
                  <button
                    type="submit"
                    disabled={
                      !file || uploading || durationLoading || !hasEnoughEstimatedCredits
                    }
                    className="cursor-pointer rounded-full bg-[#f97316] px-8 py-3 text-sm font-bold text-white shadow-[0_18px_34px_-18px_rgba(249,115,22,0.9)] hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:bg-[#fdc9a8] disabled:text-white/90 disabled:opacity-100 active:scale-95 disabled:active:scale-100"
                  >
                    {uploading
                      ? "Starting Voxly..."
                      : durationLoading
                        ? "Reading duration..."
                        : "Start Voxly"}
                  </button>
                  {!file ? (
                    <p className="text-xs text-slate-500">
                      Choose a file in Step 2 to enable Start Voxly.
                    </p>
                  ) : null}
                  <p className="text-xs text-slate-500">
                    Once the upload finishes, Voxly can keep processing in the
                    background even if you leave this page.
                  </p>
                  {!hasEnoughEstimatedCredits && estimatedCredits ? (
                    <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      This file is estimated to require {estimatedCredits} credits,
                      but your account currently has only{" "}
                      {billing?.creditsRemaining ?? 0} remaining.
                    </p>
                  ) : null}
                </form>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800 shadow-sm">
              {error}
            </div>
          )}
        </section>

        <section ref={resultAreaRef} className="space-y-8">
          <div className="rounded-[24px] border border-white/80 bg-white/88 p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.2)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Current Voxly Audio
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {focusedSummary?.fileName || "No processed audio selected yet"}
            </p>
          </div>
          {[
            {
              title: "Decisions",
              items: displaySummary?.decisions,
            },
            {
              title: "Key Points",
              items: displaySummary?.keyPoints,
            },
            {
              title: "Next Steps",
              items: displaySummary?.nextSteps,
            },
          ].map((block) => (
            <div key={block.title} className="space-y-3">
              <h3 className="text-xl font-semibold text-slate-900">
                {block.title}
              </h3>
              <div className="space-y-3">
                {block.items &&
                Array.isArray(block.items) &&
                block.items.length ? (
                  block.items.map((item, idx) => {
                    const itemText =
                      typeof item === "string"
                        ? item
                        : (item as ActionItem)?.text;
                    const itemAssignee =
                      typeof item === "string"
                        ? undefined
                        : (item as ActionItem)?.assignee;
                    return (
                      <div
                        key={`${block.title}-${idx}`}
                        className="flex gap-4 rounded-[24px] border border-white/80 bg-white/88 p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.2)]"
                      >
                        <div className="w-1.5 rounded-full bg-orange-300" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                            {itemText}
                          </p>
                          {itemAssignee && itemText !== itemAssignee && (
                            <p className="mt-1 text-xs text-slate-500">
                              {itemAssignee}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[24px] border border-white/80 bg-white/88 p-5 text-sm text-slate-400 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.2)]">
                    No data yet.
                  </div>
                )}
              </div>
            </div>
          ))}

          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-slate-900">
              Action Items
            </h3>
            <div className="space-y-3">
              {displaySummary?.actionItems &&
              displaySummary.actionItems.length ? (
                displaySummary.actionItems.map((item, idx) => (
                  <div
                    key={`Action Items-${idx}`}
                    className="flex items-start gap-4 rounded-[24px] border border-white/80 bg-white/88 p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.2)]"
                  >
                    <div className="mt-1 h-5 w-5 rounded-full border border-orange-300 bg-orange-50" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                        {item.text}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`rounded-full px-2.5 py-1 font-bold ${
                            item.priority === "HIGH"
                              ? "bg-red-100 text-red-700"
                              : item.priority === "MEDIUM"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {item.priority || "MEDIUM"}
                        </span>
                        <span className="text-slate-500">
                          @
                          {item.assignee && item.assignee.trim()
                            ? item.assignee
                            : "Unassigned"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-white/80 bg-white/88 p-5 text-sm text-slate-400 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.2)]">
                  No data yet.
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="flex items-center justify-center gap-8 py-2 text-sm font-medium text-slate-500">
          <span className="flex items-center gap-2">
            <span className="text-green-500">●</span> Fast processing
          </span>
          <span className="flex items-center gap-2">
            <span className="text-orange-500">●</span> AI summaries
          </span>
          <span className="flex items-center gap-2">
            <span className="text-sky-500">●</span> Private & secure
          </span>
        </div>

        <section
          id="transcriptions"
          className="rounded-[30px] border border-white/80 bg-white/88 p-8 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)]"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <h2 className="text-xl font-bold text-slate-900">Transcriptions</h2>
            <button
              type="button"
              onClick={() => void loadItems()}
              className="cursor-pointer rounded-full border border-slate-200 bg-[#fcfbf8] px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-[#f5f1ea] active:scale-95"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="mt-6 text-sm text-slate-400 text-center">
              Loading...
            </p>
          ) : sortedItems.length === 0 ? (
            <div className="mt-6 py-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                <svg
                  className="w-8 h-8 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-600">
                No uploads yet.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Upload your first recording to get started.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {sortedItems.map((item) => {
                const isProcessing =
                  processingIds[item.id] || item.status === "processing";
                const canProcess =
                  !isProcessing &&
                  (item.status === "uploaded" || item.status === "done");

                return (
                  <div
                    key={item.id}
                    className="rounded-[24px] border border-slate-200 bg-[#fffdf9] p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.22)] transition-all hover:border-slate-300 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex-1">
                        <p className="text-base font-bold text-slate-900">
                          {item.fileName}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <p className="text-xs text-slate-500">
                            {new Date(item.createdAt).toLocaleString()}
                          </p>
                          <span className="text-slate-300">•</span>
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              item.status === "done"
                                ? "bg-green-100 text-green-700"
                                : item.status === "uploaded"
                                  ? "bg-amber-100 text-amber-700"
                                  : item.status === "uploading"
                                    ? "bg-orange-100 text-orange-700"
                                : item.status === "processing"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {item.status}
                          </span>
                          {item.duration ? (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="text-xs text-slate-500">
                                {Math.max(1, Math.ceil(item.duration / 60))}{" "}
                                credits
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleProcess(item.id, item.template)}
                          disabled={!canProcess}
                          className={`cursor-pointer rounded-full border px-4 py-2 text-xs font-bold active:scale-95 ${
                            isProcessing
                              ? "border-sky-200 bg-sky-50 text-sky-700 shadow-[0_10px_24px_-20px_rgba(14,165,233,0.9)]"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-[#fff4ec] hover:text-orange-700"
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          {isProcessing ? "Processing..." : "Process"}
                        </button>

                        {item.transcript && (
                          <button
                            type="button"
                            onClick={() => toggleTranscript(item.id)}
                            className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:border-slate-300 hover:bg-[#f2f7ff] hover:text-sky-700 active:scale-95"
                          >
                            {expandedTranscripts[item.id]
                              ? "Hide Transcript"
                              : "View Transcript"}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="cursor-pointer rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
                        >
                          {deletingId === item.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>

                    {item.transcript && expandedTranscripts[item.id] && (
                      <div className="mt-5 rounded-[24px] border border-slate-200 bg-[#f8f5ef] p-5">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Transcript
                          </p>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                            {item.transcript.length.toLocaleString()} chars
                          </span>
                        </div>
                        <p className="mt-4 whitespace-pre-wrap leading-relaxed text-sm text-slate-700">
                          {item.transcript}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <aside
        id="assistant"
        className="self-start lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)]"
      >
        <section className="flex h-full flex-col rounded-[30px] border border-white/80 bg-white/88 p-6 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)]">
          <div className="flex items-start justify-between border-b border-slate-200 pb-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-orange-700">
                AI ASSISTANT
              </p>
              <h3 className="mt-1 text-xl font-bold text-slate-900">
                Ask me to edit your notes
              </h3>
            </div>
            <button
              type="button"
              onClick={() => void handleRefreshNotes()}
              disabled={assistantRefreshing || assistantHistoryLoading}
              className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-slate-300 hover:bg-[#fff4ec] hover:text-orange-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {assistantRefreshing || assistantHistoryLoading
                ? "Refreshing..."
                : "Refresh notes"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-4">
            <div className="mt-4 flex items-start gap-3 rounded-[24px] border border-orange-200 bg-[#fff4ec] p-4 shadow-sm">
              <span className="text-2xl">🤖</span>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  How can I help with these notes?
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  I can directly edit your notes – add key points, update action
                  items, change priorities, and more.
                </p>
              </div>
            </div>

            {hasProcessedSummary ? (
              <div className="mt-4 space-y-2">
                {[
                  "Summarize the meeting in 3 bullets",
                  "List owners for each action item",
                  "Draft a follow-up email for attendees",
                  "Create a risk list from the discussion",
                ].map((text) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => handleAssistantSuggestion(text)}
                    className="cursor-pointer w-full rounded-[20px] border border-slate-200 bg-[#fffdf9] px-4 py-3 text-left text-xs font-medium text-slate-700 shadow-sm transition-all hover:border-orange-300 hover:bg-[#fff4ec] hover:shadow-md active:scale-98"
                  >
                    {text}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-[20px] border border-dashed border-slate-200 bg-[#fcfbf8] px-4 py-4 text-xs leading-relaxed text-slate-500">
                Prompts will appear here after Start Voxly finishes and the
                recording has been processed.
              </div>
            )}

            {assistantMessages.length > 0 && (
              <div className="mt-4 space-y-4">
                {assistantMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {message.role === "assistant" && (
                      <div className="mr-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#f97316] shadow-md">
                        <span className="text-sm">🤖</span>
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                        message.role === "user"
                          ? "bg-slate-950 text-white"
                          : "border border-slate-200 bg-[#fffdf9] text-slate-800 shadow-slate-200"
                      }`}
                    >
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => (
                            <p className="text-sm leading-relaxed mb-2 last:mb-0 text-inherit">
                              {children}
                            </p>
                          ),
                          ul: ({ children }) => (
                            <ul className="text-sm leading-relaxed list-disc ml-4 mb-2 last:mb-0 text-inherit">
                              {children}
                            </ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="text-sm leading-relaxed list-decimal ml-4 mb-2 last:mb-0 text-inherit">
                              {children}
                            </ol>
                          ),
                          li: ({ children }) => (
                            <li className="text-sm leading-relaxed text-inherit">
                              {children}
                            </li>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-bold text-inherit">
                              {children}
                            </strong>
                          ),
                          em: ({ children }) => (
                            <em className="italic text-inherit">{children}</em>
                          ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                    {message.role === "user" && (
                      <div className="ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 shadow-md">
                        <span className="text-sm">👤</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
            <div className="flex items-center gap-2">
              <input
                placeholder="Ask me to edit your notes..."
                ref={assistantInputRef}
                value={assistantPrompt}
                disabled={assistantBusy || !hasProcessedSummary}
                onChange={(event) => setAssistantPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAssistantSubmit();
                  }
                }}
                className="flex-1 rounded-full border border-slate-200 bg-[#fcfbf8] px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none transition-all focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => handleAssistantSubmit()}
                disabled={assistantBusy || !hasProcessedSummary}
                className="cursor-pointer rounded-full bg-[#f97316] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#ea580c] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Send
              </button>
            </div>
            {assistantError && (
              <p className="text-xs text-red-600">{assistantError}</p>
            )}
            {assistantHistoryLoading ? (
              <p className="text-xs text-slate-500">Loading notes history...</p>
            ) : null}
            <p className="text-xs leading-relaxed text-slate-500">
              {hasProcessedSummary
                ? "Ready to help. Choose a suggestion or type your own request."
                : "Process a recording to unlock prompts and assistant edits."}
            </p>
          </div>
        </section>
      </aside>
      </div>
    </div>
  );
}
