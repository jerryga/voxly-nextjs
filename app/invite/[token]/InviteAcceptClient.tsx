"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function InviteAcceptClient({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<{
    workspaceName: string;
    role: string;
    billingOwnerName: string;
  } | null>(null);
  const autoAcceptStartedRef = useRef(false);

  const handleAccept = useCallback(async () => {
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/workspaces/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to accept invite");
      }

      setAccepted({
        workspaceName: payload?.workspace?.name || "your workspace",
        role: payload?.role || "member",
        billingOwnerName:
          payload?.billingOwner?.name?.trim() ||
          payload?.billingOwner?.email ||
          "the workspace owner",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invite");
    } finally {
      setBusy(false);
    }
  }, [token]);

  useEffect(() => {
    if (autoAcceptStartedRef.current) {
      return;
    }

    autoAcceptStartedRef.current = true;
    void handleAccept();
  }, [handleAccept]);

  return (
    <div className="min-h-screen bg-[#f4efe7] px-4 py-16 text-slate-900">
      <div className="mx-auto max-w-xl rounded-[28px] border border-white/80 bg-white/92 p-8 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.35)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-700">
          Workspace Invite
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          {accepted ? "Workspace joined" : "Joining workspace"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {accepted
            ? "Your invitation has been accepted."
            : "Voxly is checking your signed-in account and accepting the workspace invitation."}
        </p>

        {error ? (
          <div className="mt-6 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {accepted ? (
          <div className="mt-6 rounded-[22px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
            <p className="font-semibold text-emerald-900">
              You joined {accepted.workspaceName}.
            </p>
            <p className="mt-2 leading-6">
              Your role is <span className="font-semibold">{accepted.role}</span>. Billing and credits for this workspace are managed through{" "}
              <span className="font-semibold">{accepted.billingOwnerName}</span>.
            </p>
            <p className="mt-2 leading-6">
              You’ll land directly in this workspace when you continue to the dashboard.
            </p>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          {accepted ? (
            <button
              type="button"
              onClick={() => {
                router.push("/dashboard");
                router.refresh();
              }}
              className="cursor-pointer rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white"
            >
              Continue to Workspace
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleAccept()}
              disabled={busy}
              className="cursor-pointer rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Joining..." : "Accept Invite"}
            </button>
          )}
          <a
            href="/dashboard"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700"
          >
            {accepted ? "Open dashboard later" : "Go to dashboard"}
          </a>
        </div>
      </div>
    </div>
  );
}
