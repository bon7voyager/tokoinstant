"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Client-side search + pagination over an in-memory list. Resets to page 1 on a
 * new query and clamps the page when the filtered set shrinks. */
export function usePagedSearch<T>(
  items: T[],
  searchText: (item: T) => string,
  perPage = 10,
) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter((i) => searchText(i).toLowerCase().includes(q))
    : items;
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(Math.max(0, page), pageCount - 1);
  const start = safePage * perPage;
  const pageItems = filtered.slice(start, start + perPage);

  return {
    query,
    setQuery: (v: string) => {
      setQuery(v);
      setPage(0);
    },
    page: safePage,
    setPage,
    pageItems,
    pageCount,
    total: filtered.length,
    perPage,
    start,
  };
}

export function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative mb-3 max-w-xs">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm">
        🔍
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // Don't let Enter submit a surrounding form (the bulk-discount table).
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        placeholder={placeholder}
        className="w-full border-3 border-ink bg-white py-2 pl-9 pr-8 text-sm font-medium shadow-brutal-sm focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Hapus pencarian"
          className="absolute right-2 top-1/2 -translate-y-1/2 px-1 text-xs font-bold text-ink/50 hover:text-ink"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/** Matches the look of the standard server-side <Pagination> ("Halaman X dari Y"
 * + Sebelumnya/Berikutnya), but client-side via onPage. Hidden on a single page. */
export function PagerControls({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
}) {
  if (pageCount <= 1) return null;

  const cls =
    "border-3 border-ink px-3 py-1.5 text-xs font-bold uppercase shadow-brutal-sm";
  const Btn = ({
    to,
    disabled,
    children,
  }: {
    to: number;
    disabled: boolean;
    children: React.ReactNode;
  }) =>
    disabled ? (
      <span className={cn(cls, "bg-white opacity-40")}>{children}</span>
    ) : (
      <button
        type="button"
        onClick={() => onPage(to)}
        className={cn(cls, "bg-white transition-transform hover:-translate-y-0.5")}
      >
        {children}
      </button>
    );

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <span className="text-xs font-bold uppercase tracking-wide text-ink/50">
        Halaman {page + 1} dari {pageCount}
      </span>
      <div className="flex gap-2">
        <Btn to={page - 1} disabled={page <= 0}>
          ← Sebelumnya
        </Btn>
        <Btn to={page + 1} disabled={page >= pageCount - 1}>
          Berikutnya →
        </Btn>
      </div>
    </div>
  );
}
