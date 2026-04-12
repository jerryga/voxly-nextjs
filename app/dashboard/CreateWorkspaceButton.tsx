"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateWorkspaceButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleCreateWorkspace() {
    const name = window.prompt("Workspace name");
    const workspaceName = name?.trim();
    if (!workspaceName) {
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workspaceName }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create workspace");
      }

      router.push("/dashboard/settings?section=workspace");
      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Failed to create workspace",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCreateWorkspace()}
      disabled={busy}
      className="mt-3 flex w-full cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-[#f8f5ef] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">
        +
      </span>
      {busy ? "Creating..." : "New workspace"}
    </button>
  );
}
