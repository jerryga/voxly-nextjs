import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { TranscriptionClient } from "./TranscriptionClient";
import { SignOutButton } from "./SignOutButton";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen bg-[#f5f7fb] px-6 pb-12 pt-24 text-slate-900">
      <div className="mx-auto w-full max-w-400">
        <nav className="fixed left-0 right-0 top-0 z-50 px-6 py-4">
          <div className="mx-auto w-full max-w-400">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/30 bg-white/60 px-5 py-3 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 via-indigo-500 to-violet-500 text-white text-xs font-semibold shadow-sm">
                  V
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Voxly</p>
                  <p className="text-[11px] text-slate-500">
                    AI meeting assistant
                  </p>
                </div>
              </div>

              <div className="order-3 w-full md:order-0 md:w-auto">
                <div className="flex flex-wrap items-center justify-center gap-4 rounded-full border border-slate-200/70 bg-white/70 px-4 py-2 text-xs font-medium text-slate-600 shadow-[0_6px_16px_-14px_rgba(15,23,42,0.35)]">
                  <Link
                    className="cursor-pointer transition hover:text-slate-900"
                    href="#"
                  >
                    Product
                  </Link>
                  <Link
                    className="cursor-pointer transition hover:text-slate-900"
                    href="#"
                  >
                    Pricing
                  </Link>
                  <Link
                    className="cursor-pointer transition hover:text-slate-900"
                    href="#"
                  >
                    Customers
                  </Link>
                  <Link
                    className="cursor-pointer transition hover:text-slate-900"
                    href="#"
                  >
                    Resources
                  </Link>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {session?.user ? (
                  <SignOutButton />
                ) : (
                  <>
                    <Link
                      className="cursor-pointer rounded-full border border-slate-200/70 bg-white px-4 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
                      href="/auth/sign-in"
                    >
                      Sign in
                    </Link>
                    <Link
                      className="cursor-pointer rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-slate-800"
                      href="/auth/sign-up"
                    >
                      Get started
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </nav>

        <TranscriptionClient isAuthenticated={Boolean(session?.user)} />
      </div>
    </div>
  );
}
