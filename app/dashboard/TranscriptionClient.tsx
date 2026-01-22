"use client";

import { useEffect, useMemo, useState, useId, useRef } from "react";

type ActionItem = {
  text: string;
  priority?: string;
  assignee?: string;
};

type SummaryItem = string | ActionItem;

type SummaryState = {
  decisions: string[];
  keyPoints: string[];
  nextSteps: string[];
  actionItems: SummaryItem[];
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
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
  actionItems?: SummaryItem[];
};

type ApiResponse = {
  ok?: boolean;
  items?: Transcription[];
  error?: string;
};

export function TranscriptionClient() {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<Transcription[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadTemplate, setUploadTemplate] = useState("default");
  const [assistantSummary, setAssistantSummary] = useState<SummaryState | null>(
    null,
  );
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<ChatMessage[]>([]);
  const [assistantSuggestions, setAssistantSuggestions] = useState<string[]>(
    [],
  );
  const [assistantStatus, setAssistantStatus] = useState(
    "Ready to help. Choose a suggestion or type your own request.",
  );
  const [assistantSending, setAssistantSending] = useState(false);

  const templates = [
    { id: "default", label: "Default Template (Default)" },
    { id: "brainstorm", label: "Brainstorm Session" },
    { id: "interview", label: "Interview Notes" },
    { id: "lecture", label: "Lecture Notes" },
    { id: "voice-memo", label: "Voice Memo Notes" },
  ];

  const sortedItems = useMemo(() => {
    return [...items].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [items]);

  const latestSummary = useMemo(() => {
    return sortedItems.find((item) => item.status === "done") || null;
  }, [sortedItems]);

  useEffect(() => {
    if (!latestSummary) {
      setAssistantSummary(null);
      setAssistantSuggestions(buildAssistantSuggestions(null));
      setAssistantStatus("Upload and process a file to enable the assistant.");
      return;
    }

    const nextSummary = normalizeSummary(latestSummary);
    setAssistantSummary(nextSummary);
    setAssistantSuggestions(buildAssistantSuggestions(nextSummary));
    setAssistantStatus(
      "Ready to help. Choose a suggestion or type your own request.",
    );
  }, [latestSummary]);

  async function handleAssistantSend(overridePrompt?: string) {
    const prompt = (overridePrompt ?? assistantPrompt).trim();
    if (!prompt) {
      setAssistantStatus("Enter a request to send to the assistant.");
      return;
    }

    const summary = assistantSummary || normalizeSummary(latestSummary);
    if (!summary) {
      setAssistantStatus("Upload and process a file first.");
      return;
    }

    setAssistantSending(true);
    setAssistantStatus("Sending to assistant...");

    const nextMessages: ChatMessage[] = [
      ...assistantMessages,
      { role: "user", content: prompt },
    ];
    setAssistantMessages(nextMessages);

    try {
      const [editResp, chatResp] = await Promise.all([
        fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, summary }),
        }).then(async (response) => ({
          ok: response.ok,
          data: await response.json().catch(() => ({})),
        })),
        fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: nextMessages, summary }),
        }).then(async (response) => ({
          ok: response.ok,
          data: await response.json().catch(() => ({})),
        })),
      ]);

      if (!editResp.ok || !editResp.data?.ok) {
        throw new Error(editResp.data?.error || "Assistant edit failed");
      }

      if (!chatResp.ok || !chatResp.data?.ok) {
        throw new Error(chatResp.data?.error || "Assistant chat failed");
      }

      const updatedSummary = normalizeSummary(editResp.data.summary);
      setAssistantSummary(updatedSummary);
      setAssistantSuggestions(buildAssistantSuggestions(updatedSummary));

      const assistantReply =
        typeof chatResp.data?.message === "string"
          ? chatResp.data.message
          : "";
      setAssistantMessages((prev) => [
        ...prev,
        { role: "assistant", content: assistantReply || "(No reply)" },
      ]);
      setAssistantStatus("Notes updated by the AI assistant.");
      setAssistantPrompt("");
    } catch (err) {
      setAssistantStatus(
        err instanceof Error ? err.message : "Assistant request failed",
      );
    } finally {
      setAssistantSending(false);
    }
  }

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

  async function handleTemplateUpdate(id: string, templateId: string) {
    setError(null);
    try {
      const res = await fetch("/api/transcriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, template: templateId }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to update template");
      }
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, template: templateId } : item,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update template",
      );
    }
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_450px] items-start">
      <div className="space-y-8 min-w-0">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-3">
            <h2 className="text-3xl font-semibold text-slate-900">
              What would you like to voxly?
            </h2>
            <p className="text-sm text-slate-500">
              Upload your meeting recordings to get started.
            </p>
          </div>
          <div className="mt-4 flex justify-center">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
              <span className="font-medium">Template:</span>
              <select
                value={uploadTemplate}
                onChange={(e) => setUploadTemplate(e.target.value)}
                className="cursor-pointer bg-transparent text-xs text-slate-700 outline-none"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
            <h3 className="text-lg font-semibold text-slate-900">
              Upload audio or video
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Drag and drop your files here, or click to browse.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Supports MP3, M4A, WAV (up to 500MB)
            </p>
            <input
              id={fileInputId}
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <label
                htmlFor={fileInputId}
                className="cursor-pointer rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-700 shadow-sm"
              >
                Select Files
              </label>
              <button
                type="button"
                className="cursor-pointer rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-600 shadow-sm"
              >
                Load Test Data
              </button>
            </div>
            <form
              onSubmit={handleUpload}
              className="mt-5 flex flex-col items-center gap-2"
            >
              <button
                type="submit"
                disabled={!file || uploading}
                className="cursor-pointer rounded-full bg-slate-900 px-6 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
              {file && (
                <span className="text-xs text-slate-500">
                  {file.name}
                </span>
              )}
            </form>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </section>

        <section className="space-y-3">
          {[
            {
              title: "Decisions",
              badge: "Final",
              items: assistantSummary?.decisions || latestSummary?.decisions,
            },
            {
              title: "Key Points",
              badge: "Highlights",
              items: assistantSummary?.keyPoints || latestSummary?.keyPoints,
            },
            {
              title: "Next Steps",
              badge: "Planned",
              items: assistantSummary?.nextSteps || latestSummary?.nextSteps,
            },
            {
              title: "Action Items",
              badge: "Owners",
              items: assistantSummary?.actionItems || latestSummary?.actionItems,
            },
          ].map((block) => (
            <div
              key={block.title}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  {block.title}
                </h3>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-500">
                  {block.badge}
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {block.items && block.items.length ? (
                  <ul className="list-disc space-y-1 pl-4">
                    {block.items.map((item, idx) => (
                      <li key={`${block.title}-${idx}`}>
                        {typeof item === "string" ? item : item.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No data yet.</p>
                )}
              </div>
            </div>
          ))}
        </section>

        <div className="flex items-center justify-center gap-6 text-xs text-slate-400">
          <span>• Fast processing</span>
          <span>• AI summaries</span>
          <span>• Private & secure</span>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Transcriptions</h2>
            <button
              type="button"
              onClick={loadItems}
              className="cursor-pointer text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-slate-400">Loading...</p>
          ) : sortedItems.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No uploads yet.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {sortedItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {item.fileName}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(item.createdAt).toLocaleString()} •{" "}
                        {item.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={item.template || "default"}
                        disabled={item.status === "processing"}
                        onChange={(e) =>
                          handleTemplateUpdate(item.id, e.target.value)
                        }
                        className="cursor-pointer rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
                      >
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleProcess(item.id, item.template)}
                        disabled={
                          processingId === item.id || item.status !== "uploaded"
                        }
                        className="cursor-pointer rounded-full border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                      >
                        {processingId === item.id ? "Processing..." : "Process"}
                      </button>
                    </div>
                  </div>

                  {item.transcript && (
                    <div className="mt-3 text-sm text-slate-600">
                      <p className="font-medium text-slate-900">Transcript</p>
                      <p className="mt-1 whitespace-pre-wrap">
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
        <section className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400">AI ASSISTANT</p>
              <h3 className="text-lg font-semibold text-slate-900">
                Ask me to edit your notes
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                const summary = assistantSummary || normalizeSummary(latestSummary);
                setAssistantSuggestions(buildAssistantSuggestions(summary));
                setAssistantStatus("Assistant suggestions refreshed.");
              }}
              className="cursor-pointer rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600"
            >
              Refresh notes
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  🤖
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    How can I help with these notes?
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    I can directly edit your notes – add key points, update action
                    items, change priorities, and more.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {assistantSuggestions.map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => {
                    if (!assistantSending) handleAssistantSend(text);
                  }}
                  className="cursor-pointer w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-600 transition hover:bg-slate-50"
                >
                  {text}
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-2xl bg-white p-3">
              <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
              {assistantMessages.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-500">
                  Hi! I can edit these notes or answer questions about them.
                </div>
              ) : (
                assistantMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs ${
                      message.role === "assistant"
                        ? "bg-slate-100 text-slate-700"
                        : "ml-auto bg-blue-500 text-white"
                    }`}
                  >
                    {message.content}
                  </div>
                ))
              )}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
              <input
                placeholder="Ask me to edit your notes..."
                value={assistantPrompt}
                onChange={(event) => setAssistantPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (!assistantSending) handleAssistantSend();
                  }
                }}
                className="w-full bg-transparent text-xs text-slate-600 outline-none"
              />
              <button
                type="button"
                onClick={handleAssistantSend}
                disabled={assistantSending}
                className="cursor-pointer rounded-full bg-blue-500 px-4 py-2 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-60"
              >
                Send
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              {assistantStatus}
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}

function truncateText(text: string, max = 80) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function normalizeSummary(summary?: Transcription | SummaryState | null) {
  if (!summary) return null;
  return {
    decisions: Array.isArray(summary.decisions) ? summary.decisions : [],
    keyPoints: Array.isArray(summary.keyPoints) ? summary.keyPoints : [],
    nextSteps: Array.isArray(summary.nextSteps) ? summary.nextSteps : [],
    actionItems: Array.isArray(summary.actionItems) ? summary.actionItems : [],
  } satisfies SummaryState;
}

function buildAssistantSuggestions(summary: SummaryState | null) {
  const suggestions: string[] = [];
  const actions = Array.isArray(summary?.actionItems)
    ? summary?.actionItems
    : [];
  const keyPoints = Array.isArray(summary?.keyPoints)
    ? summary?.keyPoints
    : [];

  const actionItem = actions.find(
    (item): item is ActionItem => typeof item === "object" && !!item?.text,
  );
  if (actionItem?.text) {
    suggestions.push(`Mark "${truncateText(actionItem.text, 52)}" as completed`);
  }

  const secondAction = actions.find(
    (item, idx): item is ActionItem =>
      idx > 0 && typeof item === "object" && !!item?.text,
  );
  if (secondAction?.text) {
    suggestions.push(
      `Change the priority of "${truncateText(secondAction.text, 48)}" to urgent`,
    );
  }

  if (keyPoints[0]) {
    suggestions.push(`Add a key point about ${truncateText(keyPoints[0], 56)}`);
  }

  const fallback = [
    "Summarize the meeting in 3 bullets",
    "List owners for each action item",
    "Draft a follow-up email for attendees",
    "Create a risk list from the discussion",
  ];

  fallback.forEach((item) => {
    if (suggestions.length < 4) suggestions.push(item);
  });

  return suggestions.slice(0, 4);
}
