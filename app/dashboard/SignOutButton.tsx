"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        const confirmed = window.confirm("Log out of Voxly?");
        if (!confirmed) return;
        await signOut({ redirect: false });
        window.location.assign("/dashboard");
      }}
      className="cursor-pointer inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
        <path d="M17 7l5 5-5 5" />
        <path d="M22 12H9" />
      </svg>
      Sign out
    </button>
  );
}
