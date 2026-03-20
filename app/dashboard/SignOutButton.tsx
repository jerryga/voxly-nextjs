"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/auth/sign-in" })}
      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] transition hover:border-slate-300 hover:bg-[#f8f5ef]"
    >
      Sign out
    </button>
  );
}
