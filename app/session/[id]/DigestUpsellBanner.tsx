"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const DISMISS_KEY = "voxly:upsell:digestDismissed";

type DigestUpsellBannerProps = {
  onDismiss?: () => void;
};

export function DigestUpsellBanner({ onDismiss }: DigestUpsellBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY) !== null;
      if (!dismissed) setVisible(true);
    } catch {
      // private browsing — don't show
    }
  }, []);

  function handleDismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
    onDismiss?.();
  }

  if (!visible) return null;

  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-[16px] border border-orange-200 bg-[#fff4ec] px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-lg">📬</span>
        <p className="text-xs font-medium text-slate-700">
          Get a weekly digest of your recordings.{" "}
          <Link
            href="/dashboard/settings?section=delivery"
            className="font-semibold text-orange-700 underline-offset-2 hover:underline"
          >
            Set up digest →
          </Link>
        </p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss digest banner"
        className="cursor-pointer text-slate-400 transition hover:text-slate-600"
      >
        ✕
      </button>
    </div>
  );
}
