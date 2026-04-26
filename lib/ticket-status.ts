import { prisma } from "@/lib/prisma";

const AUTO_CLOSE_DAYS = 7;

export async function autoCloseResolvedTickets() {
  const cutoff = new Date(Date.now() - AUTO_CLOSE_DAYS * 24 * 60 * 60 * 1000);
  const [resolvedStatus, closedStatus] = await Promise.all([
    prisma.statusDefinition.findUnique({
      where: { key: "RESOLVED" },
      select: { id: true },
    }),
    prisma.statusDefinition.findUnique({
      where: { key: "CLOSED" },
      select: { id: true },
    }),
  ]);

  if (!resolvedStatus || !closedStatus) {
    return;
  }

  const tickets = await prisma.ticket.findMany({
    where: {
      statusId: resolvedStatus.id,
      resolvedAt: {
        lte: cutoff,
      },
    },
    select: { id: true },
  });

  if (!tickets.length) {
    return;
  }

  const ticketIds = tickets.map((ticket) => ticket.id);
  await prisma.$transaction(async (tx) => {
    for (const ticketId of ticketIds) {
      const updated = await tx.ticket.updateMany({
        where: {
          id: ticketId,
          statusId: resolvedStatus.id,
          resolvedAt: {
            lte: cutoff,
          },
        },
        data: { statusId: closedStatus.id },
      });

      if (!updated.count) {
        continue;
      }

      await tx.ticketActivity.create({
        data: {
          ticketId,
          eventType: "ticket.auto_closed",
          messageZh: "系统已将状态从「已解决」改为「已关闭」（已解决满 7 天）。",
          messageEn: "The system changed the status from \"Resolved\" to \"Closed\" after 7 days.",
        },
      });
    }
  });
}
