import { getLeaderboards, type LeaderEntry } from "@/lib/leaderboard";
import { formatIDR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Leaderboard — Kilat",
  description: "Top 10 pelanggan dengan pembelian terbanyak di Kilat.",
};

const MEDAL = ["🥇", "🥈", "🥉"];

function Board({ title, entries }: { title: string; entries: LeaderEntry[] }) {
  return (
    <div className="border-3 border-ink bg-white shadow-brutal">
      <div className="border-b-3 border-ink bg-main px-4 py-3">
        <h2 className="font-display text-lg text-ink">{title}</h2>
      </div>
      {entries.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm font-medium text-ink/50">
          Belum ada pembelian di periode ini.
        </p>
      ) : (
        <ol className="divide-y divide-ink/10">
          {entries.map((e) => (
            <li key={e.rank} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="w-6 shrink-0 font-display text-ink/50">{e.rank}.</span>
                <span className="truncate font-bold">{e.name}</span>
                {e.rank <= 3 && <span aria-hidden>{MEDAL[e.rank - 1]}</span>}
              </div>
              <span className="shrink-0 font-bold">{formatIDR(e.total)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default async function LeaderboardPage() {
  const { today, week, month } = await getLeaderboards();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="text-center">
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">
          Top 10 Pembelian Terbanyak
        </h1>
        <p className="mx-auto mt-2 max-w-2xl font-medium text-ink/60">
          Daftar pelanggan dengan total belanja terbanyak. Diperbarui otomatis dari
          transaksi yang sudah selesai.
        </p>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        <Board title="Top 10 — Hari Ini" entries={today} />
        <Board title="Top 10 — Minggu Ini" entries={week} />
        <Board title="Top 10 — Bulan Ini" entries={month} />
      </div>
    </div>
  );
}
