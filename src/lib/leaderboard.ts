import "server-only";
import { prisma } from "@/lib/prisma";

export type LeaderEntry = { rank: number; name: string; total: number };

/** Top 10 buyers (by total COMPLETED spend) since a given date. */
async function topBuyers(since: Date): Promise<LeaderEntry[]> {
  const groups = await prisma.order.groupBy({
    by: ["userId"],
    where: { status: "COMPLETED", completedAt: { gte: since } },
    _sum: { total: true },
    orderBy: { _sum: { total: "desc" } },
    take: 10,
  });
  const ids = groups.map((g) => g.userId);
  if (ids.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  return groups.map((g, i) => ({
    rank: i + 1,
    name: nameById.get(g.userId) ?? "Pengguna",
    total: g._sum.total ?? 0,
  }));
}

/** Top-buyer leaderboards for today, this week (from Monday), and this month. */
export async function getLeaderboards(): Promise<{
  today: LeaderEntry[];
  week: LeaderEntry[];
  month: LeaderEntry[];
}> {
  const now = new Date();

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(startOfToday);
  const mondayOffset = (startOfWeek.getDay() + 6) % 7; // 0 = Monday
  startOfWeek.setDate(startOfWeek.getDate() - mondayOffset);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [today, week, month] = await Promise.all([
    topBuyers(startOfToday),
    topBuyers(startOfWeek),
    topBuyers(startOfMonth),
  ]);
  return { today, week, month };
}
