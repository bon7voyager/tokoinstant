export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin border-3 border-ink bg-main shadow-brutal" />
        <span className="font-display text-lg">Memuat…</span>
      </div>
    </div>
  );
}
