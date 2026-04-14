"use client";

import { memo, useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";

export type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantScope = "transcript" | "project" | "workspace";

export type Project = {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ActiveWorkspaceDetails = {
  id: string;
  name: string;
  slug: string;
  isPersonal: boolean;
  createdAt: string;
  role: string;
  canManage: boolean;
  memberCount: number;
  owner: {
    id: string;
    email: string;
    name?: string | null;
  };
};

export type AssistantRailProps = {
  projects: Project[];
  activeWorkspace: ActiveWorkspaceDetails | null;
  assistantBusy: boolean;
  assistantRefreshing: boolean;
  assistantHistoryLoading: boolean;
  assistantError: string | null;
  assistantMessages: AssistantMessage[];
  hasProcessedSummary: boolean;
  initialScope: AssistantScope;
  initialProjectId: string;
  initialWorkspaceProjectIds: string[];
  suggestions: Record<AssistantScope, string[]>;
  onRefresh: () => void;
  onSubmit: (input: {
    text: string;
    scope: AssistantScope;
    projectId: string;
    workspaceProjectIds: string[];
  }) => void;
};

// Number of "real" messages (user+assistant pairs beyond the default greeting)
function hasConversationStarted(messages: AssistantMessage[]) {
  return messages.some((m) => m.role === "user");
}

export const SessionAssistantRail = memo(function SessionAssistantRail({
  projects,
  activeWorkspace,
  assistantBusy,
  assistantRefreshing,
  assistantHistoryLoading,
  assistantError,
  assistantMessages,
  hasProcessedSummary,
  initialScope,
  initialProjectId,
  initialWorkspaceProjectIds,
  suggestions,
  onRefresh,
  onSubmit,
}: AssistantRailProps) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [localScope, setLocalScope] = useState<AssistantScope>(initialScope);
  const [localProjectId, setLocalProjectId] = useState(initialProjectId);
  const [localWorkspaceProjectIds, setLocalWorkspaceProjectIds] = useState<string[]>(
    initialWorkspaceProjectIds,
  );
  const [localPrompt, setLocalPrompt] = useState("");
  const conversationStarted = hasConversationStarted(assistantMessages);

  useEffect(() => { setLocalScope(initialScope); }, [initialScope]);
  useEffect(() => { setLocalProjectId(initialProjectId); }, [initialProjectId]);
  useEffect(() => { setLocalWorkspaceProjectIds(initialWorkspaceProjectIds); }, [initialWorkspaceProjectIds]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [assistantMessages, assistantBusy]);

  const canSubmit =
    !assistantBusy &&
    localPrompt.trim().length > 0 &&
    !(localScope === "transcript" && !hasProcessedSummary);

  const submitPrompt = useCallback(
    (textOverride?: string) => {
      const text = (textOverride ?? localPrompt).trim();
      if (!text || assistantBusy) return;
      onSubmit({
        text,
        scope: localScope,
        projectId: localProjectId,
        workspaceProjectIds: localWorkspaceProjectIds,
      });
      setLocalPrompt("");
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [assistantBusy, localPrompt, localProjectId, localScope, localWorkspaceProjectIds, onSubmit],
  );

  function handleSuggestion(text: string) {
    onSubmit({
      text,
      scope: localScope,
      projectId: localProjectId,
      workspaceProjectIds: localWorkspaceProjectIds,
    });
    setLocalPrompt("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function toggleWorkspaceProject(projectId: string) {
    setLocalWorkspaceProjectIds((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId],
    );
  }

  const scopeHint =
    localScope === "transcript"
      ? hasProcessedSummary
        ? "Ask about this session — I can edit notes, extract action items, and more."
        : "Waiting for processing to finish before I can answer about this session."
      : localScope === "project"
        ? "Searching across all recordings in the selected project."
        : "Synthesising across your entire workspace.";

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)]">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-slate-100 px-5 pb-3 pt-4">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shadow-sm">
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                <path
                  d="M8 2a6 6 0 0 1 6 6c0 1.5-.55 2.87-1.45 3.92L14 14l-2.08-1.45A5.97 5.97 0 0 1 8 14a6 6 0 0 1 0-12Z"
                  fill="white"
                  opacity=".9"
                />
                <circle cx="6" cy="8" r="1" fill="white" opacity=".5" />
                <circle cx="8" cy="8" r="1" fill="white" />
                <circle cx="10" cy="8" r="1" fill="white" opacity=".5" />
              </svg>
            </span>
            <span className="text-sm font-semibold text-slate-900">Voxly AI</span>
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={assistantRefreshing || assistantHistoryLoading}
            aria-label="Clear conversation"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
              <path
                d="M2.5 8a5.5 5.5 0 0 1 9.56-3.72M13.5 8a5.5 5.5 0 0 1-9.56 3.72M13.5 4.5V2M11 4.5h2.5M2.5 11.5V14M5 11.5H2.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Scope tabs */}
        <div className="mt-3 flex gap-1 rounded-[14px] bg-slate-100 p-1">
          {(["transcript", "project", "workspace"] as const).map((scopeId) => (
            <button
              key={scopeId}
              type="button"
              onClick={() => { setLocalScope(scopeId); setLocalPrompt(""); }}
              className={`flex-1 rounded-[10px] py-1.5 text-[11px] font-semibold capitalize transition-all ${
                localScope === scopeId
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {scopeId}
            </button>
          ))}
        </div>

        {/* Scope sub-controls */}
        {localScope === "project" && (
          <select
            value={localProjectId}
            onChange={(e) => setLocalProjectId(e.target.value)}
            className="mt-2 w-full cursor-pointer rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none"
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        {localScope === "workspace" && projects.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {projects.map((p) => {
              const selected = localWorkspaceProjectIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleWorkspaceProject(p.id)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    selected
                      ? "border-sky-200 bg-sky-50 text-sky-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Messages ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">

        {/* Greeting — only shown before conversation starts */}
        {!conversationStarted && (
          <div className="mb-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shadow">
                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                  <path d="M8 2a6 6 0 0 1 6 6c0 1.5-.55 2.87-1.45 3.92L14 14l-2.08-1.45A5.97 5.97 0 0 1 8 14a6 6 0 0 1 0-12Z" fill="white" opacity=".9" />
                  <circle cx="6" cy="8" r="1" fill="white" opacity=".5" />
                  <circle cx="8" cy="8" r="1" fill="white" />
                  <circle cx="10" cy="8" r="1" fill="white" opacity=".5" />
                </svg>
              </span>
              <div className="rounded-2xl rounded-tl-sm border border-slate-200 bg-[#fafaf7] px-3.5 py-2.5">
                <p className="text-sm text-slate-700">
                  {localScope === "transcript"
                    ? hasProcessedSummary
                      ? "Hi! I've reviewed this session. Ask me anything — I can edit notes, extract action items, or summarise key themes."
                      : "This session is still processing. I'll be ready to help once it's done."
                    : localScope === "project"
                      ? "Ask me anything across this project's recordings — themes, decisions, open questions."
                      : "I can synthesise insights across your entire workspace. What do you want to know?"}
                </p>
              </div>
            </div>

            {/* Suggestion chips — only before conversation starts */}
            {(localScope !== "transcript" || hasProcessedSummary) && (
              <div className="space-y-1.5 pl-10">
                {suggestions[localScope].map((text, i) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => handleSuggestion(text)}
                    style={{ animationDelay: `${i * 40}ms` }}
                    className="voxly-stagger-fade block w-full rounded-[14px] border border-slate-200 bg-white px-3.5 py-2.5 text-left text-xs font-medium text-slate-600 transition hover:border-orange-300 hover:bg-[#fff9f5] hover:text-orange-700"
                  >
                    {text}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Conversation messages */}
        {assistantMessages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`mb-3 flex items-end gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {message.role === "assistant" && (
              <span className="mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shadow-sm">
                <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" aria-hidden="true">
                  <path d="M8 2a6 6 0 0 1 6 6c0 1.5-.55 2.87-1.45 3.92L14 14l-2.08-1.45A5.97 5.97 0 0 1 8 14a6 6 0 0 1 0-12Z" fill="white" opacity=".9" />
                  <circle cx="6" cy="8" r="1" fill="white" opacity=".5" />
                  <circle cx="8" cy="8" r="1" fill="white" />
                  <circle cx="10" cy="8" r="1" fill="white" opacity=".5" />
                </svg>
              </span>
            )}
            <div
              className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                message.role === "user"
                  ? "rounded-br-sm bg-slate-900 text-white"
                  : "rounded-bl-sm border border-slate-200 bg-[#fafaf7] text-slate-800"
              }`}
            >
              {message.role === "assistant" ? (
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-1.5 last:mb-0 text-sm text-slate-800 leading-relaxed">{children}</p>,
                    ul: ({ children }) => <ul className="mb-1.5 ml-4 list-disc text-sm text-slate-800">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-1.5 ml-4 list-decimal text-sm text-slate-800">{children}</ol>,
                    li: ({ children }) => <li className="text-sm text-slate-800 leading-relaxed">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              ) : (
                <p className="text-sm text-white">{message.content}</p>
              )}
            </div>
            {message.role === "user" && (
              <span className="mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[10px] font-semibold text-white shadow-sm">
                U
              </span>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {assistantBusy && (
          <div className="mb-3 flex items-end gap-2">
            <span className="mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shadow-sm">
              <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" aria-hidden="true">
                <path d="M8 2a6 6 0 0 1 6 6c0 1.5-.55 2.87-1.45 3.92L14 14l-2.08-1.45A5.97 5.97 0 0 1 8 14a6 6 0 0 1 0-12Z" fill="white" opacity=".9" />
                <circle cx="6" cy="8" r="1" fill="white" opacity=".5" />
                <circle cx="8" cy="8" r="1" fill="white" />
                <circle cx="10" cy="8" r="1" fill="white" opacity=".5" />
              </svg>
            </span>
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-slate-200 bg-[#fafaf7] px-4 py-3">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ──────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-slate-100 px-4 pb-4 pt-3">
        {assistantError && (
          <p className="mb-2 rounded-[10px] bg-red-50 px-3 py-2 text-xs text-red-600">{assistantError}</p>
        )}
        <div className="flex items-end gap-2 rounded-[18px] border border-slate-200 bg-[#fafaf7] px-3 py-2 focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-100 transition-all">
          <textarea
            ref={inputRef}
            rows={1}
            value={localPrompt}
            disabled={localScope === "transcript" && !hasProcessedSummary}
            onChange={(e) => {
              setLocalPrompt(e.target.value);
              // Auto-grow up to 5 rows
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitPrompt();
              }
            }}
            placeholder={
              localScope === "transcript"
                ? hasProcessedSummary
                  ? "Ask about this session…"
                  : "Waiting for processing…"
                : localScope === "project"
                  ? "Ask across this project…"
                  : "Ask across the workspace…"
            }
            className="flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none disabled:cursor-not-allowed disabled:opacity-50"
            style={{ minHeight: "22px" }}
          />
          <button
            type="button"
            onClick={() => submitPrompt()}
            disabled={!canSubmit}
            aria-label="Send message"
            className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white shadow-sm transition hover:bg-orange-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M2 8h12M9 3l5 5-5 5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <p className="mt-2 px-1 text-[10px] leading-relaxed text-slate-400">
          {scopeHint}{activeWorkspace ? ` · ${activeWorkspace.name}` : ""}
        </p>
      </div>
    </div>
  );
});
