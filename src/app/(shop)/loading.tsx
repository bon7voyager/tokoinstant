import { Skeleton } from "@/components/Skeleton";

export default function ShopLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Skeleton className="h-10 w-64" />
      <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    </div>
  );
}
