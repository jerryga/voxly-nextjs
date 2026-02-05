"use client";

import { useEffect, useMemo, useState, useId, useRef } from "react";
import ReactMarkdown from "react-markdown";

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

export function TranscriptionClient() {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const assistantInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<Transcription[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadTemplate, setUploadTemplate] = useState("default");
  const [testDataLoading, setTestDataLoading] = useState(false);
  const [testDataStatus, setTestDataStatus] = useState<string | null>(null);
  const [expandedTranscripts, setExpandedTranscripts] = useState<
    Record<string, boolean>
  >({});
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantSummary, setAssistantSummary] = useState<{
    decisions?: string[];
    keyPoints?: string[];
    nextSteps?: string[];
    actionItems?: ActionItem[];
  } | null>(null);
  const [assistantMessages, setAssistantMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([
    {
      role: "assistant",
      content: "Hi! I can edit these notes or answer questions about them.",
    },
  ]);

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
  const displaySummary = assistantSummary || latestSummary;

  async function loadItems() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/transcriptions");
      const payload = (await res.json()) as ApiResponse;
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load transcriptions");
      }
      setItems(payload.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      formData.append("template", uploadTemplate);

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Upload failed");
      }
      setFile(null);
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleProcess(id: string, template?: string | null) {
    setProcessingId(id);
    setError(null);
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
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
    } finally {
      setProcessingId(null);
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

  function toggleTranscript(id: string) {
    setExpandedTranscripts((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  async function handleAssistantSubmit(promptText?: string) {
    const text = (promptText ?? assistantPrompt).trim();
    if (!text) return;
    if (!latestSummary) {
      setAssistantError("No summary available yet.");
      return;
    }

    setAssistantBusy(true);
    setAssistantError(null);
    const nextMessages = [
      ...assistantMessages,
      { role: "user", content: text },
    ];
    setAssistantMessages(nextMessages);
    try {
      const summaryPayload = {
        decisions: latestSummary.decisions || [],
        keyPoints: latestSummary.keyPoints || [],
        nextSteps: latestSummary.nextSteps || [],
        actionItems: latestSummary.actionItems || [],
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
      if (updatedSummary && latestSummary?.id) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === latestSummary.id
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
      setAssistantMessages((prev) => [
        ...prev,
        { role: "assistant", content: assistantReply },
      ]);
      setAssistantPrompt("");
    } catch (err) {
      setAssistantError(
        err instanceof Error ? err.message : "Assistant request failed",
      );
      setAssistantMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I couldn’t update the notes. Please try again.",
        },
      ]);
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
    <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_420px] items-start">
      <div className="space-y-6 min-w-0">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-10 shadow-sm">
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              What would you like to voxly?
            </h2>
            <p className="text-base text-slate-600">
              Upload your meeting recordings to get started.
            </p>
          </div>
          <div className="mt-6 flex justify-center">
            <div className="flex items-center gap-3 rounded-full border border-slate-300 bg-gradient-to-br from-slate-50 to-white px-5 py-2.5 shadow-sm">
              <span className="text-sm font-semibold text-slate-700">
                Template:
              </span>
              <select
                value={uploadTemplate}
                onChange={(e) => setUploadTemplate(e.target.value)}
                className="bg-transparent text-sm font-medium text-slate-900 outline-none cursor-pointer"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-blue-50/50 via-slate-50/50 to-indigo-50/50 px-8 py-12 text-center hover:border-slate-300 hover:bg-gradient-to-br hover:from-blue-50 hover:via-slate-50 hover:to-indigo-50 transition-all duration-200">
            <div className="mx-auto max-w-sm">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 mb-4 shadow-lg">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Upload audio or video
              </h3>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                Drag and drop your files here, or click to browse.
              </p>
              <p className="mt-2 text-xs text-slate-500 font-medium">
                Supports MP3, M4A, WAV (up to 500MB)
              </p>
            </div>
            <input
              id={fileInputId}
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <label
                htmlFor={fileInputId}
                className="cursor-pointer rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md active:scale-95"
              >
                Select Files
              </label>
              {isDev && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-indigo-50 hover:text-indigo-700 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
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
            </div>
            {testDataStatus && (
              <p className="mt-4 text-sm font-medium text-emerald-600">
                {testDataStatus}
              </p>
            )}
            <form
              onSubmit={handleUpload}
              className="mt-6 flex flex-col items-center gap-3"
            >
              <button
                type="submit"
                disabled={!file || uploading}
                className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-3 text-sm font-bold text-white shadow-lg hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 disabled:active:scale-100"
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
              {file && (
                <span className="text-sm font-medium text-slate-700 bg-slate-100 px-4 py-1.5 rounded-full">
                  {file.name}
                </span>
              )}
            </form>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-300 bg-gradient-to-br from-red-50 to-red-100/50 px-5 py-4 text-sm font-medium text-red-800 shadow-sm">
              {error}
            </div>
          )}
        </section>

        <section className="space-y-8">
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
                {block.items && block.items.length ? (
                  block.items.map((item, idx) => (
                    <div
                      key={`${block.title}-${idx}`}
                      className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <div className="w-1.5 rounded-full bg-slate-300" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                          {typeof item === "string" ? item : item.text}
                        </p>
                        {typeof item !== "string" &&
                          item.text !== item.assignee && (
                            <p className="mt-1 text-xs text-slate-500">
                              {item.assignee}
                            </p>
                          )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">
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
                    className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="mt-1 h-5 w-5 rounded-full border border-slate-300 bg-white" />
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
                                ? "bg-amber-100 text-amber-700"
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
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">
                  No data yet.
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="flex items-center justify-center gap-8 py-4 text-sm font-medium text-slate-500">
          <span className="flex items-center gap-2">
            <span className="text-green-500">●</span> Fast processing
          </span>
          <span className="flex items-center gap-2">
            <span className="text-blue-500">●</span> AI summaries
          </span>
          <span className="flex items-center gap-2">
            <span className="text-purple-500">●</span> Private & secure
          </span>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <h2 className="text-xl font-bold text-slate-900">Transcriptions</h2>
            <button
              type="button"
              onClick={loadItems}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 active:scale-95"
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
              {sortedItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 hover:shadow-md transition-all"
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
                              : item.status === "processing"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleProcess(item.id, item.template)}
                        disabled={
                          processingId === item.id || item.status !== "uploaded"
                        }
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:border-slate-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                      >
                        {processingId === item.id ? "Processing..." : "Process"}
                      </button>
                      {item.transcript && (
                        <button
                          type="button"
                          onClick={() => toggleTranscript(item.id)}
                          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:border-slate-300 hover:bg-indigo-50 hover:text-indigo-700 active:scale-95"
                        >
                          {expandedTranscripts[item.id]
                            ? "Hide Transcript"
                            : "View Transcript"}
                        </button>
                      )}
                    </div>
                  </div>

                  {item.transcript && expandedTranscripts[item.id] && (
                    <div className="mt-5 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100/50 p-5">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Transcript
                        </p>
                        <span className="text-xs font-semibold text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200">
                          {item.transcript.length.toLocaleString()} chars
                        </span>
                      </div>
                      <p className="mt-4 whitespace-pre-wrap leading-relaxed text-sm text-slate-700">
                        {item.transcript}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] self-start">
        <section className="flex h-full flex-col rounded-2xl border border-slate-200  from-white via-blue-50/30 to-indigo-50/30 p-6 shadow-sm">
          <div className="flex items-start justify-between border-b border-slate-200 pb-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                AI ASSISTANT
              </p>
              <h3 className="mt-1 text-xl font-bold text-slate-900">
                Ask me to edit your notes
              </h3>
            </div>
            <button className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-slate-300 hover:bg-blue-50 hover:text-blue-700 active:scale-95">
              Refresh notes
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-4">
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-200  from-blue-50/80 to-indigo-50/80 backdrop-blur-sm p-4 shadow-sm">
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
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-xs font-medium text-slate-700 shadow-sm transition-all hover:border-blue-400 hover:bg-blue-50 hover:shadow-md active:scale-98"
                >
                  {text}
                </button>
              ))}
            </div>

            {assistantMessages.length > 0 && (
              <div className="mt-4 space-y-4">
                {assistantMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {message.role === "assistant" && (
                      <div className="mr-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md">
                        <span className="text-sm">🤖</span>
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                        message.role === "user"
                          ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-blue-200"
                          : "border border-slate-200 bg-white text-slate-800 shadow-slate-200"
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
                      <div className="ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-700 shadow-md">
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
                onChange={(event) => setAssistantPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAssistantSubmit();
                  }
                }}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={() => handleAssistantSubmit()}
                disabled={assistantBusy}
                className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
            {assistantError && (
              <p className="text-xs text-red-600">{assistantError}</p>
            )}
            <p className="text-xs leading-relaxed text-slate-500">
              Ready to help. Choose a suggestion or type your own request.
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}
