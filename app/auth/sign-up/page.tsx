"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
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

    router.push("/auth/sign-in?created=1");
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] px-6 pb-16 pt-24 text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.14),transparent_55%),radial-gradient(circle_at_20%_40%,rgba(14,165,233,0.12),transparent_45%)]" />
      <div className="mx-auto w-full max-w-300">
        <nav className="fixed left-0 right-0 top-0 z-50 px-6 py-4">
          <div className="mx-auto w-full max-w-300">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-4xl border border-white/50 bg-white/70 px-6 py-3 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
              <Link href="/" className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 via-indigo-500 to-violet-500 text-xs font-semibold text-white shadow-sm">
                  V
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Voxly</p>
                  <p className="text-[11px] text-slate-500">
                    AI meeting assistant
                  </p>
                </div>
              </Link>

              <div className="flex items-center gap-2">
                <Link
                  className="cursor-pointer rounded-full border border-slate-200/70 bg-white px-4 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
                  href="/auth/sign-in"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </nav>

        <div className="mx-auto mt-14 w-full max-w-md rounded-[28px] border border-slate-200/80 bg-white p-8 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.4)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              🚀
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Create account
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Start by setting your account details.
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
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
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
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
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
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
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
              className="w-full rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
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
