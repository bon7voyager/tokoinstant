export function Marquee({ items }: { items: string[] }) {
  return (
    <div className="overflow-hidden border-y-3 border-ink bg-ink py-3">
      <div className="flex w-max items-center gap-8 animate-[marquee_24s_linear_infinite]">
        {[...items, ...items].map((item, i) => (
          <span
            key={i}
            className="whitespace-nowrap font-display text-xl text-paper"
            aria-hidden={i >= items.length}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
