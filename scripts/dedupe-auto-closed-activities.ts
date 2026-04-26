import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

import { getDatabaseUrl } from "../lib/database-url.ts";

const adapter = new PrismaBetterSqlite3({
  url: getDatabaseUrl(),
});

const prisma = new PrismaClient({ adapter });

const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

async function main() {
  const activities = await prisma.ticketActivity.findMany({
    where: {
      eventType: "ticket.auto_closed",
    },
    select: {
      id: true,
      ticketId: true,
      messageZh: true,
      messageEn: true,
      createdAt: true,
    },
    orderBy: [
      { ticketId: "asc" },
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });

  const duplicateIds: string[] = [];
  const lastKeptByTicket = new Map<
    string,
    {
      id: string;
      messageZh: string;
      messageEn: string;
      createdAt: Date;
    }
  >();

  for (const activity of activities) {
    const previous = lastKeptByTicket.get(activity.ticketId);

    if (
      previous &&
      previous.messageZh === activity.messageZh &&
      previous.messageEn === activity.messageEn &&
      activity.createdAt.getTime() - previous.createdAt.getTime() <= DUPLICATE_WINDOW_MS
    ) {
      duplicateIds.push(activity.id);
      continue;
    }

    lastKeptByTicket.set(activity.ticketId, activity);
  }

  if (!duplicateIds.length) {
    console.log("No duplicate auto-close activities found.");
    return;
  }

  const result = await prisma.ticketActivity.deleteMany({
    where: {
      id: {
        in: duplicateIds,
      },
    },
  });

  console.log(`Deleted ${result.count} duplicate auto-close activities.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
