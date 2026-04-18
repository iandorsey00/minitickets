import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

import { getDatabaseUrl } from "../lib/database-url.ts";

const adapter = new PrismaBetterSqlite3({
  url: getDatabaseUrl(),
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const tickets = await prisma.ticket.findMany({
    where: {
      assigneeId: {
        not: null,
      },
    },
    select: {
      id: true,
      assigneeId: true,
    },
  });

  for (const ticket of tickets) {
    if (!ticket.assigneeId) {
      continue;
    }

    await prisma.ticketAssignment.upsert({
      where: {
        ticketId_userId: {
          ticketId: ticket.id,
          userId: ticket.assigneeId,
        },
      },
      update: {},
      create: {
        ticketId: ticket.id,
        userId: ticket.assigneeId,
      },
    });
  }

  console.log(`Processed ${tickets.length} ticket assignment rows.`);
  console.log(`Ticket assignment backfill complete.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
