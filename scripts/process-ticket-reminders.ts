import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

import { processDueTicketReminders } from "../lib/ticket-events.ts";

async function main() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL || "file:./dev.db",
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const processedCount = await processDueTicketReminders({ prismaClient: prisma });
    console.log(`Processed ${processedCount} due ticket reminders.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
