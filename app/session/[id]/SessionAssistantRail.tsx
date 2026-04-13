"use client";

import { memo, useState, useEffect, useRef } from "react";
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
  const assistantInputRef = useRef<HTMLInputElement | null>(null);
  const [localScope, setLocalScope] = useState<AssistantScope>(initialScope);
  const [localProjectId, setLocalProjectId] = useState(initialProjectId);
  const [localWorkspaceProjectIds, setLocalWorkspaceProjectIds] = useState<string[]>(
    initialWorkspaceProjectIds,
  );
  const [localPrompt, setLocalPrompt] = useState("");

  useEffect(() => {
    setLocalScope(initialScope);
  }, [initialScope]);

  useEffect(() => {
    setLocalProjectId(initialProjectId);
  }, [initialProjectId]);

  useEffect(() => {
    setLocalWorkspaceProjectIds(initialWorkspaceProjectIds);
  }, [initialWorkspaceProjectIds]);

  const canSubmit =
    !assistantBusy &&
    !(
      localScope === "transcript" &&
      !hasProcessedSummary
    );

  function submitPrompt(textOverride?: string) {
    const text = (textOverride ?? localPrompt).trim();
    if (!text) {
      return;
    }

    onSubmit({
      text,
      scope: localScope,
      projectId: localProjectId,
      workspaceProjectIds: localWorkspaceProjectIds,
    });
    setLocalPrompt("");
  }

  function handleSuggestion(text: string) {
    setLocalPrompt(text);
    submitPrompt(text);
    requestAnimationFrame(() => assistantInputRef.current?.focus());
  }

  function toggleWorkspaceProject(projectId: string) {
    setLocalWorkspaceProjectIds((prev) =>
      prev.includes(projectId)
        ? prev.filter((entry) => entry !== projectId)
        : [...prev, projectId],
    );
  }

  const activeWorkspaceLabel = activeWorkspace
    ? `${activeWorkspace.name}${activeWorkspace.isPersonal ? " (Personal)" : ""}`
    : "No workspace selected";

  return (
    <section className="flex h-full flex-col gap-4 rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.28)]">
      <div className="rounded-[24px] border border-slate-200 bg-[#fafaf7] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-sm font-semibold text-slate-900">Voxly Tab</span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={
              localScope === "transcript" &&
              (assistantRefreshing || assistantHistoryLoading)
            }
            className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {localScope === "transcript"
              ? assistantRefreshing || assistantHistoryLoading
                ? "Refreshing..."
                : "Refresh"
              : "Clear"}
          </button>
        </div>
      </div>

      <div className="flex min-h-[420px] flex-1 flex-col rounded-[24px] border border-slate-200 bg-[#fafaf7] p-4">
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-orange-700">
              AI Assistant
            </p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">
              {localScope === "transcript"
                ? "Ask Voxly to refine the notes"
                : localScope === "project"
                  ? "Ask across this project"
                  : "Ask across the workspace"}
            </h3>
            <p className="mt-2 max-w-[18rem] truncate text-xs font-semibold text-slate-500">
              Current workspace:{" "}
              <span className="text-slate-800">{activeWorkspaceLabel}</span>
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {([
                ["transcript", "Transcript"],
                ["project", "Project"],
                ["workspace", "Workspace"],
              ] as const).map(([scopeId, label]) => (
                <button
                  key={scopeId}
                  type="button"
                  onClick={() => {
                    setLocalScope(scopeId);
                    setLocalPrompt("");
                  }}
                  className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                    localScope === scopeId
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {localScope === "project" ? (
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Project scope
                </span>
                <select
                  value={localProjectId}
                  onChange={(event) => setLocalProjectId(event.target.value)}
                  className="mt-2 w-full cursor-pointer rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none"
                >
                  <option value="all">Choose a project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {localScope === "workspace" ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Narrow to projects
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {projects.length ? (
                    projects.map((project) => {
                      const selected = localWorkspaceProjectIds.includes(project.id);
                      return (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => toggleWorkspaceProject(project.id)}
                          className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold ${
                            selected
                              ? "border-sky-200 bg-sky-50 text-sky-700"
                              : "border-slate-200 bg-white text-slate-700"
                          }`}
                        >
                          {project.name}
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-500">
                      Create a project to narrow workspace answers.
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex items-start gap-3 rounded-[24px] border border-orange-200 bg-[#fff4ec] p-4 shadow-sm">
              <span className="text-2xl">🤖</span>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {localScope === "transcript"
                    ? "How can I help with these notes?"
                    : localScope === "project"
                      ? "What should Voxly find across this project?"
                      : "What should Voxly synthesize across the workspace?"}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  {localScope === "transcript"
                    ? "I can directly edit your notes – add key points, update action items, change priorities, and more."
                    : "I can search across multiple transcripts, synthesize themes, and answer with grounded sources."}
                </p>
              </div>
            </div>

            {(localScope !== "transcript" || hasProcessedSummary) ? (
              <div className="mt-4 space-y-2">
                {suggestions[localScope].map((text, index) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => handleSuggestion(text)}
                    style={{ animationDelay: `${index * 50}ms` }}
                    className="voxly-stagger-fade cursor-pointer w-full rounded-[20px] border border-slate-200 bg-[#fffdf9] px-4 py-3 text-left text-xs font-medium text-slate-700 shadow-sm transition-all hover:border-orange-300 hover:bg-[#fff4ec] hover:shadow-md active:scale-98"
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
        </div>

        <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
          <div className="flex items-center gap-2">
            <input
              placeholder={
                localScope === "transcript"
                  ? "Ask me to edit your notes..."
                  : localScope === "project"
                    ? "Ask across this project..."
                    : "Ask across the workspace..."
              }
              ref={assistantInputRef}
              value={localPrompt}
              disabled={!canSubmit}
              onChange={(event) => setLocalPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitPrompt();
                }
              }}
              className="flex-1 rounded-full border border-slate-200 bg-[#fcfbf8] px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none transition-all focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => submitPrompt()}
              disabled={!canSubmit}
              className="cursor-pointer rounded-full bg-[#f97316] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#ea580c] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Send
            </button>
          </div>
          {assistantError && <p className="text-xs text-red-600">{assistantError}</p>}
          {assistantHistoryLoading ? (
            <p className="text-xs text-slate-500">Loading notes history...</p>
          ) : null}
          <p className="text-xs leading-relaxed text-slate-500">
            {localScope === "transcript"
              ? hasProcessedSummary
                ? "Ready to help. Choose a suggestion or type your own request."
                : "Process a recording to unlock prompts and assistant edits."
              : localScope === "project"
                ? "Project answers use grounded retrieval across recordings in the selected project."
                : "Workspace answers search across your workspace, or just the projects you select above."}
          </p>
        </div>
      </div>
    </section>
  );
});
