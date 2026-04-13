"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Transcription } from "./TranscriptionClient";

type SearchResponse = {
  ok?: boolean;
  items?: Transcription[];
};

export function GlobalSearch() {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Transcription[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // cmd+K / ctrl+K to focus from anywhere
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Click outside to dismiss
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // Debounced fetch — 300ms
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/transcriptions?q=${encodeURIComponent(q)}&limit=6`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as SearchResponse;
        setResults(data.items ?? []);
        setIsOpen(true);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  function handleSelect() {
    setIsOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative mt-4 px-3">
      <div className="relative">
        <input
          ref={inputRef}
          type="search"
          placeholder="Search… ⌘K"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setIsOpen(false);
              inputRef.current?.blur();
            }
          }}
          className="w-full rounded-[14px] border border-slate-200 bg-[#fafaf7] py-2 pl-3.5 pr-8 text-sm text-slate-700 placeholder-slate-400 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
        />
        {loading && (
          <span className="absolute right-3 top-2 text-xs text-slate-400">…</span>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute left-3 right-3 top-full z-50 mt-1.5 overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-lg">
          {results.map((item) => {
            const snippet = Array.isArray(item.keyPoints) ? item.keyPoints[0] : null;
            return (
              <Link
                key={item.id}
                href={`/session/${item.id}`}
                onClick={handleSelect}
                className="flex flex-col gap-0.5 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-[#fafaf7]"
              >
                <span className="truncate text-sm font-semibold text-slate-900">
                  {item.fileName}
                </span>
                {snippet && (
                  <span className="truncate text-xs text-slate-500">{snippet}</span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
