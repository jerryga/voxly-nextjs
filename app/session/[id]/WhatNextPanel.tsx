"use client";

import { useEffect, useState } from "react";
import type { Project } from "./SessionAssistantRail";

type WhatNextPanelProps = {
  projects: Project[];
  onProjectAssign: (projectId: string) => void;
  onShareCopied: () => void;
  onPublishToNotion?: () => Promise<void>;
  notionEnabled?: boolean;
  notionBusy?: boolean;
};

export function WhatNextPanel({
  projects,
  onProjectAssign,
  onShareCopied,
  onPublishToNotion,
  notionEnabled = false,
  notionBusy = false,
}: WhatNextPanelProps) {
  const [showProjectSelect, setShowProjectSelect] = useState(false);
  const [showProjectPrompt, setShowProjectPrompt] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Share");
  const [notionLabel, setNotionLabel] = useState("Send to Notion");

  useEffect(() => {
    const timeout = window.setTimeout(() => setShowProjectPrompt(true), 2000);
    return () => window.clearTimeout(timeout);
  }, []);

  function handleAskAI() {
    document.getElementById("session-assistant")?.scrollIntoView({ behavior: "smooth" });
  }

  function handleProjectChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const projectId = event.target.value;
    if (!projectId) return;
    onProjectAssign(projectId);
    setShowProjectSelect(false);
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopyLabel("Copied!");
      onShareCopied();
      setTimeout(() => setCopyLabel("Share"), 2000);
    });
  }

  async function handleNotion() {
    if (!onPublishToNotion || notionBusy) return;
    try {
      await onPublishToNotion();
      setNotionLabel("Sent!");
      setTimeout(() => setNotionLabel("Send to Notion"), 2500);
    } catch {
      setNotionLabel("Failed");
      setTimeout(() => setNotionLabel("Send to Notion"), 2500);
    }
  }

  return (
    <div className="mt-6 rounded-[20px] border border-slate-200 bg-[#fafaf7] p-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
        What&apos;s next?
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleAskAI}
          className="cursor-pointer rounded-full border border-orange-200 bg-[#fff4ec] px-4 py-2 text-xs font-semibold text-orange-700 transition hover:bg-orange-100"
        >
          Ask the AI
        </button>

        <span
          className={
            showProjectPrompt
              ? "voxly-slide-up inline-flex"
              : "inline-flex translate-y-2 opacity-0"
          }
        >
          {showProjectSelect ? (
            <select
              autoFocus
              onChange={handleProjectChange}
              onBlur={() => setShowProjectSelect(false)}
              className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
              defaultValue=""
            >
              <option value="" disabled>
                Choose a project…
              </option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          ) : (
            <button
              type="button"
              onClick={() => setShowProjectSelect(true)}
              className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Add to project
            </button>
          )}
        </span>

        <button
          type="button"
          onClick={handleShare}
          className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          {copyLabel}
        </button>

        {notionEnabled && onPublishToNotion && (
          <button
            type="button"
            onClick={() => void handleNotion()}
            disabled={notionBusy}
            className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {notionBusy ? "Sending…" : notionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
