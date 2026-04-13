"use client";

import { useState } from "react";
import type { Project } from "./SessionAssistantRail";

type WhatNextPanelProps = {
  projects: Project[];
  onProjectAssign: (projectId: string) => void;
  onShareCopied: () => void;
};

export function WhatNextPanel({ projects, onProjectAssign, onShareCopied }: WhatNextPanelProps) {
  const [showProjectSelect, setShowProjectSelect] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Share");

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

        <button
          type="button"
          onClick={handleShare}
          className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          {copyLabel}
        </button>
      </div>
    </div>
  );
}
