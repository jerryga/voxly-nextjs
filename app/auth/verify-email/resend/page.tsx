"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ResendVerificationPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/auth/verification/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to resend verification email");
      }

      setSuccess("Verification email sent. Check your inbox.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to resend verification email",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4efe7] px-6 pb-16 pt-24 text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.16),transparent_34%),linear-gradient(180deg,#f6f1e8_0%,#f9f7f2_48%,#ffffff_100%)]" />
      <div className="mx-auto w-full max-w-md rounded-[32px] border border-white/80 bg-white/92 p-8 shadow-[0_30px_80px_-44px_rgba(15,23,42,0.45)]">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-700">
          Verify Email
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-slate-950">
          Resend verification link
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Enter your email and we’ll send a fresh verification link if the
          account still needs one.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-[#fcfbf8] px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
            placeholder="you@example.com"
            required
          />
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {success}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="cursor-pointer w-full rounded-full bg-[#f97316] px-4 py-3 text-sm font-medium text-white shadow-[0_16px_30px_-18px_rgba(249,115,22,0.9)] transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Sending..." : "Resend verification email"}
          </button>
        </form>

        <div className="mt-6 text-sm text-slate-500">
          <Link href="/auth/sign-in" className="font-medium text-slate-900 hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
