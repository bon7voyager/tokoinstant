export type QA = { q: string; a: string };

export function Faq({ items }: { items: QA[] }) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <details
          key={i}
          className="group border-3 border-ink bg-white shadow-brutal open:shadow-brutal-lg"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-bold">
            {item.q}
            <span className="flex h-7 w-7 shrink-0 items-center justify-center border-3 border-ink bg-main text-lg leading-none transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="border-t-3 border-ink p-4 font-medium text-ink/80">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
