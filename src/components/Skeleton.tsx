import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse border-3 border-ink bg-ink/10", className)} />;
}
