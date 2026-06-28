"use client";

import { cn } from "@/lib/utils";

export default function ConfirmButton({
  message,
  className,
  children,
}: {
  message: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
      className={cn(
        "border-3 border-ink px-2 py-1 text-xs font-bold uppercase shadow-brutal-sm transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
        className,
      )}
    >
      {children}
    </button>
  );
}
