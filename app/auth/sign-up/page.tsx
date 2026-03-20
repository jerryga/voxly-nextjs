"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    setLoading(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload?.error || "Failed to create account");
      return;
    }

    router.push(
      `/auth/verify-email/check-inbox?email=${encodeURIComponent(email)}`,
    );
  }

  return (
    <div className="min-h-screen bg-[#f4efe7] px-6 pb-16 pt-24 text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.16),transparent_34%),linear-gradient(180deg,#f6f1e8_0%,#f9f7f2_48%,#ffffff_100%)]" />
      <div className="mx-auto w-full max-w-300">
        <nav className="fixed left-0 right-0 top-0 z-50 px-6 py-4">
          <div className="mx-auto w-full max-w-300">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-full border border-white/70 bg-white/80 px-6 py-3 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.45)] backdrop-blur">
              <Link href="/" className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-xs font-semibold text-white shadow-sm">
                  V
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Voxly</p>
                  <p className="text-[11px] text-slate-500">
                    Voice Intelligence
                  </p>
                </div>
              </Link>

              <div className="flex items-center gap-2">
                <Link
                  className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-[#f8f5ef]"
                  href="/auth/sign-in"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </nav>

        <div className="mx-auto mt-14 w-full max-w-md rounded-[32px] border border-white/80 bg-white/92 p-8 shadow-[0_30px_80px_-44px_rgba(15,23,42,0.45)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              🚀
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Create account
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Start by setting your account details and verifying your email.
              </p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-[#fcfbf8] px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-[#fcfbf8] px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-[#fcfbf8] px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">
                Confirm password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-[#fcfbf8] px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                required
              />
            </div>
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="cursor-pointer w-full rounded-full bg-[#f97316] px-4 py-3 text-sm font-medium text-white shadow-[0_16px_30px_-18px_rgba(249,115,22,0.9)] transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating..." : "Create account"}
            </button>
          </form>
          <div className="mt-6 text-sm text-slate-500">
            Already have an account?{" "}
            <Link
              href="/auth/sign-in"
              className="font-medium text-slate-900 hover:underline"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
