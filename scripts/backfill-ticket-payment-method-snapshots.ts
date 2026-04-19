import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

import { getDatabaseUrl } from "../lib/database-url.ts";

const adapter = new PrismaBetterSqlite3({
  url: getDatabaseUrl(),
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const ticketPaymentMethods = await prisma.ticketPaymentMethod.findMany({
    where: {
      OR: [
        { labelSnapshot: null },
        { last4Snapshot: null },
      ],
      paymentMethodId: {
        not: null,
      },
    },
    include: {
      paymentMethod: {
        select: {
          label: true,
          last4: true,
        },
      },
    },
  });

  for (const item of ticketPaymentMethods) {
    if (!item.paymentMethod) {
      continue;
    }

    await prisma.ticketPaymentMethod.update({
      where: { id: item.id },
      data: {
        labelSnapshot: item.labelSnapshot ?? item.paymentMethod.label,
        last4Snapshot: item.last4Snapshot ?? item.paymentMethod.last4,
      },
    });
  }

  console.log(`Processed ${ticketPaymentMethods.length} ticket payment method rows.`);
  console.log("Ticket payment method snapshot backfill complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
